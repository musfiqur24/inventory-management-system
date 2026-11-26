import { hasPermission } from "../modules/rbac.js";
import { validateProductLines } from "../services/references.js";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { Prisma, DocumentStatus } from "../generated/prisma/client.js";

export const recipesRouter = Router();

const requireRecipeManager = (req: any, res: any) => {
  if (hasPermission(req.auth,req.tenantId,"feed.recipes.write")) return true;
  res.status(403).json({ error: { code: "FORBIDDEN", message: "Only a manager can create, edit, or delete recipes." } });
  return false;
};

recipesRouter.get("/", async (req, res) => {
  const recipes = await prisma.recipe.findMany({
    where: { organizationId: req.tenantId },
    include: {
      lines: true,
    },
    orderBy: [{ finishedProductId: "asc" }, { version: "desc" }],
  });

  const [products, uoms] = await Promise.all([
    prisma.product.findMany({ where: { organizationId: req.tenantId } }),
    prisma.unitOfMeasure.findMany({ where: { organizationId: req.tenantId } }),
  ]);

  const prodMap = new Map(products.map((p) => [p.id, p]));
  const uomMap = new Map(uoms.map((u) => [u.id, u]));

  const enriched = recipes.map((rec) => {
    const finishedProduct = prodMap.get(rec.finishedProductId);
    const outputUom = uomMap.get(rec.outputUomId);

    const lines = rec.lines.map((l) => {
      const rawProduct = prodMap.get(l.rawProductId);
      const uom = uomMap.get(l.uomId);
      const percentage =
        Number(rec.outputQty) > 0
          ? ((Number(l.quantityPerOutput) / Number(rec.outputQty)) * 100).toFixed(2)
          : "0";

      return {
        ...l,
        rawProduct,
        uom,
        percentage,
      };
    });

    const totalIngredientsQty = lines.reduce(
      (sum, l) => sum + Number(l.quantityPerOutput),
      0
    );

    return {
      ...rec,
      finishedProduct,
      name: finishedProduct?.name ?? `Recipe v${rec.version}`,
      code: `${finishedProduct?.sku ?? "RECIPE"}-V${rec.version}`,
      targetTonnage: Number(rec.outputQty) / 1000,
      isActive: rec.status === DocumentStatus.APPROVED,
      fgProduct: finishedProduct,
      outputUom,
      lines,
      ingredients: lines.map((line) => ({
        ...line,
        rawMaterial: line.rawProduct,
        quantityPerTon:
          Number(rec.outputQty) > 0
            ? Number(line.quantityPerOutput) * (1000 / Number(rec.outputQty))
            : 0,
      })),
      totalIngredientsQty,
    };
  });

  res.json({ data: enriched });
});

const createRecipeSchema = z.object({
  finishedProductId: z.string().uuid(),
  version: z.coerce.number().int().positive().default(1),
  outputQty: z.coerce.number().positive().default(1000), // Default 1 Ton = 1000 kg
  outputUomId: z.string().uuid(),
  wastePercent: z.coerce.number().min(0).max(50).default(0),
  lines: z.array(
    z.object({
      rawProductId: z.string().uuid(),
      uomId: z.string().uuid(),
      quantityPerOutput: z.coerce.number().positive(),
    })
  ).min(1, "At least one ingredient is required"),
});

recipesRouter.post("/", async (req, res) => {
  if (!requireRecipeManager(req, res)) return;
  const parsed = createRecipeSchema.parse(req.body);
  await validateProductLines(prisma,req.tenantId!,[{productId:parsed.finishedProductId,uomId:parsed.outputUomId}],["FINISHED_GOOD"]);
  await validateProductLines(prisma,req.tenantId!,parsed.lines.map(l=>({productId:l.rawProductId,uomId:l.uomId})),["RAW_MATERIAL","PACKAGING"]);

  const recipe=await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${req.tenantId!} FOR UPDATE`;
  // Auto-increment version if existing recipe exists
  const latestRecipe = await tx.recipe.findFirst({
    where: {
      organizationId: req.tenantId,
      finishedProductId: parsed.finishedProductId,
    },
    orderBy: { version: "desc" },
  });

  const nextVersion = latestRecipe ? latestRecipe.version + 1 : parsed.version;

  return tx.recipe.create({
    data: {
      organizationId: req.tenantId!,
      finishedProductId: parsed.finishedProductId,
      version: nextVersion,
      outputQty: new Prisma.Decimal(parsed.outputQty),
      outputUomId: parsed.outputUomId,
      wastePercent: new Prisma.Decimal(parsed.wastePercent),
      status: DocumentStatus.APPROVED,
      effectiveFrom: new Date(),
      lines: {
        create: parsed.lines.map((l) => ({
          rawProductId: l.rawProductId,
          uomId: l.uomId,
          quantityPerOutput: new Prisma.Decimal(l.quantityPerOutput),
        })),
      },
    },
    include: {
      lines: true,
    },
  });

  });
  res.status(201).json({ data: recipe });
});


recipesRouter.put("/:id", async (req, res) => {
  if (!requireRecipeManager(req, res)) return;
  const parsed = createRecipeSchema.parse(req.body);
  await validateProductLines(prisma,req.tenantId!,[{productId:parsed.finishedProductId,uomId:parsed.outputUomId}],["FINISHED_GOOD"]);
  await validateProductLines(prisma,req.tenantId!,parsed.lines.map(l=>({productId:l.rawProductId,uomId:l.uomId})),["RAW_MATERIAL","PACKAGING"]);
  const existing = await prisma.recipe.findFirst({
    where: { id: req.params.id, organizationId: req.tenantId },
  });
  if (!existing) return res.status(404).json({ error: { message: "Recipe not found" } });

  if(await prisma.productionOrder.count({where:{organizationId:req.tenantId!,recipeId:existing.id}}))return res.status(409).json({error:{message:"Used recipe versions are immutable. Create a new version."}});
  if(existing.status==="APPROVED")return res.status(409).json({error:{message:"Approved recipe versions are immutable. Create a new version."}});
  const recipe = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Recipe" WHERE id=${existing.id} FOR UPDATE`;
    if(await tx.productionOrder.count({where:{recipeId:existing.id}}))throw new Error("Recipe became referenced; create a new version.");
    await tx.recipeLine.deleteMany({ where: { recipeId: existing.id } });
    return tx.recipe.update({
      where: { id: existing.id },
      data: {
        finishedProductId: parsed.finishedProductId,
        outputQty: new Prisma.Decimal(parsed.outputQty),
        outputUomId: parsed.outputUomId,
        wastePercent: new Prisma.Decimal(parsed.wastePercent),
        lines: {
          create: parsed.lines.map((line) => ({
            rawProductId: line.rawProductId,
            uomId: line.uomId,
            quantityPerOutput: new Prisma.Decimal(line.quantityPerOutput),
          })),
        },
      },
      include: { lines: true },
    });
  });
  res.json({ data: recipe });
});

recipesRouter.delete("/:id", async (req, res) => {
  if (!requireRecipeManager(req, res)) return;
  const existing = await prisma.recipe.findFirst({
    where: { id: req.params.id, organizationId: req.tenantId },
  });
  if (!existing) return res.status(404).json({ error: { message: "Recipe not found" } });

  const linkedOrders = await prisma.productionOrder.count({
    where: { organizationId: req.tenantId, recipeId: existing.id },
  });
  if (linkedOrders > 0) {
    return res.status(409).json({
      error: { message: "This recipe is used by production requisitions and cannot be deleted." },
    });
  }

  await prisma.recipe.delete({ where: { id: existing.id } });
  res.status(204).send();
});
