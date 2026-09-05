import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { Prisma, DocumentStatus, QualityStatus } from "../generated/prisma/client.js";

export const batchesRouter = Router();

batchesRouter.get("/", async (req, res) => {
  const batches = await prisma.productionBatch.findMany({
    where: { organizationId: req.tenantId },
    orderBy: { startedAt: "desc" },
  });

  const [orders, lots, products] = await Promise.all([
    prisma.productionOrder.findMany({
      where: { organizationId: req.tenantId },
      include: { lines: true },
    }),
    prisma.lot.findMany({ where: { organizationId: req.tenantId } }),
    prisma.product.findMany({ where: { organizationId: req.tenantId } }),
  ]);

  const orderMap = new Map(orders.map((o) => [o.id, o]));
  const lotMap = new Map(lots.map((l) => [l.id, l]));
  const prodMap = new Map(products.map((p) => [p.id, p]));

  const enriched = batches.map((b) => {
    const order = orderMap.get(b.productionOrderId);
    const fgLot = b.fgLotId ? lotMap.get(b.fgLotId) : null;
    const product = order ? prodMap.get(order.finishedProductId) : null;

    return {
      ...b,
      order,
      fgLot,
      product,
    };
  });

  res.json({ data: enriched });
});

const createBatchSchema = z.object({
  productionOrderId: z.string().uuid(),
  actualRMConsumed: z.coerce.number().positive(),
  actualOutputQty: z.coerce.number().positive(),
  manufactureDate: z.string().optional(),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
});

batchesRouter.post("/", async (req, res) => {
  const parsed = createBatchSchema.parse(req.body);

  const order = await prisma.productionOrder.findFirst({
    where: { id: parsed.productionOrderId, organizationId: req.tenantId },
  });

  if (!order) {
    return res.status(404).json({ error: { message: "Production order not found" } });
  }

  const finishedProduct = await prisma.product.findUnique({
    where: { id: order.finishedProductId },
  });

  // Calculate waste metrics
  const actualRM = parsed.actualRMConsumed;
  const actualFG = parsed.actualOutputQty;
  const actualWasteQty = Math.max(0, actualRM - actualFG);
  const actualWastePercent = actualRM > 0 ? (actualWasteQty / actualRM) * 100 : 0;
  const plannedWastePercent = Number(order.expectedWastePercent);
  const wasteVariancePercent = actualWastePercent - plannedWastePercent;

  const count = await prisma.productionBatch.count({
    where: { organizationId: req.tenantId },
  });
  const year = new Date().getFullYear();
  const batchNumber = `BATCH-${year}-${String(count + 1).padStart(4, "0")}`;

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const fgLotCode = `LOT-FG-${finishedProduct ? finishedProduct.sku : "PROD"}-${dateStr}-${randomSuffix}`;

  const mfg = parsed.manufactureDate ? new Date(parsed.manufactureDate) : new Date();
  const expiry = parsed.expiryDate
    ? new Date(parsed.expiryDate)
    : new Date(Date.now() + (finishedProduct?.shelfLifeDays || 90) * 86400000);

  // Execute in transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create FG Lot
    const fgLot = await tx.lot.create({
      data: {
        organizationId: req.tenantId!,
        productId: order.finishedProductId,
        code: fgLotCode,
        productionBatchId: null, // will update with batch.id
        manufactureDate: mfg,
        expiryDate: expiry,
        qualityStatus: QualityStatus.RELEASED,
      },
    });

    // 2. Create ProductionBatch
    const batch = await tx.productionBatch.create({
      data: {
        organizationId: req.tenantId!,
        number: batchNumber,
        productionOrderId: order.id,
        actualRMConsumed: new Prisma.Decimal(actualRM),
        actualOutputQty: new Prisma.Decimal(actualFG),
        actualWasteQty: new Prisma.Decimal(actualWasteQty),
        actualWastePercent: new Prisma.Decimal(actualWastePercent.toFixed(2)),
        wasteVariancePercent: new Prisma.Decimal(wasteVariancePercent.toFixed(2)),
        fgLotId: fgLot.id,
        status: DocumentStatus.CLOSED,
        startedAt: new Date(Date.now() - 3600000 * 4),
        completedAt: new Date(),
        notes: parsed.notes || `Production batch completed. Waste: ${actualWastePercent.toFixed(2)}% (Planned: ${plannedWastePercent}%).`,
      },
    });

    // Update lot with productionBatchId
    await tx.lot.update({
      where: { id: fgLot.id },
      data: { productionBatchId: batch.id },
    });

    // Update order status
    await tx.productionOrder.update({
      where: { id: order.id },
      data: { status: DocumentStatus.CLOSED },
    });

    return { batch, fgLot };
  });

  res.status(201).json({ data: result });
});
