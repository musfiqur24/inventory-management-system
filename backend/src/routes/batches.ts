import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { Prisma, DocumentStatus, QualityStatus } from "../generated/prisma/client.js";
import { lockDocument, postStock, StockError } from "../services/stock.js";
export const batchesRouter = Router();
const round = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;
const weightedLinePrices = (lines: Array<{ productId: string; wasteAdjustedQty: unknown; unitPrice: unknown }>) => {
  const totals = new Map<string, { value: number; qty: number }>();
  for (const line of lines) {
    const price = Number(line.unitPrice), qty = Number(line.wasteAdjustedQty);
    if (!(price > 0) || !(qty > 0)) continue;
    const current = totals.get(line.productId) ?? { value: 0, qty: 0 };
    current.value += price * qty;
    current.qty += qty;
    totals.set(line.productId, current);
  }
  return new Map([...totals].map(([productId, total]) => [productId, total.value / total.qty]));
};
const procurementPrices = async (organizationId: string, productIds: string[]) => {
  const lines = await prisma.supplierDeliveryLine.findMany({ where: { productId: { in: productIds }, unitPrice: { not: null }, delivery: { organizationId } } });
  const totals = new Map<string, { value: number; qty: number }>();
  for (const line of lines) {
    const qty = Number(line.acceptedQty ?? line.declaredQty), price = Number(line.unitPrice);
    if (!(qty > 0) || !(price > 0)) continue;
    const current = totals.get(line.productId) ?? { value: 0, qty: 0 };
    current.value += qty * price;
    current.qty += qty;
    totals.set(line.productId, current);
  }
  return new Map([...totals].map(([productId, total]) => [productId, total.value / total.qty]));
};
const metrics = (batch: any, rates: Map<string, number>, prices: Map<string, number>) => {
  const inputs = batch.inputLines ?? [], outputs = batch.outputLines ?? [], costs = batch.costLines ?? [];
  const lineCost = (x: any) => Number(x.quantity) * (prices.get(x.productId) ?? Number(x.unitPrice));
  const rawMaterialCost = inputs.filter((x: any) => x.category === "RAW_MATERIAL").reduce((s: number, x: any) => s + lineCost(x), 0);
  const otherInputCost = inputs.filter((x: any) => x.category !== "RAW_MATERIAL").reduce((s: number, x: any) => s + lineCost(x), 0);
  const operatingCost = costs.reduce((s: number, x: any) => s + Number(x.quantity) * Number(x.unitPrice), 0);
  const totalCost = rawMaterialCost + otherInputCost + operatingCost;
  const totalOutputQty = outputs.reduce((s: number, x: any) => s + Number(x.quantity), 0);
  const revenue = outputs.reduce((s: number, x: any) => s + Number(x.quantity) * (rates.get(x.productId) ?? prices.get(x.productId) ?? Number(x.unitPrice ?? 0)), 0);
  const profit = revenue - totalCost;
  return { rawMaterialCost: round(rawMaterialCost), otherInputCost: round(otherInputCost), operatingCost: round(operatingCost), totalCost: round(totalCost), totalOutputQty: round(totalOutputQty), costPerKg: totalOutputQty ? round(totalCost / totalOutputQty) : 0, costPerTon: totalOutputQty ? round(totalCost / totalOutputQty * 1000) : 0, revenue: round(revenue), profit: round(profit), profitPerKg: totalOutputQty ? round(profit / totalOutputQty) : 0, profitPerTon: totalOutputQty ? round(profit / totalOutputQty * 1000) : 0, marginPercent: revenue ? round(profit / revenue * 100) : 0, salesPosted: outputs.some((x: any) => x.productId && rates.has(x.productId)) };
};

