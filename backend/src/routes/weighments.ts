import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { Prisma, DocumentStatus } from "../generated/prisma/client.js";
import { StockError } from "../services/stock.js";

export const weighmentsRouter = Router();

const reportSchema = z.object({
  deliveryId: z.string().uuid(),
  grossWeight: z.coerce.number().positive(),
  tareWeight: z.coerce.number().positive(),
  lines: z.array(z.object({
    lineId: z.string().uuid(),
    measuredQty: z.coerce.number().min(0),
  })).min(1),
});

weighmentsRouter.get("/queue", async (req, res) => {
  const organizationId = req.tenantId!;
  const deliveries = await prisma.supplierDelivery.findMany({
    where: { organizationId, deletedAt: null, status: DocumentStatus.SUBMITTED },
    include: { lines: true },
    orderBy: { deliveredAt: "asc" },
  });
  const [products, uoms, suppliers, requisitions, previousLines] = await Promise.all([
    prisma.product.findMany({ where: { organizationId } }),
    prisma.unitOfMeasure.findMany({ where: { organizationId } }),
    prisma.partner.findMany({ where: { organizationId } }),
    prisma.purchaseRequisition.findMany({ where: { organizationId }, include: { lines: true } }),
    prisma.supplierDeliveryLine.findMany({
      where: { delivery: { organizationId, deletedAt: null, approvedAt: { not: null } } },
      include: { delivery: { select: { requisitionId: true } } },
    }),
  ]);
  const productMap = new Map(products.map((item) => [item.id, item]));
  const uomMap = new Map(uoms.map((item) => [item.id, item]));
  const supplierMap = new Map(suppliers.map((item) => [item.id, item]));
  const requisitionMap = new Map(requisitions.map((item) => [item.id, item]));
  res.json({
    data: deliveries.map((delivery) => {
      const requisition = delivery.requisitionId ? requisitionMap.get(delivery.requisitionId) : null;
      return {
        ...delivery,
        supplier: supplierMap.get(delivery.supplierId),
        requisition: requisition ? { id: requisition.id, number: requisition.number } : null,
        lines: delivery.lines.map((line) => {
          const requisitionQty = requisition?.lines
            .filter((item) => item.productId === line.productId && item.uomId === line.uomId)
            .reduce((sum, item) => sum + Number(item.requestedQty), 0) ?? null;
          const previouslyVerifiedQty = delivery.requisitionId
            ? previousLines
                .filter((item) => item.delivery.requisitionId === delivery.requisitionId && item.productId === line.productId && item.uomId === line.uomId)
                .reduce((sum, item) => sum + Number(item.verifiedQty ?? 0), 0)
            : 0;
          return {
            ...line,
            product: productMap.get(line.productId),
            uom: uomMap.get(line.uomId),
            requisitionQty,
            previouslyVerifiedQty,
            remainingQty: requisitionQty == null ? null : Math.max(0, requisitionQty - previouslyVerifiedQty),
          };
        }),
      };
    }),
  });
});

weighmentsRouter.get("/", async (req, res) => {
  const organizationId = req.tenantId!;
  const rows = await prisma.weighment.findMany({ where: { organizationId }, orderBy: { measuredAt: "desc" } });
  const deliveries = await prisma.supplierDelivery.findMany({ where: { organizationId }, include: { lines: true } });
  const requisitions = await prisma.purchaseRequisition.findMany({ where: { organizationId }, select: { id: true, number: true } });
  const suppliers = await prisma.partner.findMany({ where: { organizationId }, select: { id: true, name: true } });
  const requisitionMap = new Map(requisitions.map((item) => [item.id, item]));
  const supplierMap = new Map(suppliers.map((item) => [item.id, item]));
  const deliveryMap = new Map(deliveries.map((item) => [item.id, { ...item, requisition: item.requisitionId ? requisitionMap.get(item.requisitionId) : null, supplier: supplierMap.get(item.supplierId), partialLineCount: item.lines.filter(line => line.weighbridgeMatched === false).length }]));
  res.json({ data: rows.map((row) => ({ ...row, delivery: row.deliveryId ? deliveryMap.get(row.deliveryId) : null })) });
});

