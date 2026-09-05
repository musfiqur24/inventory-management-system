import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";

export const categoriesRouter = Router();

categoriesRouter.get("/", async (req, res) => {
  const categories = await prisma.productCategory.findMany({
    where: { organizationId: req.tenantId },
    include: {
      parent: true,
      children: true,
      _count: {
        select: { products: true, children: true },
      },
    },
    orderBy: [{ level: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  res.json({ data: categories });
});

const createCategorySchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  level: z.coerce.number().int().min(1).max(5),
  code: z.string().min(1),
  name: z.string().min(1),
  sortOrder: z.coerce.number().int().default(0),
});

categoriesRouter.post("/", async (req, res) => {
  const parsed = createCategorySchema.parse(req.body);
  const category = await prisma.productCategory.create({
    data: {
      organizationId: req.tenantId!,
      parentId: parsed.parentId || null,
      level: parsed.level,
      code: parsed.code.toUpperCase().trim(),
      name: parsed.name.trim(),
      sortOrder: parsed.sortOrder,
    },
  });
  res.status(201).json({ data: category });
});