batchesRouter.get("/", async (req, res) => {
  const [batches, orders, products, lots, salesLines, purchaseLines] = await Promise.all([
    prisma.productionBatch.findMany({ where: { organizationId: req.tenantId }, include: { inputLines: true, outputLines: true, costLines: true }, orderBy: { startedAt: "desc" } }),
    prisma.productionOrder.findMany({ where: { organizationId: req.tenantId }, include: { lines: true, requisition: true } }),
    prisma.product.findMany({ where: { organizationId: req.tenantId } }),
    prisma.lot.findMany({ where: { organizationId: req.tenantId } }),
    prisma.salesOrderLine.findMany({ where: { salesOrder: { organizationId: req.tenantId }, unitPrice: { not: null } } }),
    prisma.supplierDeliveryLine.findMany({ where: { delivery: { organizationId: req.tenantId }, unitPrice: { not: null } } }),
  ]);
  const totals = new Map<string, { value: number; qty: number }>();
  salesLines.forEach(x => { const v = totals.get(x.productId) ?? { value: 0, qty: 0 }; v.value += Number(x.quantity) * Number(x.unitPrice); v.qty += Number(x.quantity); totals.set(x.productId, v); });
  const rates = new Map([...totals].map(([id, v]) => [id, v.value / v.qty]));
  const purchaseTotals = new Map<string, { value: number; qty: number }>();
  purchaseLines.forEach(x => { const v = purchaseTotals.get(x.productId) ?? { value: 0, qty: 0 }; const qty = Number(x.acceptedQty ?? x.declaredQty); v.value += qty * Number(x.unitPrice); v.qty += qty; purchaseTotals.set(x.productId, v); });
  const purchaseRates = new Map([...purchaseTotals].map(([id, v]) => [id, v.value / v.qty]));
  const orderMap = new Map(orders.map(x => [x.id, x])), productMap = new Map(products.map(x => [x.id, x])), lotMap = new Map(lots.map(x => [x.id, x]));
  const seenRequisitions = new Set<string>();
  const visibleBatches = batches.filter((batch) => {
    const requisitionId = orderMap.get(batch.productionOrderId)?.requisitionId;
    if (!requisitionId) return true;
    if (seenRequisitions.has(requisitionId)) return false;
    seenRequisitions.add(requisitionId);
    return true;
  });
  res.json({ data: visibleBatches.map((batch) => {
    const anchorOrder = orderMap.get(batch.productionOrderId);
    const requisitionOrders = anchorOrder?.requisitionId
      ? orders.filter((order) => order.requisitionId === anchorOrder.requisitionId)
      : anchorOrder ? [anchorOrder] : [];
    const prices = new Map(purchaseRates);
    weightedLinePrices(requisitionOrders.flatMap((item) => item.lines)).forEach((price, productId) => prices.set(productId, price));
    const inputMap = new Map<string, any>();
    for (const order of requisitionOrders) {
      for (const line of order.lines) {
        const current = inputMap.get(line.productId);
        if (current) current.requiredQty += Number(line.wasteAdjustedQty);
        else {
          const product = productMap.get(line.productId);
          inputMap.set(line.productId, { ...line, product, category: product?.type === "PACKAGING" ? "PACKAGING" : "RAW_MATERIAL", requiredQty: Number(line.wasteAdjustedQty), unitPrice: Number(prices.get(line.productId) ?? product?.amount ?? 0) });
        }
      }
    }
    const enrichedOrders = requisitionOrders.map((order) => ({
      ...order,
      fgProduct: productMap.get(order.finishedProductId),
      lines: order.lines.map((line) => ({ ...line, product: productMap.get(line.productId), requiredQty: Number(line.wasteAdjustedQty) })),
    }));
    const enrichedOrder = anchorOrder ? { ...anchorOrder, fgProduct: productMap.get(anchorOrder.finishedProductId), lines: [...inputMap.values()] } : null;
    return {
      ...batch,
      status: batch.status === DocumentStatus.SUBMITTED ? "AWAITING_APPROVAL" : batch.status,
      batchNumber: batch.number,
      order: enrichedOrder,
      productionOrder: enrichedOrder,
      productionOrders: enrichedOrders,
      finishedGoods: enrichedOrders.map((order) => ({ orderId: order.id, orderNumber: order.number, product: order.fgProduct, plannedQty: Number(order.plannedQty), expectedQty: Number(order.plannedQty) * (1 - Number(order.expectedWastePercent) / 100), wastePercent: Number(order.expectedWastePercent) })),
      product: anchorOrder ? productMap.get(anchorOrder.finishedProductId) : null,
      fgProduct: anchorOrder ? productMap.get(anchorOrder.finishedProductId) : null,
      fgLot: batch.fgLotId ? lotMap.get(batch.fgLotId) : null,
      requisitionId: anchorOrder?.requisitionId ?? null,
      requisitionNumber: anchorOrder?.requisition?.number ?? null,
      plannedQty: requisitionOrders.reduce((sum, order) => sum + Number(order.plannedQty), 0),
      actualQty: Number(batch.actualOutputQty ?? 0),
      plannedWastePct: requisitionOrders.length ? requisitionOrders.reduce((sum, order) => sum + Number(order.expectedWastePercent), 0) / requisitionOrders.length : 0,
      actualWastePct: Number(batch.actualWastePercent ?? 0),
      variancePct: Number(batch.wasteVariancePercent ?? 0),
      metrics: metrics(batch, rates, prices),
    };
  }) });
});

