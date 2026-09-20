import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { Prisma, DocumentStatus, QualityStatus } from "../generated/prisma/client.js";
export const batchesRouter = Router();
const round = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;
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
    prisma.productionOrder.findMany({ where: { organizationId: req.tenantId }, include: { lines: true } }),
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
  res.json({ data: batches.map(b => { const order = orderMap.get(b.productionOrderId); const prices = new Map(purchaseRates); order?.lines.forEach(line => { if (line.unitPrice != null) prices.set(line.productId, Number(line.unitPrice)); }); return { ...b, batchNumber: b.number, order, productionOrder: order, product: order ? productMap.get(order.finishedProductId) : null, fgProduct: order ? productMap.get(order.finishedProductId) : null, fgLot: b.fgLotId ? lotMap.get(b.fgLotId) : null, plannedQty: order ? Number(order.plannedQty) : 0, actualQty: Number(b.actualOutputQty ?? 0), plannedWastePct: order ? Number(order.expectedWastePercent) : 0, actualWastePct: Number(b.actualWastePercent ?? 0), variancePct: Number(b.wasteVariancePercent ?? 0), metrics: metrics(b, rates, prices) }; }) });
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

batchesRouter.post("/", async (req, res) => {
  const data = schema.parse(req.body), organizationId = req.tenantId!;
  const order = await prisma.productionOrder.findFirst({ where: { id: data.productionOrderId, organizationId }, include: { lines: true } });
  if (!order) return res.status(404).json({ error: { message: "Production order not found" } });
  const ids = [...new Set([...data.inputs, ...data.outputs].flatMap(x => x.productId ? [x.productId] : []))];
  const selectedProducts = await prisma.product.findMany({ where: { organizationId, id: { in: ids } } });
  if (ids.length !== selectedProducts.length) return res.status(422).json({ error: { message: "Selected product unavailable" } });
  const prices = new Map(selectedProducts.map(product => [product.id, Number(product.amount ?? 0)]));
  order.lines.forEach(line => { if (line.unitPrice != null) prices.set(line.productId, Number(line.unitPrice)); });
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
      fgLotId: lot.id, status: DocumentStatus.CLOSED,
      startedAt: data.startedAt ? new Date(data.startedAt) : new Date(), completedAt: data.completedAt ? new Date(data.completedAt) : new Date(), notes: data.notes,
      inputLines: { create: data.inputs.map(x => ({ ...x, productId: x.productId || null, quantity: new Prisma.Decimal(x.quantity), unitPrice: new Prisma.Decimal(x.productId ? prices.get(x.productId) ?? 0 : 0) })) },
      outputLines: { create: data.outputs.map(x => ({ ...x, productId: x.productId || null, quantity: new Prisma.Decimal(x.quantity), unitPrice: new Prisma.Decimal(x.productId ? prices.get(x.productId) ?? 0 : 0) })) },
      costLines: { create: data.costs.map(x => ({ description: x.description, quantity: new Prisma.Decimal(x.quantity), unitPrice: new Prisma.Decimal(x.unitPrice) })) },
    }, include: { inputLines: true, outputLines: true, costLines: true } });
    await tx.lot.update({ where: { id: lot.id }, data: { productionBatchId: batch.id } });
    await tx.productionOrder.update({ where: { id: order.id }, data: { status: DocumentStatus.CLOSED } });
    return { batch, lot };
  });
  res.status(201).json({ data: result });
});