weighmentsRouter.post("/reports", async (req, res) => {
  const parsed = reportSchema.parse(req.body);
  if (parsed.grossWeight <= parsed.tareWeight) throw new StockError("INVALID_WEIGHT", "Gross weight must be greater than tare weight.", 422);
  const organizationId = req.tenantId!, userId = req.auth!.id;
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "SupplierDelivery" WHERE id=${parsed.deliveryId} AND "organizationId"=${organizationId} FOR UPDATE`;
    const delivery = await tx.supplierDelivery.findFirst({
      where: { id: parsed.deliveryId, organizationId, deletedAt: null },
      include: { lines: true },
    });
    if (!delivery) throw new StockError("NOT_FOUND", "Challan not found.", 404);
    if (delivery.status !== DocumentStatus.SUBMITTED || delivery.weighedAt) throw new StockError("INVALID_STATUS", "Only a challan awaiting weighbridge can be measured.", 409);
    if (parsed.lines.length !== delivery.lines.length || new Set(parsed.lines.map((line) => line.lineId)).size !== delivery.lines.length) {
      throw new StockError("INVALID_REPORT", "Measure every challan line.", 422);
    }
    const measured = new Map(parsed.lines.map((line) => [line.lineId, new Prisma.Decimal(line.measuredQty)]));
    let requisition: any = null;
    const remaining = new Map<string, Prisma.Decimal>();
    if (delivery.requisitionId) {
      await tx.$queryRaw`SELECT id FROM "PurchaseRequisition" WHERE id=${delivery.requisitionId} AND "organizationId"=${organizationId} FOR UPDATE`;
      requisition = await tx.purchaseRequisition.findFirst({ where: { id: delivery.requisitionId, organizationId, deletedAt: null }, include: { lines: true } }) as any;
      if (!requisition) throw new StockError("INVALID_REQUISITION", "Linked requisition was not found.", 422);
      const prior = await tx.supplierDeliveryLine.findMany({
        where: { delivery: { organizationId, requisitionId: delivery.requisitionId, deletedAt: null, approvedAt: { not: null } } },
      });
      for (const line of requisition.lines ?? []) {
        const key = line.productId + ":" + line.uomId;
        remaining.set(key, (remaining.get(key) ?? new Prisma.Decimal(0)).plus(line.requestedQty));
      }
      for (const line of prior) {
        const key = line.productId + ":" + line.uomId;
        remaining.set(key, (remaining.get(key) ?? new Prisma.Decimal(0)).minus(line.verifiedQty ?? 0));
      }
    }
    let hasMismatch = false;
    for (const line of delivery.lines) {
      const quantity = measured.get(line.id);
      if (!quantity) throw new StockError("INVALID_REPORT", "Measure every challan line.", 422);
      const key = line.productId + ":" + line.uomId;
      const requisitionRemaining = remaining.get(key);
      if (requisition && requisitionRemaining == null) throw new StockError("LINE_NOT_REQUESTED", "A challan line does not exist on the linked requisition.", 422);
      const matched = requisitionRemaining ? quantity.eq(requisitionRemaining) : quantity.eq(line.declaredQty);
      if (!matched) hasMismatch = true;
      await tx.supplierDeliveryLine.update({
        where: { id: line.id },
        data: { measuredQty: quantity, weighbridgeMatched: matched, weighedAt: new Date(), weighedById: userId },
      });
    }
    const netWeight = new Prisma.Decimal(parsed.grossWeight).minus(parsed.tareWeight);
    const weighment = await tx.weighment.create({
      data: {
        organizationId,
        deliveryId: delivery.id,
        vehicleNo: delivery.vehicleNo?.toUpperCase() ?? null,
        grossWeight: new Prisma.Decimal(parsed.grossWeight),
        tareWeight: new Prisma.Decimal(parsed.tareWeight),
        netWeight,
        operatorId: userId,
      },
    });
    await tx.supplierDelivery.update({
      where: { id: delivery.id },
      data: { status: DocumentStatus.WEIGHED, weighedAt: new Date(), weighedById: userId, grossWeight: new Prisma.Decimal(parsed.grossWeight), tareWeight: new Prisma.Decimal(parsed.tareWeight), netWeight },
    });
    if (requisition && hasMismatch) await tx.purchaseRequisition.update({ where: { id: requisition.id }, data: { status: DocumentStatus.INCOMPLETE } });
    await tx.notification.deleteMany({ where: { organizationId, deliveryId: delivery.id } });
    await tx.notification.create({
      data: {
        organizationId,
        recipientId: delivery.assignedManagerId!,
        deliveryId: delivery.id,
        title: hasMismatch ? "Challan has partial fulfillment" : "Challan weighbridge report ready",
        message: delivery.number + " is ready for review and approval.",
      },
    });
    return { weighment, deliveryId: delivery.id, hasMismatch };
  }, { timeout: 20000 });
  res.status(201).json({ data: result });
});