const managerWhere = (organizationId: string, userId: string) => ({
  organizationId,
  userId,
  isActive: true,
  user: { isActive: true },
  organization: { isActive: true },
  role: { code: "MANAGER" },
});

batchesRouter.post("/:id/approve", async (req, res) => {
  const organizationId = req.tenantId!, userId = req.auth!.id;
  const manager = await prisma.organizationMember.findFirst({ where: managerWhere(organizationId, userId) });
  if (!manager) return res.status(403).json({ error: { message: "Only a manager can approve finished-good details." } });
  const result = await prisma.$transaction(async (tx) => {
    await lockDocument(tx, "ProductionBatch", req.params.id, organizationId);
    const batch = await tx.productionBatch.findFirst({ where: { id: req.params.id, organizationId } });
    if (!batch) throw new StockError("NOT_FOUND", "Production batch not found.", 404);
    if (batch.status !== DocumentStatus.SUBMITTED) throw new StockError("INVALID_STATUS", "Only a batch awaiting approval can be approved.");
    const anchor = await tx.productionOrder.findFirst({ where: { id: batch.productionOrderId, organizationId } });
    if (!anchor) throw new StockError("INVALID_ORDER", "Production order not found.", 422);
    const orders = anchor.requisitionId
      ? await tx.productionOrder.findMany({ where: { organizationId, requisitionId: anchor.requisitionId } })
      : [anchor];
    const updated = await tx.productionBatch.update({ where: { id: batch.id }, data: { status: DocumentStatus.READY } });
    await tx.productionOrder.updateMany({ where: { id: { in: orders.map((order) => order.id) } }, data: { status: DocumentStatus.READY } });
    return updated;
  });
  res.json({ data: result });
});

batchesRouter.delete("/:id", async (req, res) => {
  const organizationId = req.tenantId!, userId = req.auth!.id;
  const manager = await prisma.organizationMember.findFirst({ where: managerWhere(organizationId, userId) });
  if (!manager) return res.status(403).json({ error: { message: "Only a manager can delete a production batch." } });
  await prisma.$transaction(async (tx) => {
    await lockDocument(tx, "ProductionBatch", req.params.id, organizationId);
    const batch = await tx.productionBatch.findFirst({ where: { id: req.params.id, organizationId } });
    if (!batch) throw new StockError("NOT_FOUND", "Production batch not found.", 404);
    if (batch.status === DocumentStatus.COMPLETED) throw new StockError("BATCH_RECEIVED", "A completed batch cannot be deleted because its finished materials are already in FM Store.");
    const anchor = await tx.productionOrder.findFirst({ where: { id: batch.productionOrderId, organizationId } });
    if (!anchor) throw new StockError("INVALID_ORDER", "Production order not found.", 422);
    const orders = anchor.requisitionId
      ? await tx.productionOrder.findMany({ where: { organizationId, requisitionId: anchor.requisitionId } })
      : [anchor];
    const orderIds = orders.map((order) => order.id);
    const issues = await tx.materialIssue.findMany({ where: { organizationId, productionOrderId: { in: orderIds } }, include: { lines: true } });
    for (const issue of issues) {
      for (const line of issue.lines) {
        if (!line.lotId || !line.fromBinId) throw new StockError("INVALID_DISPATCH", "The linked RM dispatch is missing its original lot or bin.");
        await postStock(tx, {
          organizationId,
          binId: line.fromBinId,
          productId: line.productId,
          lotId: line.lotId,
          uomId: line.uomId,
          quantity: line.quantity,
          direction: "IN",
          storeType: "RM_STORE",
          movementType: "ADJUSTMENT",
          documentType: "BATCH_DELETION",
          documentId: batch.number,
          sourceDocumentId: batch.id,
          sourceLineId: line.id,
          referenceType: "MATERIAL_ISSUE_REVERSAL",
          referenceId: issue.id,
          referenceNumber: issue.number,
          postingKey: "BATCH-DELETE:" + batch.id + ":" + line.id,
          performedById: userId,
          note: "RM returned automatically after deleting " + batch.number,
        });
      }
    }
    await tx.productionOrderLine.updateMany({ where: { productionOrderId: { in: orderIds } }, data: { issuedQty: new Prisma.Decimal(0) } });
    await tx.materialIssue.deleteMany({ where: { id: { in: issues.map((issue) => issue.id) } } });
    await tx.productionOrder.updateMany({ where: { id: { in: orderIds } }, data: { status: DocumentStatus.APPROVED } });
    await tx.productionBatch.delete({ where: { id: batch.id } });
    await tx.lot.deleteMany({ where: { organizationId, OR: [{ productionBatchId: batch.id }, ...(batch.fgLotId ? [{ id: batch.fgLotId }] : [])], balances: { none: {} } } });
  }, { timeout: 20000 });
  res.status(204).send();
});

