import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";

export const categoriesRouter = Router();
const names = ["Group Layer", "Control Layer", "Sub Layer", "Sub- Sub Layer"];

categoriesRouter.get("/", async (req, res) => {
  const where = { organizationId: req.tenantId! };
  const orderBy = [{ sortOrder: "asc" as const }, { name: "asc" as const }];
  const layers = await Promise.all([
    prisma.groupLayer.findMany({ where, orderBy }),
    prisma.controlLayer.findMany({ where, orderBy }),
    prisma.subLayer.findMany({ where, orderBy }),
    prisma.subSubLayer.findMany({ where, orderBy }),
  ]);
  // Keep the existing flat API shape for the setup page and product selectors.
  res.json({ data: layers.flatMap((rows, index) => rows.map(row => ({ ...row, level: index + 1, parentId: 'parentId' in row ? row.parentId : null }))) });
});

const createCategorySchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  level: z.coerce.number().int().min(1).max(4),
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  sortOrder: z.coerce.number().int().default(0),
}).superRefine((value, ctx) => {
  if (value.level > 1 && !value.parentId) ctx.addIssue({ code: 'custom', path: ['parentId'], message: 'Select a parent layer' });
  if (value.level === 1 && value.parentId) ctx.addIssue({ code: 'custom', path: ['parentId'], message: 'Group Layer cannot have a parent' });
});

categoriesRouter.post("/", async (req, res) => {
  const parsed = createCategorySchema.parse(req.body);
  const organizationId = req.tenantId!;
  if (parsed.level > 1) {
    const where = { id: parsed.parentId!, organizationId };
    const parent = parsed.level === 2 ? await prisma.groupLayer.findFirst({ where })
      : parsed.level === 3 ? await prisma.controlLayer.findFirst({ where })
      : await prisma.subLayer.findFirst({ where });
    if (!parent) return res.status(422).json({ error: { code: 'INVALID_PARENT', message: `Select a valid ${names[parsed.level - 2]} in this organization.` } });
  }
  const data = { organizationId, code: parsed.code.toUpperCase(), name: parsed.name, sortOrder: parsed.sortOrder };
  try {
    const category = parsed.level === 1 ? await prisma.groupLayer.create({ data })
      : parsed.level === 2 ? await prisma.controlLayer.create({ data: { ...data, parentId: parsed.parentId! } })
      : parsed.level === 3 ? await prisma.subLayer.create({ data: { ...data, parentId: parsed.parentId! } })
      : await prisma.subSubLayer.create({ data: { ...data, parentId: parsed.parentId! } });
    return res.status(201).json({ data: { ...category, level: parsed.level, parentId: parsed.parentId ?? null } });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return res.status(409).json({ error: { code: 'CONFLICT', message: `${names[parsed.level - 1]} code "${data.code}" already exists in this organization.` } });
    }
    throw error;
  }
});
