import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
export const storesRouter = Router();
const storeSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  storeType: z.enum(["RM_STORE", "FM_STORE"]),
  address: z.string().trim().optional(),
});
storesRouter.get("/", async (req, res) => {
  const type = req.query.type
    ? z.enum(["RM_STORE", "FM_STORE"]).parse(req.query.type)
    : undefined;
  const stores = await prisma.store.findMany({
    where: {
      organizationId: req.tenantId,
      isActive: true,
      ...(type ? { storeType: type } : {}),
    },
    include: { _count: { select: { bins: true } } },
    orderBy: { name: "asc" },
  });
  res.json({ data: stores });
});
storesRouter.post("/", async (req, res) => {
  const value = storeSchema.parse(req.body);
  res
    .status(201)
    .json({
      data: await prisma.store.create({
        data: {
          ...value,
          code: value.code.toUpperCase(),
          organizationId: req.tenantId!,
        },
      }),
    });
});
storesRouter.put("/:id", async (req, res) => {
  const value = storeSchema.parse(req.body),
    where = { id: String(req.params.id), organizationId: req.tenantId! };
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Store" WHERE id=${where.id} AND "organizationId"=${where.organizationId} FOR UPDATE`;
    const existing = await tx.store.findFirst({
      where,
      include: { _count: { select: { bins: true } } },
    });
    if (!existing) return null;
    if (existing.storeType !== value.storeType && existing._count.bins)
      return "in-use";
    return tx.store.update({
      where,
      data: { ...value, code: value.code.toUpperCase() },
    });
  });
  if (!result)
    return res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Store not found." } });
  if (result === "in-use")
    return res
      .status(409)
      .json({
        error: {
          code: "STORE_IN_USE",
          message: "A store with bins cannot change its RM/FM type.",
        },
      });
  return res.json({ data: result });
});
storesRouter.get("/:id/balances", async (req, res) => {
  const storeId = String(req.params.id);
  const filters = z.object({
    binId: z.string().uuid().optional(),
    requisition: z.string().trim().min(1).optional(),
  }).parse(req.query);
  let requisitionPositions: Prisma.InventoryBalanceWhereInput[] | undefined;
  if (filters.requisition) {
    const movements = await prisma.stockMovement.findMany({
      where: {
        organizationId: req.tenantId,
        toStoreId: storeId,
        referenceNumber: filters.requisition,
        lotId: { not: null },
        toBinId: { not: null },
      },
      select: { productId: true, lotId: true, toBinId: true, uomId: true },
      distinct: ["productId", "lotId", "toBinId", "uomId"],
    });
    requisitionPositions = movements.map((movement) => ({
      productId: movement.productId,
      lotId: movement.lotId!,
      binId: movement.toBinId!,
      uomId: movement.uomId,
    }));
    if (!requisitionPositions.length) return res.json({ data: [] });
  }
  const data = await prisma.inventoryBalance.findMany({
    where: {
      organizationId: req.tenantId,
      bin: { storeId },
      quantity: { gt: 0 },
      ...(filters.binId ? { binId: filters.binId } : {}),
      ...(requisitionPositions ? { OR: requisitionPositions } : {}),
    },
    include: {
      product: true,
      lot: true,
      bin: { include: { store: true } },
      uom: true,
    },
    orderBy: { updatedAt: "desc" },
  });
  res.json({ data });
});
storesRouter.get("/:id/activity", async (req, res) => {
  const filters = z
    .object({
      from: z.string().datetime({ offset: true }).optional(),
      to: z.string().datetime({ offset: true }).optional(),
      binId: z.string().uuid().optional(),
      direction: z.enum(["IN", "OUT"]).optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
      search: z.string().optional(),
    })
    .parse(req.query);
  const id = String(req.params.id);
  const sides: Prisma.StockMovementWhereInput[] = [];
  if (filters.direction !== "OUT")
    sides.push({
      toStoreId: id,
      ...(filters.binId ? { toBinId: filters.binId } : {}),
    });
  if (filters.direction !== "IN")
    sides.push({
      fromStoreId: id,
      ...(filters.binId ? { fromBinId: filters.binId } : {}),
    });
  const where: Prisma.StockMovementWhereInput = {
    organizationId: req.tenantId,
    OR: sides,
  };
  if (filters.from || filters.to)
    where.occurredAt = {
      ...(filters.from ? { gte: new Date(filters.from) } : {}),
      ...(filters.to ? { lte: new Date(filters.to) } : {}),
    };
  if (
    filters.from &&
    filters.to &&
    new Date(filters.from) > new Date(filters.to)
  )
    return res
      .status(422)
      .json({
        error: {
          code: "INVALID_DATES",
          message: "Start date must be before end date.",
        },
      });
  if (filters.search)
    where.AND = [
      {
        OR: [
          { documentId: { contains: filters.search, mode: "insensitive" } },
          {
            referenceNumber: { contains: filters.search, mode: "insensitive" },
          },
        ],
      },
    ];
  const [movements, total] = await prisma.$transaction([
    prisma.stockMovement.findMany({
      where,
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.stockMovement.count({ where }),
  ]);
  const [products, lots, bins, uoms, users] = await Promise.all([
    prisma.product.findMany({
      where: {
        organizationId: req.tenantId,
        id: { in: movements.map((m) => m.productId) },
      },
    }),
    prisma.lot.findMany({
      where: {
        organizationId: req.tenantId,
        id: { in: movements.flatMap((m) => (m.lotId ? [m.lotId] : [])) },
      },
    }),
    prisma.bin.findMany({
      where: {
        organizationId: req.tenantId,
        id: {
          in: movements.flatMap((m) =>
            [m.fromBinId, m.toBinId].filter((id): id is string => !!id),
          ),
        },
      },
    }),
    prisma.unitOfMeasure.findMany({
      where: {
        organizationId: req.tenantId,
        id: { in: movements.map((m) => m.uomId) },
      },
    }),
    prisma.user.findMany({
      where: {
        id: {
          in: movements.flatMap((m) =>
            m.performedById ? [m.performedById] : [],
          ),
        },
      },
      select: { id: true, fullName: true },
    }),
  ]);
  res.json({
    data: movements.map((m) => ({
      ...m,
      direction: m.toStoreId === id ? "IN" : "OUT",
      product: products.find((p) => p.id === m.productId),
      lot: lots.find((l) => l.id === m.lotId),
      bin: bins.find(
        (b) => b.id === (m.toStoreId === id ? m.toBinId : m.fromBinId),
      ),
      uom: uoms.find((u) => u.id === m.uomId),
      performedBy: users.find((u) => u.id === m.performedById),
    })),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
  });
});

storesRouter.get("/:id/receiving-options", async (req, res) => {
  const store = await prisma.store.findFirst({
    where: {
      id: String(req.params.id),
      organizationId: req.tenantId,
      isActive: true,
    },
  });
  if (!store)
    return res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Store not found." } });
  const [products, uoms] = await Promise.all([
    prisma.product.findMany({ where: { organizationId: req.tenantId } }),
    prisma.unitOfMeasure.findMany({ where: { organizationId: req.tenantId } }),
  ]);
  if (store.storeType === "RM_STORE") {
    const [deliveries, requisitions] = await Promise.all([
      prisma.supplierDelivery.findMany({
        where: {
          organizationId: req.tenantId,
          status: { in: ["APPROVED", "PARTIALLY_RECEIVED"] },
        },
        include: { lines: true },
        orderBy: { number: "desc" },
      }),
      prisma.purchaseRequisition.findMany({
        where: { organizationId: req.tenantId },
      }),
    ]);
    return res.json({
      data: deliveries
        .map((d) => ({
          id: d.id,
          number: d.number,
          referenceNumber: requisitions.find((r) => r.id === d.requisitionId)
            ?.number,
          lines: d.lines
            .filter((l) => l.declaredQty.gt(l.acceptedQty ?? 0))
            .map((l) => ({
              id: l.id,
              productId: l.productId,
              productName:
                products.find((p) => p.id === l.productId)?.name ?? l.productId,
              uomId: l.uomId,
              uomCode: uoms.find((u) => u.id === l.uomId)?.code,
              remaining: l.declaredQty.minus(l.acceptedQty ?? 0),
            })),
        }))
        .filter((d) => d.lines.length),
    });
  }
  const [batches, orders, posted] = await Promise.all([
    prisma.productionBatch.findMany({
      where: {
        organizationId: req.tenantId,
        status: "CLOSED",
        fgLotId: { not: null },
        actualOutputQty: { gt: 0 },
      },
      orderBy: { number: "desc" },
    }),
    prisma.productionOrder.findMany({
      where: { organizationId: req.tenantId },
    }),
    prisma.stockMovement.findMany({
      where: {
        organizationId: req.tenantId,
        documentType: "PRODUCTION_BATCH",
        movementType: "PRODUCTION_OUTPUT",
      },
      select: { documentId: true },
    }),
  ]);
  return res.json({
    data: batches
      .filter((b) => !posted.some((p) => p.documentId === b.number))
      .flatMap((b) => {
        const order = orders.find((o) => o.id === b.productionOrderId);
        return order
          ? [
              {
                id: b.id,
                number: b.number,
                referenceNumber: order.number,
                lines: [
                  {
                    id: b.id,
                    productId: order.finishedProductId,
                    productName:
                      products.find((p) => p.id === order.finishedProductId)
                        ?.name ?? "",
                    uomId: order.plannedUomId,
                    uomCode: uoms.find((u) => u.id === order.plannedUomId)
                      ?.code,
                    remaining: b.actualOutputQty,
                  },
                ],
              },
            ]
          : [];
      }),
  });
});
storesRouter.get("/:id/release-options", async (req, res) => {
  const store = await prisma.store.findFirst({
    where: {
      id: String(req.params.id),
      organizationId: req.tenantId,
      isActive: true,
    },
  });
  if (!store)
    return res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Store not found." } });
  const productId = z.string().uuid().parse(req.query.productId);
  if (store.storeType === "RM_STORE") {
    const orders = await prisma.productionOrder.findMany({
      where: {
        organizationId: req.tenantId,
        status: { notIn: ["CLOSED", "CANCELLED", "REJECTED"] },
        lines: { some: { productId } },
      },
      include: { lines: { where: { productId } } },
      orderBy: { number: "desc" },
    });
    return res.json({
      data: orders
        .filter((o) => o.lines.some((l) => l.wasteAdjustedQty.gt(l.issuedQty)))
        .map((o) => ({ id: o.id, number: o.number })),
    });
  }
  const orders = await prisma.salesOrder.findMany({
    where: {
      organizationId: req.tenantId,
      status: { notIn: ["CLOSED", "CANCELLED", "REJECTED"] },
      lines: { some: { productId } },
    },
    include: { lines: { where: { productId } } },
    orderBy: { number: "desc" },
  });
  return res.json({
    data: orders
      .filter((o) => o.lines.some((l) => l.quantity.gt(l.dispatchedQty)))
      .map((o) => ({ id: o.id, number: o.number })),
  });
});