const pricedLine = z.object({ productId: z.string().uuid().nullish(), description: z.string().trim().min(1).max(160), quantity: z.coerce.number().nonnegative(), unitPrice: z.coerce.number().nonnegative() });
const schema = z.object({
  productionOrderId: z.string().uuid(),
  startedAt: z.string().optional(), completedAt: z.string().optional(),
  manufactureDate: z.string().optional(), expiryDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
  inputs: z.array(pricedLine.extend({ category: z.enum(["RAW_MATERIAL", "PACKAGING", "FUEL", "OTHER"]) })).min(1),
  outputs: z.array(pricedLine.extend({ lotCode: z.string().trim().max(80).optional() })).min(1),
  costs: z.array(pricedLine.omit({ productId: true }).extend({ quantity: z.coerce.number().positive() })).default([]),
});

batchesRouter.put("/:id", async (req, res) => {
  const data = schema.parse(req.body), organizationId = req.tenantId!;
  const batch = await prisma.productionBatch.findFirst({ where: { id: req.params.id, organizationId } });
  if (!batch) return res.status(404).json({ error: { message: "Production batch not found" } });
  if (batch.status !== DocumentStatus.IN_PRODUCTION) return res.status(409).json({ error: { message: "Only an In Production batch can be updated." } });
  const order = await prisma.productionOrder.findFirst({ where: { id: batch.productionOrderId, organizationId }, include: { lines: true } });
  if (!order || data.productionOrderId !== order.id) return res.status(422).json({ error: { message: "Production order does not match this batch." } });
  const requisitionOrders = order.requisitionId
    ? await prisma.productionOrder.findMany({ where: { organizationId, requisitionId: order.requisitionId }, include: { lines: true } })
    : [order];
  const ids = [...new Set([...data.inputs, ...data.outputs].flatMap((line) => line.productId ? [line.productId] : []))];
  const selectedProducts = await prisma.product.findMany({ where: { organizationId, id: { in: ids } } });
  if (ids.length !== selectedProducts.length) return res.status(422).json({ error: { message: "Selected product unavailable" } });
  const prices = new Map(selectedProducts.map((product) => [product.id, Number(product.amount ?? 0)]));
  (await procurementPrices(organizationId, ids)).forEach((price, productId) => prices.set(productId, price));
  weightedLinePrices(requisitionOrders.flatMap((item) => item.lines)).forEach((price, productId) => prices.set(productId, price));
  const rawQty = data.inputs.filter((line) => line.category === "RAW_MATERIAL").reduce((sum, line) => sum + line.quantity, 0);
  const outputQty = data.outputs.reduce((sum, line) => sum + line.quantity, 0);
  const wasteQty = Math.max(0, rawQty - outputQty), wastePct = rawQty ? wasteQty / rawQty * 100 : 0;
  const result = await prisma.$transaction(async (tx) => {
    const primary = data.outputs.find((line) => requisitionOrders.some((item) => item.finishedProductId === line.productId)) ?? data.outputs[0];
    const lot = await tx.lot.create({ data: {
      organizationId, productId: primary.productId ?? order.finishedProductId, code: primary.lotCode || `LOT-FG-${Date.now()}`,
      manufactureDate: data.manufactureDate ? new Date(data.manufactureDate) : new Date(), expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      qualityStatus: QualityStatus.RELEASED,
    } });
    const updated = await tx.productionBatch.update({ where: { id: batch.id }, data: {
      actualRMConsumed: new Prisma.Decimal(rawQty), actualOutputQty: new Prisma.Decimal(outputQty), actualWasteQty: new Prisma.Decimal(wasteQty),
      actualWastePercent: new Prisma.Decimal(wastePct.toFixed(2)), wasteVariancePercent: new Prisma.Decimal((wastePct - Number(order.expectedWastePercent)).toFixed(2)),
      fgLotId: lot.id, status: DocumentStatus.SUBMITTED, startedAt: data.startedAt ? new Date(data.startedAt) : batch.startedAt,
      completedAt: null, notes: data.notes,
      inputLines: { deleteMany: {}, create: data.inputs.map((line) => ({ ...line, productId: line.productId || null, quantity: new Prisma.Decimal(line.quantity), unitPrice: new Prisma.Decimal(line.productId ? prices.get(line.productId) ?? 0 : 0) })) },
      outputLines: { deleteMany: {}, create: data.outputs.map((line) => ({ ...line, productId: line.productId || null, quantity: new Prisma.Decimal(line.quantity), unitPrice: new Prisma.Decimal(line.unitPrice) })) },
      costLines: { deleteMany: {}, create: data.costs.map((line) => ({ description: line.description, quantity: new Prisma.Decimal(line.quantity), unitPrice: new Prisma.Decimal(line.unitPrice) })) },
    }, include: { inputLines: true, outputLines: true, costLines: true } });
    await tx.lot.update({ where: { id: lot.id }, data: { productionBatchId: updated.id } });
    await tx.productionOrder.updateMany({ where: { id: { in: requisitionOrders.map((item) => item.id) } }, data: { status: DocumentStatus.SUBMITTED } });
    return { batch: updated, lot };
  });
  res.json({ data: result });
});

