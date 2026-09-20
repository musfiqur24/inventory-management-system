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
      requisition: true,
    },
    orderBy: { scheduledFor: "desc" },
  });

  const [products, uoms, recipes, batches, issues] = await Promise.all([
    prisma.product.findMany({ where: { organizationId: req.tenantId } }),
    prisma.unitOfMeasure.findMany({ where: { organizationId: req.tenantId } }),
    prisma.recipe.findMany({ where: { organizationId: req.tenantId } }),
    prisma.productionBatch.findMany({
      where: { organizationId: req.tenantId },
    }),
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
      0,
    );

    return {
      ...ord,
      requisitionNumber: ord.requisition?.number ?? ord.number,
      finishedProduct,
      fgProduct: finishedProduct,
      plannedUom,
      uom: plannedUom,
      targetQty: Number(ord.plannedQty) / 1000,
      plannedStartDate: ord.scheduledFor,
      recipe: recipe ? {
        ...recipe,
        name: finishedProduct?.name ?? `Recipe v${recipe.version}`,
        code: `${finishedProduct?.sku ?? "RECIPE"}-V${recipe.version}`,
        targetTonnage: Number(recipe.outputQty) / 1000,
      } : null,
      lines: lines.map((line) => ({
        ...line,
        rawMaterial: line.product,
        requiredQty: Number(line.wasteAdjustedQty),
        issuedQty: Number(line.issuedQty),
      })),
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

  const wastePct =
    expectedWastePercent !== undefined
      ? Number(expectedWastePercent)
      : Number(recipe.wastePercent);
  const scaleRatio = Number(plannedQty) / Number(recipe.outputQty);

  const lines = recipe.lines.map((l) => {
    const recipeQty = Number(l.quantityPerOutput) * scaleRatio;
    const wasteAdjustedQty = recipeQty;
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
      expectedOutputQty: Number(plannedQty) * (1 - wastePct / 100),
      expectedWasteQty: Number(plannedQty) * (wastePct / 100),
      lines,
    },
  });
});

const productionItemSchema = z.object({
  recipeId: z.string().uuid(),
  plannedQty: z.coerce.number().positive(),
  expectedWastePercent: z.coerce.number().min(0).max(50).optional(),
  scheduledFor: z.string().min(1),
});

const createProductionRequisitionSchema = z.object({
  items: z.array(productionItemSchema).min(1).max(20),
  utilities: z.array(z.object({ productId: z.string().uuid(), quantity: z.coerce.number().positive(), unitPrice: z.coerce.number().nonnegative() })).default([]),
}).superRefine((value, context) => {
  const recipes = new Set<string>();
  value.items.forEach((item, index) => {
    if (recipes.has(item.recipeId)) context.addIssue({ code: "custom", path: ["items", index, "recipeId"], message: "The same finished-good recipe cannot be added twice." });
    recipes.add(item.recipeId);
  });
});

productionOrdersRouter.post("/", async (req, res) => {
  const parsed = createProductionRequisitionSchema.parse(req.body);
  const organizationId = req.tenantId!;
  const recipeIds = parsed.items.map((item) => item.recipeId);
  const [recipes, utilityProducts] = await Promise.all([prisma.recipe.findMany({
    where: { id: { in: recipeIds }, organizationId, status: { notIn: [DocumentStatus.CANCELLED, DocumentStatus.REJECTED] } },
    include: { lines: true },
  }), prisma.product.findMany({ where: { organizationId, id: { in: parsed.utilities.map(line => line.productId) }, type: { in: ["PACKAGING", "RAW_MATERIAL"] } } })]);
  if (recipes.length !== recipeIds.length) return res.status(422).json({ error: { message: "One or more recipes are unavailable." } });
  if (utilityProducts.length !== new Set(parsed.utilities.map(line => line.productId)).size) return res.status(422).json({ error: { message: "One or more utility products are unavailable." } });
  if (new Set(recipes.map((recipe) => recipe.finishedProductId)).size !== recipes.length) return res.status(422).json({ error: { message: "The same finished good cannot be included more than once." } });
  const recipeMap = new Map(recipes.map((recipe) => [recipe.id, recipe]));

  const result = await prisma.$transaction(async (tx) => {
    const count = await tx.productionRequisition.count({ where: { organizationId } });
    const year = new Date().getFullYear();
    const requisitionNumber = `FM-REQ-${year}-${String(count + 1).padStart(4, "0")}`;
    const requisition = await tx.productionRequisition.create({
      data: { organizationId, number: requisitionNumber, status: DocumentStatus.SUBMITTED },
    });
    const orders = [];
    for (const [index, item] of parsed.items.entries()) {
      const recipe = recipeMap.get(item.recipeId)!;
      const wastePercent = item.expectedWastePercent ?? Number(recipe.wastePercent);
      const scaleRatio = item.plannedQty / Number(recipe.outputQty);
      orders.push(await tx.productionOrder.create({
        data: {
          organizationId,
          requisitionId: requisition.id,
          number: `${requisitionNumber}-${String(index + 1).padStart(2, "0")}`,
          finishedProductId: recipe.finishedProductId,
          recipeId: recipe.id,
          plannedQty: new Prisma.Decimal(item.plannedQty),
          plannedUomId: recipe.outputUomId,
          expectedWastePercent: new Prisma.Decimal(wastePercent),
          status: DocumentStatus.SUBMITTED,
          scheduledFor: new Date(item.scheduledFor),
          lines: {
            create: recipe.lines.map((line) => {
              const recipeQty = Number(line.quantityPerOutput) * scaleRatio;
              return { productId: line.rawProductId, uomId: line.uomId, recipeQty: new Prisma.Decimal(recipeQty), wasteAdjustedQty: new Prisma.Decimal(recipeQty), issuedQty: new Prisma.Decimal(0) };
            }).concat(index === 0 ? parsed.utilities.map(line => { const product = utilityProducts.find(value => value.id === line.productId)!; return { productId: line.productId, uomId: product.baseUomId, recipeQty: new Prisma.Decimal(line.quantity), wasteAdjustedQty: new Prisma.Decimal(line.quantity), issuedQty: new Prisma.Decimal(0), unitPrice: new Prisma.Decimal(line.unitPrice) }; }) : []),
          },
        },
        include: { lines: true },
      }));
    }
    const recipients = await tx.organizationMember.findMany({ where: { organizationId, isActive: true, user: { isActive: true } }, select: { userId: true } });
    if (recipients.length) await tx.notification.createMany({
      data: recipients.map(({ userId }) => ({ organizationId, recipientId: userId, title: "New production requisition", message: `${requisition.number} contains ${orders.length} finished good${orders.length === 1 ? "" : "s"} and is ready for production planning.` })),
    });
    return { ...requisition, orders };
  }, { timeout: 20000 });

  res.status(201).json({ data: result });
});
