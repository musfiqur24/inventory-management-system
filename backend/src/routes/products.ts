import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { Prisma, ProductType } from "../generated/prisma/client.js";

export const productsRouter = Router();

productsRouter.get("/", async (req, res) => {
  const typeFilter = req.query.type as ProductType | undefined;
  const products = await prisma.product.findMany({
    where: {
      organizationId: req.tenantId,
      isActive: true,
      ...(typeFilter ? { type: typeFilter } : {}),
    },
    include: {
      category: {
        include: {
          parent: {
            include: {
              parent: { include: { parent: true } },
            },
          },
        },
      },
      baseUom: true,
      balances: {
        include: {
          bin: true,
          lot: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Calculate total in-stock balance for each product
  const enriched = products.map((prod) => {
    const totalQty = prod.balances.reduce(
      (sum, b) => sum + Number(b.quantity),
      0
    );
    const isBelowReorder =
      prod.reorderLevel !== null && totalQty <= Number(prod.reorderLevel);

    return {
      ...prod,
      totalQty,
      isBelowReorder,
    };
  });

  res.json({ data: enriched });
});

const createProductSchema = z.object({
  sku: z.string().min(2),
  name: z.string().min(2),
  type: z.enum(["RAW_MATERIAL", "FINISHED_GOOD", "PACKAGING", "BY_PRODUCT"]),
  categoryId: z.string().uuid(),
  baseUomId: z.string().uuid(),
  shelfLifeDays: z.coerce.number().int().positive().optional(),
  reorderLevel: z.coerce.number().positive().optional(),
});

productsRouter.post("/", async (req, res) => {
  const parsed = createProductSchema.parse(req.body);
  const [category, uom] = await Promise.all([
    prisma.subSubLayer.findFirst({ where: { id: parsed.categoryId, organizationId: req.tenantId! } }),
    prisma.unitOfMeasure.findFirst({ where: { id: parsed.baseUomId, organizationId: req.tenantId! } }),
  ]);
  if (!category || !uom) return res.status(422).json({ error: { code: 'INVALID_REFERENCE', message: 'Select a Sub- Sub Layer and UOM in this organization.' } });
  const product = await prisma.product.create({
    data: {
      organizationId: req.tenantId!,
      sku: parsed.sku.toUpperCase().trim(),
      name: parsed.name.trim(),
      type: parsed.type,
      categoryId: parsed.categoryId,
      baseUomId: parsed.baseUomId,
      shelfLifeDays: parsed.shelfLifeDays,
      reorderLevel: parsed.reorderLevel ? new Prisma.Decimal(parsed.reorderLevel) : null,
    },
    include: {
      category: true,
      baseUom: true,
    },
  });
  res.status(201).json({ data: product });
});
