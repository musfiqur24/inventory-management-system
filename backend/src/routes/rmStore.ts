import { storeLots } from "../services/storeLots.js";
import { randomUUID } from "node:crypto";
import { postStock, lockDocument, StockError, convertQuantity } from "../services/stock.js";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { Prisma, DocumentStatus, QualityStatus, MovementType } from "../generated/prisma/client.js";

export const rmStoreRouter = Router();

rmStoreRouter.get("/balances", async (req, res) => {
  const balances = await prisma.inventoryBalance.findMany({
    where: {
      organizationId: req.tenantId,
      bin: { store: { storeType: "RM_STORE" } },
    },
    include: {
      product: true,
      lot: true,
      bin: { include: { store: true } },
      uom: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  res.json({ data: balances });
});

const receiveRmSchema = z.object({
  requestId: z.string().uuid().optional(), deliveryId: z.string().uuid(),
  lineAllocations: z.array(z.object({ lineId: z.string().uuid(), productId: z.string().uuid(), binId: z.string().uuid(), acceptedQty: z.coerce.number().positive(), uomId: z.string().uuid(), expiryDate: z.string().date().optional(), manufactureDate: z.string().date().optional() })).min(1),
  notes: z.string().optional(),
});
rmStoreRouter.post('/receive', async (req, res) => {
  const parsed = receiveRmSchema.parse(req.body), organizationId = req.tenantId!;
  const receiptKey = parsed.requestId ?? randomUUID();
  const result = await prisma.$transaction(async tx => {
    await lockDocument(tx, 'SupplierDelivery', parsed.deliveryId, organizationId);
    const delivery = await tx.supplierDelivery.findFirst({ where: { id: parsed.deliveryId, organizationId }, include: { lines: true } });
    if (!delivery) throw new StockError('NOT_FOUND','Supplier delivery not found.',404);
    if (['RECEIVED','CANCELLED','REJECTED','CLOSED'].includes(delivery.status)) throw new StockError('DELIVERY_UNAVAILABLE','This delivery is already received or is unavailable.');
    const requisition = delivery.requisitionId ? await tx.purchaseRequisition.findFirst({ where: { id: delivery.requisitionId, organizationId } }) : null;
    if (delivery.requisitionId && !requisition) throw new StockError('INVALID_REFERENCE','Delivery requisition is not in this organization.',422);
    if(requisition) await tx.$queryRaw`SELECT id FROM "PurchaseRequisition" WHERE id=${requisition.id} FOR UPDATE`;
    const createdLots = [];
    // Consistent bin order reduces deadlocks for receipts split between multiple bins.
    const allocations = parsed.lineAllocations.map((value,index)=>({...value,index})).sort((a,b)=>a.binId.localeCompare(b.binId));
    for (const alloc of allocations) {
      const line = await tx.supplierDeliveryLine.findFirst({ where: { id: alloc.lineId, deliveryId: delivery.id } });
      if (!line || line.productId !== alloc.productId || line.uomId !== alloc.uomId) throw new StockError('INVALID_LINE','Product and UOM must match the delivery line.',422);
      const qty = new Prisma.Decimal(alloc.acceptedQty);
      if (qty.plus(line.acceptedQty ?? 0).gt(line.declaredQty)) throw new StockError('OVER_RECEIPT','Accepted quantity exceeds the remaining delivery quantity.');
      const product = await tx.product.findFirst({ where: { id: alloc.productId, organizationId } });
      if (!product) throw new StockError('INVALID_PRODUCT','Product not found.',422);
      const lot = await tx.lot.create({ data: { organizationId, productId: product.id, code: 'RM-' + randomUUID(), supplierDeliveryId: delivery.id,
        manufactureDate: alloc.manufactureDate ? new Date(alloc.manufactureDate) : new Date(), expiryDate: alloc.expiryDate ? new Date(alloc.expiryDate) : new Date(Date.now()+(product.shelfLifeDays??180)*86400000), qualityStatus: QualityStatus.RELEASED } });
      await postStock(tx, { organizationId, productId: product.id, lotId: lot.id, binId: alloc.binId, uomId: alloc.uomId, quantity: qty, direction: 'IN', storeType: 'RM_STORE', movementType: MovementType.RECEIPT,
        documentType: 'SUPPLIER_DELIVERY', documentId: delivery.number, sourceDocumentId: delivery.id, sourceLineId: line.id,
        referenceType: requisition ? 'PURCHASE_REQUISITION' : undefined, referenceId: requisition?.id, referenceNumber: requisition?.number, postingKey: 'RM:'+receiptKey+':'+alloc.index, performedById: req.auth?.id, note: parsed.notes });
      await tx.supplierDeliveryLine.update({ where: { id: line.id }, data: { acceptedQty: qty.plus(line.acceptedQty ?? 0) } });
      if (requisition) {
        const reqLines = await tx.purchaseRequisitionLine.findMany({ where: { requisitionId: requisition.id, productId: product.id }, orderBy: { id:'asc' } });
        let remaining = qty;
        for (const reqLine of reqLines) {
          if (remaining.lte(0)) break;
          const converted = await convertQuantity(tx, organizationId, remaining, alloc.uomId, reqLine.uomId);
          const room = reqLine.requestedQty.minus(reqLine.receivedQty);
          if (room.lte(0)) continue;
          const accepted = Prisma.Decimal.min(room,converted);
          await tx.purchaseRequisitionLine.update({where:{id:reqLine.id},data:{receivedQty:{increment:accepted}}});
          remaining = remaining.minus(await convertQuantity(tx, organizationId, accepted, reqLine.uomId, alloc.uomId));
        }
        if (remaining.gt(0)) throw new StockError('OVER_REQUISITION','Receipt exceeds the remaining requisition quantity.');
      }
      createdLots.push(lot);
    }
    const allLines = await tx.supplierDeliveryLine.findMany({where:{deliveryId:delivery.id}});
    await tx.supplierDelivery.update({where:{id:delivery.id},data:{status:allLines.every(l=>new Prisma.Decimal(l.acceptedQty??0).gte(l.declaredQty))?DocumentStatus.RECEIVED:DocumentStatus.PARTIALLY_RECEIVED}});
    if (requisition) {
      const lines = await tx.purchaseRequisitionLine.findMany({where:{requisitionId:requisition.id}});
      await tx.purchaseRequisition.update({where:{id:requisition.id},data:{status:lines.every(l=>l.receivedQty.gte(l.requestedQty))?DocumentStatus.RECEIVED:DocumentStatus.PARTIALLY_RECEIVED}});
    }
    return { deliveryId:delivery.id,createdLots };
  }, { timeout: 20000 });
  res.status(201).json({data:result});
});

rmStoreRouter.get('/lots',async(req,res)=>res.json({data:await storeLots(req.tenantId!,'RM_STORE')}));
