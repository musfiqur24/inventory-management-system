import { storeLots } from "../services/storeLots.js";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { postStock, lockDocument, StockError } from "../services/stock.js";
export const fmStoreRouter = Router();
fmStoreRouter.get("/balances", async (req, res) =>
  res.json({
    data: await prisma.inventoryBalance.findMany({
      where: {
        organizationId: req.tenantId,
        bin: { store: { storeType: "FM_STORE" } },
      },
      include: {
        product: true,
        lot: true,
        bin: { include: { store: true } },
        uom: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
  }),
);
fmStoreRouter.post("/receive", async (req, res) => {
  const parsed = z
      .object({
        batchId: z.string().uuid(),
        binId: z.string().uuid(),
        notes: z.string().optional(),
      })
      .parse(req.body),
    organizationId = req.tenantId!;
  const data = await prisma.$transaction(
    async (tx) => {
      await lockDocument(tx, "ProductionBatch", parsed.batchId, organizationId);
      const batch = await tx.productionBatch.findFirst({
        where: { id: parsed.batchId, organizationId },
      });
      if (
        !batch ||
        !batch.fgLotId ||
        !batch.actualOutputQty?.gt(0) ||
        batch.status !== "CLOSED"
      )
        throw new StockError(
          "INVALID_BATCH",
          "Select a completed batch with finished output.",
          422,
        );
      const prior = await tx.stockMovement.findFirst({
        where: {
          organizationId,
          documentType: "PRODUCTION_BATCH",
          documentId: batch.number,
          movementType: "PRODUCTION_OUTPUT",
        },
      });
      if (prior)
        throw new StockError(
          "ALREADY_RECEIVED",
          "This production batch has already been received.",
        );
      const order = await tx.productionOrder.findFirst({
        where: { id: batch.productionOrderId, organizationId },
      });
      if (!order)
        throw new StockError(
          "INVALID_ORDER",
          "Production order not found.",
          422,
        );
      return postStock(tx, {
        organizationId,
        binId: parsed.binId,
        productId: order.finishedProductId,
        lotId: batch.fgLotId,
        uomId: order.plannedUomId,
        quantity: batch.actualOutputQty,
        direction: "IN",
        storeType: "FM_STORE",
        movementType: "PRODUCTION_OUTPUT",
        documentType: "PRODUCTION_BATCH",
        documentId: batch.number,
        sourceDocumentId: batch.id,
        referenceType: "PRODUCTION_ORDER",
        referenceId: order.id,
        referenceNumber: order.number,
        postingKey: "FM:" + batch.id,
        performedById: req.auth?.id,
        note: parsed.notes,
      });
    },
    { timeout: 20000 },
  );
  res.status(201).json({ data });
});

fmStoreRouter.get('/lots',async(req,res)=>res.json({data:await storeLots(req.tenantId!,'FM_STORE')}));
