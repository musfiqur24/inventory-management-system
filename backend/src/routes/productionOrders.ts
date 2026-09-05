import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { Prisma, DocumentStatus } from "../generated/prisma/client.js";

export const productionOrdersRouter = Router();

productionOrdersRouter.get("/", async (req, res) => {
  const orders = await prisma.productionOrder.findMany({
    where: { organizationId: req.tenantId },
    include: {
      lines: true,
    },
    orderBy: { scheduledFor: "desc" },
  });

  const [products, uoms, recipes, batches, issues] = await Promise.all([
    prisma.product.findMany({ where: { organizationId: req.tenantId } }),
    prisma.unitOfMeasure.findMany({ where: { organizationId: req.tenantId } }),
    prisma.recipe.findMany({ where: { organizationId: req.tenantId } }),
    prisma.productionBatch.findMany({ where: { organizationId: req.tenantId } }),
    prisma.materialIssue.findMany({ where: { organizationId: req.tenantId } }),
  ]);

  const prodMap = new Map(products.map((p) => [p.id, p]));
  const uomMap = new Map(uoms.map((u) => [u.id, u]));
  const recMap = new Map(recipes.map((r) => [r.id, r]));

  const enriched = orders.map((ord) => {
    const finishedProduct = prodMap.get(ord.finishedProductId);
    const plannedUom = uomMap.get(ord.plannedUomId);
    const recipe = recMap.get(ord.recipeId);
    const orderBatches = batches.filter((b) => b.productionOrderId === ord.id);
    const orderIssues = issues.filter((i) => i.productionOrderId === ord.id);

    const lines = ord.lines.map((l) => ({
      ...l,
      product: prodMap.get(l.productId),
      uom: uomMap.get(l.uomId),
    }));

    const totalRawMaterialRequired = lines.reduce(
      (sum, l) => sum + Number(l.wasteAdjustedQty),
      0
    );

    return {
      ...ord,
      finishedProduct,
      plannedUom,
      recipe,
      lines,
      batches: orderBatches,
      issues: orderIssues,
      totalRawMaterialRequired,
    };
  });

  res.json({ data: enriched });
});

// Preview scaling calculation without saving
productionOrdersRouter.post("/preview-scale", async (req, res) => {
  const { recipeId, plannedQty, expectedWastePercent } = req.body;
  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    include: { lines: true },
  });

  if (!recipe) {
    return res.status(404).json({ error: { message: "Recipe not found" } });
  }

  const wastePct = expectedWastePercent !== undefined ? Number(expectedWastePercent) : Number(recipe.wastePercent);
  const scaleRatio = Number(plannedQty) / Number(recipe.outputQty);

  const lines = recipe.lines.map((l) => {
    const recipeQty = Number(l.quantityPerOutput) * scaleRatio;
    const wasteAdjustedQty = recipeQty * (1 + wastePct / 100);
    return {
      productId: l.rawProductId,
      uomId: l.uomId,
      recipeQty,
      wasteAdjustedQty,
    };
  });

  res.json({
    data: {
      recipeId,
      plannedQty: Number(plannedQty),
      expectedWastePercent: wastePct,
      scaleRatio,
      lines,
    },
  });
});

const createProductionOrderSchema = z.object({
  finishedProductId: z.string().uuid(),
  recipeId: z.string().uuid(),
  plannedQty: z.coerce.number().positive(),
  plannedUomId: z.string().uuid(),
  expectedWastePercent: z.coerce.number().min(0).max(50).optional(),
  scheduledFor: z.string().optional(),
});

productionOrdersRouter.post("/", async (req, res) => {
  const parsed = createProductionOrderSchema.parse(req.body);

  const recipe = await prisma.recipe.findFirst({
    where: { id: parsed.recipeId, organizationId: req.tenantId },
    include: { lines: true },
  });

  if (!recipe) {
    return res.status(404).json({ error: { message: "Recipe not found" } });
  }

  const wastePercent =
    parsed.expectedWastePercent !== undefined
      ? parsed.expectedWastePercent
      : Number(recipe.wastePercent);

  const count = await prisma.productionOrder.count({
    where: { organizationId: req.tenantId },
  });
  const year = new Date().getFullYear();
  const number = `FM-REQ-${year}-${String(count + 1).padStart(4, "0")}`;

  const scaleRatio = parsed.plannedQty / Number(recipe.outputQty);

  const order = await prisma.productionOrder.create({
    data: {
      organizationId: req.tenantId!,
      number,
      finishedProductId: parsed.finishedProductId,
      recipeId: parsed.recipeId,
      plannedQty: new Prisma.Decimal(parsed.plannedQty),
      plannedUomId: parsed.plannedUomId,
      expectedWastePercent: new Prisma.Decimal(wastePercent),
      status: DocumentStatus.SUBMITTED,
      scheduledFor: parsed.scheduledFor ? new Date(parsed.scheduledFor) : new Date(),
      lines: {
        create: recipe.lines.map((l) => {
          const recipeQty = Number(l.quantityPerOutput) * scaleRatio;
          const wasteAdjustedQty = recipeQty * (1 + wastePercent / 100);
          return {
            productId: l.rawProductId,
            uomId: l.uomId,
            recipeQty: new Prisma.Decimal(recipeQty),
            wasteAdjustedQty: new Prisma.Decimal(wasteAdjustedQty),
            issuedQty: new Prisma.Decimal(0),
          };
        }),
      },
    },
    include: {
      lines: true,
    },
  });

  res.status(201).json({ data: order });
});