batchesRouter.post("/", async (req, res) => {
  const data = schema.parse(req.body), organizationId = req.tenantId!;
  const order = await prisma.productionOrder.findFirst({ where: { id: data.productionOrderId, organizationId }, include: { lines: true } });
  if (!order) return res.status(404).json({ error: { message: "Production order not found" } });
  const ids = [...new Set([...data.inputs, ...data.outputs].flatMap(x => x.productId ? [x.productId] : []))];
  const selectedProducts = await prisma.product.findMany({ where: { organizationId, id: { in: ids } } });
  if (ids.length !== selectedProducts.length) return res.status(422).json({ error: { message: "Selected product unavailable" } });
  const prices = new Map(selectedProducts.map(product => [product.id, Number(product.amount ?? 0)]));
  (await procurementPrices(organizationId, ids)).forEach((price, productId) => prices.set(productId, price));
  weightedLinePrices(order.lines).forEach((price, productId) => prices.set(productId, price));
  const rawQty = data.inputs.filter(x => x.category === "RAW_MATERIAL").reduce((s, x) => s + x.quantity, 0);
  const outputQty = data.outputs.reduce((s, x) => s + x.quantity, 0);
  const wasteQty = Math.max(0, rawQty - outputQty), wastePct = rawQty ? wasteQty / rawQty * 100 : 0;
  const result = await prisma.$transaction(async tx => {
    const batchCount = await tx.productionBatch.count({ where: { organizationId } });
    const number = `BATCH-${new Date().getFullYear()}-${String(batchCount + 1).padStart(4, "0")}`;
    const primary = data.outputs.find(x => x.productId === order.finishedProductId) ?? data.outputs[0];
    const lot = await tx.lot.create({ data: {
      organizationId, productId: primary.productId ?? order.finishedProductId,
      code: primary.lotCode || `LOT-FG-${Date.now()}`,
      manufactureDate: data.manufactureDate ? new Date(data.manufactureDate) : new Date(),
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      qualityStatus: QualityStatus.RELEASED,
    } });
    const batch = await tx.productionBatch.create({ data: {
      organizationId, number, productionOrderId: order.id,
      actualRMConsumed: new Prisma.Decimal(rawQty), actualOutputQty: new Prisma.Decimal(outputQty),
      actualWasteQty: new Prisma.Decimal(wasteQty), actualWastePercent: new Prisma.Decimal(wastePct.toFixed(2)),
      wasteVariancePercent: new Prisma.Decimal((wastePct - Number(order.expectedWastePercent)).toFixed(2)),
      fgLotId: lot.id, status: DocumentStatus.SUBMITTED,
      startedAt: data.startedAt ? new Date(data.startedAt) : new Date(), completedAt: data.completedAt ? new Date(data.completedAt) : new Date(), notes: data.notes,
      inputLines: { create: data.inputs.map(x => ({ ...x, productId: x.productId || null, quantity: new Prisma.Decimal(x.quantity), unitPrice: new Prisma.Decimal(x.productId ? prices.get(x.productId) ?? 0 : 0) })) },
      outputLines: { create: data.outputs.map(x => ({ ...x, productId: x.productId || null, quantity: new Prisma.Decimal(x.quantity), unitPrice: new Prisma.Decimal(x.productId ? prices.get(x.productId) ?? 0 : 0) })) },
      costLines: { create: data.costs.map(x => ({ description: x.description, quantity: new Prisma.Decimal(x.quantity), unitPrice: new Prisma.Decimal(x.unitPrice) })) },
    }, include: { inputLines: true, outputLines: true, costLines: true } });
    await tx.lot.update({ where: { id: lot.id }, data: { productionBatchId: batch.id } });
    await tx.productionOrder.update({ where: { id: order.id }, data: { status: DocumentStatus.SUBMITTED } });
    return { batch, lot };
  });
  res.status(201).json({ data: result });
});
