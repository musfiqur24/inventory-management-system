import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { Prisma, DocumentStatus, QualityStatus, MovementType } from "../generated/prisma/client.js";

export const rmStoreRouter = Router();

rmStoreRouter.get("/balances", async (req, res) => {
  const balances = await prisma.inventoryBalance.findMany({
    where: {
      organizationId: req.tenantId,
      product: {
        type: "RAW_MATERIAL",
      },
    },
    include: {
      product: true,
      lot: true,
      bin: true,
      uom: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  res.json({ data: balances });
});

rmStoreRouter.get("/lots", async (req, res) => {
  const lots = await prisma.lot.findMany({
    where: {
      organizationId: req.tenantId,
      supplierDeliveryId: { not: null },
    },
    include: {
      balances: {
        include: {
          bin: true,
          product: true,
          uom: true,
        },
      },
    },
    orderBy: { manufactureDate: "desc" },
  });

  const products = await prisma.product.findMany({ where: { organizationId: req.tenantId } });
  const deliveries = await prisma.supplierDelivery.findMany({ where: { organizationId: req.tenantId } });
  const prodMap = new Map(products.map((p) => [p.id, p]));
  const delMap = new Map(deliveries.map((d) => [d.id, d]));

  const enriched = lots.map((lot) => ({
    ...lot,
    product: prodMap.get(lot.productId),
    delivery: lot.supplierDeliveryId ? delMap.get(lot.supplierDeliveryId) : null,
  }));

  res.json({ data: enriched });
});

// 3-Way match inspection and put-away into Bins
const receiveRmSchema = z.object({
  deliveryId: z.string().uuid(),
  lineAllocations: z.array(
    z.object({
      lineId: z.string().uuid(),
      productId: z.string().uuid(),
      binId: z.string().uuid(),
      acceptedQty: z.coerce.number().positive(),
      uomId: z.string().uuid(),
      expiryDate: z.string().optional(),
      manufactureDate: z.string().optional(),
    })
  ).min(1, "At least one item allocation is required"),
  notes: z.string().optional(),
});

rmStoreRouter.post("/receive", async (req, res) => {
  const parsed = receiveRmSchema.parse(req.body);

  const delivery = await prisma.supplierDelivery.findFirst({
    where: { id: parsed.deliveryId, organizationId: req.tenantId },
    include: { lines: true },
  });

  if (!delivery) {
    return res.status(404).json({ error: { message: "Supplier delivery not found" } });
  }

  const createdLots = [];

  for (const alloc of parsed.lineAllocations) {
    const product = await prisma.product.findUnique({ where: { id: alloc.productId } });
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const lotCode = `LOT-RM-${product ? product.sku : "MAT"}-${dateStr}-${randomSuffix}`;

    const expiry = alloc.expiryDate
      ? new Date(alloc.expiryDate)
      : new Date(Date.now() + (product?.shelfLifeDays || 180) * 86400000);

    const mfg = alloc.manufactureDate
      ? new Date(alloc.manufactureDate)
      : new Date();

    // 1. Create Lot
    const lot = await prisma.lot.create({
      data: {
        organizationId: req.tenantId!,
        productId: alloc.productId,
        code: lotCode,
        supplierDeliveryId: delivery.id,
        manufactureDate: mfg,
        expiryDate: expiry,
        qualityStatus: QualityStatus.RELEASED,
      },
    });
    createdLots.push(lot);

    // 2. Put Away into Bin (Upsert InventoryBalance)
    const existingBalance = await prisma.inventoryBalance.findUnique({
      where: {
        organizationId_productId_lotId_binId: {
          organizationId: req.tenantId!,
          productId: alloc.productId,
          lotId: lot.id,
          binId: alloc.binId,
        },
      },
    });

    const qtyDecimal = new Prisma.Decimal(alloc.acceptedQty);

    if (existingBalance) {
      await prisma.inventoryBalance.update({
        where: { id: existingBalance.id },
        data: { quantity: { increment: qtyDecimal } },
      });
    } else {
      await prisma.inventoryBalance.create({
        data: {
          organizationId: req.tenantId!,
          productId: alloc.productId,
          lotId: lot.id,
          binId: alloc.binId,
          uomId: alloc.uomId,
          quantity: qtyDecimal,
          reservedQty: new Prisma.Decimal(0),
        },
      });
    }

    // 3. Post immutable StockMovement ledger entry
    await prisma.stockMovement.create({
      data: {
        organizationId: req.tenantId!,
        movementType: MovementType.RECEIPT,
        productId: alloc.productId,
        lotId: lot.id,
        toBinId: alloc.binId,
        quantity: qtyDecimal,
        uomId: alloc.uomId,
        documentType: "SUPPLIER_DELIVERY",
        documentId: delivery.number,
        note: parsed.notes || `Received from Challan ${delivery.number}. Put away in bin.`,
        occurredAt: new Date(),
      },
    });

    // 4. Update Delivery Line acceptedQty
    await prisma.supplierDeliveryLine.update({
      where: { id: alloc.lineId },
      data: { acceptedQty: qtyDecimal },
    });

    // 5. Update Purchase Requisition Line receivedQty if delivery is linked to requisition
    if (delivery.requisitionId) {
      const reqLine = await prisma.purchaseRequisitionLine.findFirst({
        where: {
          requisitionId: delivery.requisitionId,
          productId: alloc.productId,
        },
      });
      if (reqLine) {
        await prisma.purchaseRequisitionLine.update({
          where: { id: reqLine.id },
          data: { receivedQty: { increment: qtyDecimal } },
        });
      }
    }
  }

  // Mark delivery as RECEIVED
  await prisma.supplierDelivery.update({
    where: { id: delivery.id },
    data: { status: DocumentStatus.RECEIVED },
  });

  // If requisition exists, check if fully received
  if (delivery.requisitionId) {
    const allLines = await prisma.purchaseRequisitionLine.findMany({
      where: { requisitionId: delivery.requisitionId },
    });
    const allReceived = allLines.every((l) => Number(l.receivedQty) >= Number(l.requestedQty));
    await prisma.purchaseRequisition.update({
      where: { id: delivery.requisitionId },
      data: {
        status: allReceived ? DocumentStatus.RECEIVED : DocumentStatus.PARTIALLY_RECEIVED,
      },
    });
  }

  res.status(201).json({
    data: {
      message: "Goods successfully verified and stored in RM warehouse bins",
      deliveryId: delivery.id,
      createdLots,
    },
  });
});
