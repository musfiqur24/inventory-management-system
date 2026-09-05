import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { Prisma, DocumentStatus, MovementType } from "../generated/prisma/client.js";

export const dispatchesRouter = Router();

dispatchesRouter.get("/", async (req, res) => {
  const dispatches = await prisma.dispatch.findMany({
    where: { organizationId: req.tenantId },
    include: {
      lines: true,
    },
    orderBy: { dispatchedAt: "desc" },
  });

  const [products, uoms, lots, bins, orders, partners] = await Promise.all([
    prisma.product.findMany({ where: { organizationId: req.tenantId } }),
    prisma.unitOfMeasure.findMany({ where: { organizationId: req.tenantId } }),
    prisma.lot.findMany({ where: { organizationId: req.tenantId } }),
    prisma.bin.findMany({ where: { organizationId: req.tenantId } }),
    prisma.salesOrder.findMany({ where: { organizationId: req.tenantId } }),
    prisma.partner.findMany({ where: { organizationId: req.tenantId } }),
  ]);

  const prodMap = new Map(products.map((p) => [p.id, p]));
  const uomMap = new Map(uoms.map((u) => [u.id, u]));
  const lotMap = new Map(lots.map((l) => [l.id, l]));
  const binMap = new Map(bins.map((b) => [b.id, b]));
  const orderMap = new Map(orders.map((o) => [o.id, o]));
  const partMap = new Map(partners.map((p) => [p.id, p]));

  const enriched = dispatches.map((disp) => {
    const salesOrder = orderMap.get(disp.salesOrderId);
    const customer = salesOrder ? partMap.get(salesOrder.customerId) : null;

    const lines = disp.lines.map((l) => ({
      ...l,
      product: prodMap.get(l.productId),
      uom: uomMap.get(l.uomId),
      lot: l.lotId ? lotMap.get(l.lotId) : null,
      fromBin: l.fromBinId ? binMap.get(l.fromBinId) : null,
    }));

    const totalDispatchedQty = lines.reduce((sum, l) => sum + Number(l.quantity), 0);

    return {
      ...disp,
      salesOrder,
      customer,
      lines,
      totalDispatchedQty,
    };
  });

  res.json({ data: enriched });
});

const createDispatchSchema = z.object({
  salesOrderId: z.string().uuid(),
  vehicleNo: z.string().min(2),
  lines: z.array(
    z.object({
      productId: z.string().uuid(),
      lotId: z.string().uuid(),
      fromBinId: z.string().uuid(),
      quantity: z.coerce.number().positive(),
      uomId: z.string().uuid(),
    })
  ).min(1, "At least one dispatch item is required"),
  notes: z.string().optional(),
});

dispatchesRouter.post("/", async (req, res) => {
  const parsed = createDispatchSchema.parse(req.body);

  const salesOrder = await prisma.salesOrder.findFirst({
    where: { id: parsed.salesOrderId, organizationId: req.tenantId },
  });

  if (!salesOrder) {
    return res.status(404).json({ error: { message: "Sales order not found" } });
  }

  // Check inventory balances
  for (const item of parsed.lines) {
    const balance = await prisma.inventoryBalance.findUnique({
      where: {
        organizationId_productId_lotId_binId: {
          organizationId: req.tenantId!,
          productId: item.productId,
          lotId: item.lotId,
          binId: item.fromBinId,
        },
      },
    });

    if (!balance || Number(balance.quantity) < item.quantity) {
      const prod = await prisma.product.findUnique({ where: { id: item.productId } });
      return res.status(400).json({
        error: {
          code: "INSUFFICIENT_STOCK",
          message: `Insufficient finished goods stock in selected bin for product: ${prod?.name || item.productId}. Available: ${balance ? Number(balance.quantity) : 0}, Requested: ${item.quantity}`,
        },
      });
    }
  }

  const count = await prisma.dispatch.count({
    where: { organizationId: req.tenantId },
  });
  const year = new Date().getFullYear();
  const number = `DISP-${year}-${String(count + 1).padStart(4, "0")}`;

  // Execute in transaction
  const dispatch = await prisma.$transaction(async (tx) => {
    const newDispatch = await tx.dispatch.create({
      data: {
        organizationId: req.tenantId!,
        number,
        salesOrderId: salesOrder.id,
        vehicleNo: parsed.vehicleNo.toUpperCase().trim(),
        status: DocumentStatus.CLOSED,
        dispatchedAt: new Date(),
        lines: {
          create: parsed.lines.map((l) => ({
            productId: l.productId,
            lotId: l.lotId,
            fromBinId: l.fromBinId,
            quantity: new Prisma.Decimal(l.quantity),
            uomId: l.uomId,
          })),
        },
      },
      include: { lines: true },
    });

    for (const item of parsed.lines) {
      const qtyDecimal = new Prisma.Decimal(item.quantity);

      await tx.inventoryBalance.update({
        where: {
          organizationId_productId_lotId_binId: {
            organizationId: req.tenantId!,
            productId: item.productId,
            lotId: item.lotId,
            binId: item.fromBinId,
          },
        },
        data: {
          quantity: { decrement: qtyDecimal },
        },
      });

      await tx.stockMovement.create({
        data: {
          organizationId: req.tenantId!,
          movementType: MovementType.DISPATCH,
          productId: item.productId,
          lotId: item.lotId,
          fromBinId: item.fromBinId,
          quantity: qtyDecimal,
          uomId: item.uomId,
          documentType: "DISPATCH",
          documentId: newDispatch.number,
          note: `Dispatched against ${salesOrder.number} on vehicle ${parsed.vehicleNo}.`,
          occurredAt: new Date(),
        },
      });

      const soLine = await tx.salesOrderLine.findFirst({
        where: {
          salesOrderId: salesOrder.id,
          productId: item.productId,
        },
      });
      if (soLine) {
        await tx.salesOrderLine.update({
          where: { id: soLine.id },
          data: {
            dispatchedQty: { increment: qtyDecimal },
          },
        });
      }
    }

    await tx.salesOrder.update({
      where: { id: salesOrder.id },
      data: { status: DocumentStatus.CLOSED },
    });

    return newDispatch;
  });

  res.status(201).json({ data: dispatch });
});
