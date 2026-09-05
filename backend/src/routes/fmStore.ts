import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { Prisma, MovementType } from "../generated/prisma/client.js";

export const fmStoreRouter = Router();

fmStoreRouter.get("/balances", async (req, res) => {
  const balances = await prisma.inventoryBalance.findMany({
    where: {
      organizationId: req.tenantId,
      product: {
        type: "FINISHED_GOOD",
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

const receiveFmSchema = z.object({
  batchId: z.string().uuid(),
  binId: z.string().uuid(),
  notes: z.string().optional(),
});

fmStoreRouter.post("/receive", async (req, res) => {
  const parsed = receiveFmSchema.parse(req.body);

  const batch = await prisma.productionBatch.findFirst({
    where: { id: parsed.batchId, organizationId: req.tenantId },
  });

  if (!batch || !batch.fgLotId || !batch.actualOutputQty) {
    return res.status(404).json({ error: { message: "Valid batch with finished goods lot not found" } });
  }

  const order = await prisma.productionOrder.findUnique({
    where: { id: batch.productionOrderId },
  });

  if (!order) {
    return res.status(404).json({ error: { message: "Associated production order not found" } });
  }

  const bin = await prisma.bin.findFirst({
    where: { id: parsed.binId, organizationId: req.tenantId },
  });

  if (!bin) {
    return res.status(404).json({ error: { message: "FM Bin not found" } });
  }

  const qty = new Prisma.Decimal(batch.actualOutputQty);

  // Put away into FM bin in transaction
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.inventoryBalance.findUnique({
      where: {
        organizationId_productId_lotId_binId: {
          organizationId: req.tenantId!,
          productId: order.finishedProductId,
          lotId: batch.fgLotId!,
          binId: bin.id,
        },
      },
    });

    let balance;
    if (existing) {
      balance = await tx.inventoryBalance.update({
        where: { id: existing.id },
        data: { quantity: { increment: qty } },
      });
    } else {
      balance = await tx.inventoryBalance.create({
        data: {
          organizationId: req.tenantId!,
          productId: order.finishedProductId,
          lotId: batch.fgLotId!,
          binId: bin.id,
          uomId: order.plannedUomId,
          quantity: qty,
          reservedQty: new Prisma.Decimal(0),
        },
      });
    }

    await tx.stockMovement.create({
      data: {
        organizationId: req.tenantId!,
        movementType: MovementType.PRODUCTION_OUTPUT,
        productId: order.finishedProductId,
        lotId: batch.fgLotId,
        toBinId: bin.id,
        quantity: qty,
        uomId: order.plannedUomId,
        documentType: "PRODUCTION_BATCH",
        documentId: batch.number,
        note: parsed.notes || `Received from Batch ${batch.number} into bin ${bin.code}.`,
        occurredAt: new Date(),
      },
    });

    return balance;
  });

  res.status(201).json({
    data: {
      message: "Finished goods successfully received into FM Store Bin",
      balance: result,
    },
  });
});
