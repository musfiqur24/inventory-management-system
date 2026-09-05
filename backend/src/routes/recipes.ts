import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { Prisma, DocumentStatus } from "../generated/prisma/client.js";

export const recipesRouter = Router();

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
      outputUom,
      lines,
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
  wastePercent: z.coerce.number().min(0).max(50).default(2.5),
  lines: z.array(
    z.object({
      rawProductId: z.string().uuid(),
      uomId: z.string().uuid(),
      quantityPerOutput: z.coerce.number().positive(),
    })
  ).min(1, "At least one ingredient is required"),
});

recipesRouter.post("/", async (req, res) => {
  const parsed = createRecipeSchema.parse(req.body);

  // Auto-increment version if existing recipe exists
  const latestRecipe = await prisma.recipe.findFirst({
    where: {
      organizationId: req.tenantId,
      finishedProductId: parsed.finishedProductId,
    },
    orderBy: { version: "desc" },
  });

  const nextVersion = latestRecipe ? latestRecipe.version + 1 : parsed.version;

  const recipe = await prisma.recipe.create({
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

  res.status(201).json({ data: recipe });
});
