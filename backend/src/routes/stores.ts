import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
export const storesRouter = Router();
const storeSchema = z.object({
  code: z.string().trim().regex(/^\d+$/, "Store code must contain numbers only."),
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
          code: value.code,
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
      data: { ...value, code: value.code },
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

storesRouter.delete("/:id", async (req, res) => {
  const where = { id: String(req.params.id), organizationId: req.tenantId! };
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Store" WHERE id=${where.id} AND "organizationId"=${where.organizationId} FOR UPDATE`;
    const store = await tx.store.findFirst({ where });
    if (!store) return "not-found";
    const stockCount = await tx.inventoryBalance.count({
      where: {
        organizationId: where.organizationId,
        bin: { storeId: where.id },
        OR: [{ quantity: { gt: 0 } }, { reservedQty: { gt: 0 } }],
      },
    });
    if (stockCount) return "in-use";
    await tx.bin.updateMany({ where: { organizationId: where.organizationId, storeId: where.id }, data: { isActive: false } });
    await tx.store.update({ where, data: { isActive: false } });
    return "deleted";
  });
  if (result === "not-found") return res.status(404).json({ error: { code: "NOT_FOUND", message: "Store not found." } });
  if (result === "in-use") return res.status(409).json({ error: { code: "STORE_HAS_STOCK", message: "This store contains stock and cannot be deleted." } });
  res.status(204).send();
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
  const deliveryIds = [...new Set(data.map((balance) => balance.lot.supplierDeliveryId).filter((id): id is string => Boolean(id)))];
  const productionBatchIds = [...new Set(data.map((balance) => balance.lot.productionBatchId).filter((id): id is string => Boolean(id)))];
  const [deliveries, productionBatches] = await Promise.all([
    deliveryIds.length
      ? prisma.supplierDelivery.findMany({ where: { organizationId: req.tenantId, id: { in: deliveryIds } }, select: { id: true, requisitionId: true } })
      : [],
    productionBatchIds.length
      ? prisma.productionBatch.findMany({ where: { organizationId: req.tenantId, id: { in: productionBatchIds } }, select: { id: true, number: true } })
      : [],
  ]);
  const requisitionIds = [...new Set(deliveries.map((delivery) => delivery.requisitionId).filter((id): id is string => Boolean(id)))];
  const requisitions = requisitionIds.length
    ? await prisma.purchaseRequisition.findMany({ where: { organizationId: req.tenantId, id: { in: requisitionIds } }, select: { id: true, number: true } })
    : [];
  const deliveryMap = new Map(deliveries.map((delivery) => [delivery.id, delivery]));
  const requisitionMap = new Map(requisitions.map((requisition) => [requisition.id, requisition.number]));
  const productionBatchMap = new Map(productionBatches.map((batch) => [batch.id, batch.number]));
  res.json({
    data: data.map((balance) => {
      const delivery = balance.lot.supplierDeliveryId ? deliveryMap.get(balance.lot.supplierDeliveryId) : undefined;
      return {
        ...balance,
        requisitionNumber: delivery?.requisitionId ? requisitionMap.get(delivery.requisitionId) ?? null : null,
        batchNumber: balance.lot.productionBatchId ? productionBatchMap.get(balance.lot.productionBatchId) ?? null : null,
      };
    }),
  });
});
storesRouter.get("/:id/activity", async (req, res) => {
  const filters = z
    .object({
      from: z.string().datetime({ offset: true }).optional(),
      to: z.string().datetime({ offset: true }).optional(),
      binId: z.string().uuid().optional(),
      direction: z.enum(["IN", "OUT"]).optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(1000).default(20),
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
  if (filters.search) {
    const matchingOrders = await prisma.productionOrder.findMany({
      where: {
        organizationId: req.tenantId,
        requisition: { is: { number: { contains: filters.search, mode: "insensitive" } } },
      },
      select: { id: true, number: true },
    });
    where.AND = [
      {
        OR: [
          { documentId: { contains: filters.search, mode: "insensitive" } },
          { referenceNumber: { contains: filters.search, mode: "insensitive" } },
          ...(matchingOrders.length ? [
            { referenceId: { in: matchingOrders.map((order) => order.id) } },
            { referenceNumber: { in: matchingOrders.map((order) => order.number) } },
          ] : []),
        ],
      },
    ];
  }
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
  const referenceIds = movements.flatMap((movement) => movement.referenceId ? [movement.referenceId] : []);
  const referenceNumbers = movements.flatMap((movement) => movement.referenceNumber ? [movement.referenceNumber] : []);
  const [productionOrders, productionRequisitions] = await Promise.all([
    prisma.productionOrder.findMany({
      where: {
        organizationId: req.tenantId,
        OR: [
          { id: { in: referenceIds } },
          { number: { in: referenceNumbers } },
        ],
      },
      include: { requisition: { select: { id: true, number: true } } },
    }),
    prisma.productionRequisition.findMany({
      where: {
        organizationId: req.tenantId,
        OR: [
          { id: { in: referenceIds } },
          { number: { in: referenceNumbers } },
        ],
      },
      select: { id: true, number: true },
    }),
  ]);
  res.json({
    data: movements.map((m) => {
      const productionOrder = productionOrders.find((order) => order.id === m.referenceId || order.number === m.referenceNumber);
      const productionRequisition = productionRequisitions.find((requisition) => requisition.id === m.referenceId || requisition.number === m.referenceNumber);
      return {
      ...m,
      direction: m.toStoreId === id ? "IN" : "OUT",
      requisitionNumber: productionOrder?.requisition?.number ?? productionRequisition?.number ?? m.referenceNumber ?? null,
      product: products.find((p) => p.id === m.productId),
      lot: lots.find((l) => l.id === m.lotId),
      bin: bins.find(
        (b) => b.id === (m.toStoreId === id ? m.toBinId : m.fromBinId),
      ),
      uom: uoms.find((u) => u.id === m.uomId),
      performedBy: users.find((u) => u.id === m.performedById),
    };
    }),
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
          status: { in: ["APPROVED", "INCOMPLETE", "PARTIALLY_RECEIVED"] },
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
            .filter((l) => l.verifiedQty != null && l.verifiedQty.gt(l.acceptedQty ?? 0))
            .map((l) => ({
              id: l.id,
              productId: l.productId,
              productName:
                products.find((p) => p.id === l.productId)?.name ?? l.productId,
              uomId: l.uomId,
              uomCode: uoms.find((u) => u.id === l.uomId)?.code,
              remaining: l.verifiedQty!.minus(l.acceptedQty ?? 0),
            })),
        }))
        .filter((d) => d.lines.length),
    });
  }
  const [batches, orders, posted] = await Promise.all([
    prisma.productionBatch.findMany({
      where: {
        organizationId: req.tenantId,
        status: "READY",
        actualOutputQty: { gt: 0 },
      },
      include: { outputLines: true },
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
        const anchor = orders.find((order) => order.id === b.productionOrderId);
        const requisitionOrders = anchor?.requisitionId ? orders.filter((order) => order.requisitionId === anchor.requisitionId) : anchor ? [anchor] : [];
        const orderByProduct = new Map(requisitionOrders.map((order) => [order.finishedProductId, order]));
        const lines = b.outputLines.filter((line) => line.productId && Number(line.quantity) > 0).map((line) => {
          const order = orderByProduct.get(line.productId!);
          return {
            id: line.id,
            productId: line.productId!,
            productName: products.find((product) => product.id === line.productId)?.name ?? line.description,
            uomId: order?.plannedUomId ?? anchor?.plannedUomId ?? "",
            uomCode: uoms.find((uom) => uom.id === (order?.plannedUomId ?? anchor?.plannedUomId))?.code,
            remaining: line.quantity,
          };
        });
        return lines.length ? [{ id: b.id, number: b.number, referenceNumber: anchor?.requisitionId ?? anchor?.number, lines }] : [];
      }),  });
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
        status: "APPROVED",
        requisitionId: { not: null },
        requisition: {
          is: {
            organizationId: req.tenantId,
            status: "APPROVED",
          },
        },
        lines: { some: { productId } },
      },
      include: {
        requisition: { select: { id: true, number: true } },
        lines: { where: { productId } },
      },
      orderBy: { number: "desc" },
    });
    const requisitionOptions = new Map<string, string>();
    for (const order of orders) {
      if (order.requisition && order.lines.some((line) => line.wasteAdjustedQty.gt(line.issuedQty)))
        requisitionOptions.set(order.requisition.id, order.requisition.number);
    }
    return res.json({
      data: [...requisitionOptions].map(([id, number]) => ({ id, number })),
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
