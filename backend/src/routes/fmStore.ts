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
  const parsed = z.object({
    batchId: z.string().uuid(),
    allocations: z.array(z.object({
      lineId: z.string().uuid(),
      binId: z.string().uuid(),
      expiryDate: z.string().date().optional(),
    })).min(1),
    notes: z.string().optional(),
  }).parse(req.body);
  const organizationId = req.tenantId!;
  const data = await prisma.$transaction(async (tx) => {
    await lockDocument(tx, "ProductionBatch", parsed.batchId, organizationId);
    const batch = await tx.productionBatch.findFirst({
      where: { id: parsed.batchId, organizationId },
      include: { outputLines: true },
    });
    if (!batch || batch.status !== "READY" || !batch.outputLines.length)
      throw new StockError("INVALID_BATCH", "Select a Ready batch with finished output.", 422);
    const prior = await tx.stockMovement.findFirst({
      where: { organizationId, documentType: "PRODUCTION_BATCH", documentId: batch.number, movementType: "PRODUCTION_OUTPUT" },
    });
    if (prior) throw new StockError("ALREADY_RECEIVED", "This production batch has already been received.");
    const anchor = await tx.productionOrder.findFirst({ where: { id: batch.productionOrderId, organizationId } });
    if (!anchor) throw new StockError("INVALID_ORDER", "Production order not found.", 422);
    const orders = anchor.requisitionId
      ? await tx.productionOrder.findMany({ where: { organizationId, requisitionId: anchor.requisitionId } })
      : [anchor];
    const orderByProduct = new Map(orders.map((order) => [order.finishedProductId, order]));
    const allocationMap = new Map(parsed.allocations.map((allocation) => [allocation.lineId, allocation]));
    if (batch.outputLines.some((line) => !line.productId || !allocationMap.has(line.id) || Number(line.quantity) <= 0))
      throw new StockError("INVALID_OUTPUTS", "Choose an FM Store bin for every finished product.", 422);
    const movements = [];
    for (const [index, output] of batch.outputLines.entries()) {
      const order = orderByProduct.get(output.productId!);
      const outputProduct = await tx.product.findFirst({ where: { id: output.productId!, organizationId, isActive: true } });
      if (!outputProduct || (!order && outputProduct.type !== "BY_PRODUCT"))
        throw new StockError("INVALID_OUTPUT", "A finished-good output must belong to this requisition; only registered by-products may be additional outputs.", 422);
      const outputUomId = order?.plannedUomId ?? outputProduct.baseUomId;
      const allocation = allocationMap.get(output.id)!;
      const binId = allocation.binId;
      const bin = await tx.bin.findFirst({ where: { id: binId, organizationId, store: { storeType: "FM_STORE" } } });
      if (!bin) throw new StockError("INVALID_BIN", "Select a valid FM Store bin.", 422);
      const lot = await tx.lot.create({ data: {
        organizationId,
        productId: output.productId!,
        code: output.lotCode || batch.number + "-" + String(index + 1).padStart(2, "0"),
        manufactureDate: new Date(),
        expiryDate: allocation.expiryDate ? new Date(allocation.expiryDate + "T23:59:59.999Z") : null,
        qualityStatus: "RELEASED",
        productionBatchId: batch.id,
      } });
      movements.push(await postStock(tx, {
        organizationId,
        binId,
        productId: output.productId!,
        lotId: lot.id,
        uomId: outputUomId,
        quantity: output.quantity,
        direction: "IN",
        storeType: "FM_STORE",
        movementType: "PRODUCTION_OUTPUT",
        documentType: "PRODUCTION_BATCH",
        documentId: batch.number,
        sourceDocumentId: batch.id,
        sourceLineId: output.id,
        referenceType: "PRODUCTION_REQUISITION",
        referenceId: anchor.requisitionId ?? anchor.id,
        referenceNumber: anchor.requisitionId ?? anchor.number,
        postingKey: "FM:" + batch.id + ":" + output.id,
        performedById: req.auth?.id,
        note: parsed.notes,
      }));
    }
    await tx.productionBatch.update({ where: { id: batch.id }, data: { status: "COMPLETED", completedAt: new Date() } });
    await tx.productionOrder.updateMany({ where: { id: { in: orders.map((order) => order.id) } }, data: { status: "COMPLETED" } });
    return movements;
  }, { timeout: 20000 });
  res.status(201).json({ data });
});

fmStoreRouter.get('/lots',async(req,res)=>res.json({data:await storeLots(req.tenantId!,'FM_STORE')}));
