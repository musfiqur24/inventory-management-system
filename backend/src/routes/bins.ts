import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
export const binsRouter = Router();
binsRouter.get("/", async (req, res) => {
  const bins = await prisma.bin.findMany({
    where: {
      organizationId: req.tenantId,
      isActive: true,
      ...(req.query.storeId ? { storeId: String(req.query.storeId) } : {}),
      store: {
        isActive: true,
        ...(req.query.type
          ? {
              storeType: z.enum(["RM_STORE", "FM_STORE"]).parse(req.query.type),
            }
          : {}),
      },
    },
    include: {
      store: true,
      balances: { include: { product: true, lot: true, uom: true } },
    },
    orderBy: [{ storeId: "asc" }, { code: "asc" }],
  });
  res.json({
    data: bins.map((bin) => ({
      ...bin,
      warehouseType: bin.store.storeType,
      siteId: bin.store.siteId,
      stockPositions: bin.balances.filter((b) => b.quantity.gt(0)).length,
    })),
  });
});
const schema = z.object({
  storeId: z.string().uuid(),
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  zone: z.string().trim().optional(),
  capacity: z.coerce.number().positive().optional(),
});
binsRouter.post("/", async (req, res) => {
  const value = schema.parse(req.body);
  const bin = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Store" WHERE id=${value.storeId} AND "organizationId"=${req.tenantId!} FOR UPDATE`;
    const store = await tx.store.findFirst({
      where: {
        id: value.storeId,
        organizationId: req.tenantId,
        isActive: true,
      },
    });
    if (!store) return null;
    return tx.bin.create({
      data: {
        ...value,
        organizationId: req.tenantId!,
        code: value.code.toUpperCase(),
      },
      include: { store: true },
    });
  });
  if (!bin)
    return res
      .status(422)
      .json({
        error: {
          code: "INVALID_STORE",
          message: "Select an active store in this organization.",
        },
      });
  return res.status(201).json({ data: bin });
});

binsRouter.put("/:id", async (req, res) => {
  const value = schema.parse(req.body),
    where = { id: String(req.params.id), organizationId: req.tenantId! };
  const current = await prisma.bin.findFirst({ where });
  if (!current)
    return res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Bin not found." } });
  if (current.storeId !== value.storeId)
    return res
      .status(409)
      .json({
        error: {
          code: "BIN_STORE_FIXED",
          message:
            "A bin stays in its original store to preserve activity history.",
        },
      });
  const bin = await prisma.bin.update({
    where,
    data: {
      code: value.code.toUpperCase(),
      name: value.name,
      zone: value.zone || null,
      capacity: value.capacity ?? null,
    },
  });
  return res.json({ data: bin });
});
