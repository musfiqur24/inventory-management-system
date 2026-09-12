import { randomUUID } from "node:crypto";
import {
  postStock,
  lockDocument,
  convertQuantity,
  StockError,
} from "../services/stock.js";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import {
  Prisma,
  DocumentStatus,
  MovementType,
} from "../generated/prisma/client.js";

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
      fgProduct: prodMap.get(l.productId),
      dispatchedQty: l.quantity,
      product: prodMap.get(l.productId),
      uom: uomMap.get(l.uomId),
      lot: l.lotId
        ? { ...lotMap.get(l.lotId), lotNumber: lotMap.get(l.lotId)?.code }
        : null,
      fromBin: l.fromBinId ? binMap.get(l.fromBinId) : null,
    }));

    const totalDispatchedQty = lines.reduce(
      (sum, l) => sum + Number(l.quantity),
      0,
    );

    return {
      ...disp,
      dispatchNumber: disp.number,
      salesOrder,
      customer,
      lines,
      totalDispatchedQty,
    };
  });

  res.json({ data: enriched });
});

const createDispatchSchema = z.object({
  requestId: z.string().uuid().optional(),
  salesOrderId: z.string().uuid(),
  vehicleNo: z.string().min(2),
  lines: z
    .array(
      z.object({
        productId: z.string().uuid(),
        lotId: z.string().uuid(),
        fromBinId: z.string().uuid(),
        quantity: z.coerce.number().positive(),
        uomId: z.string().uuid(),
      }),
    )
    .min(1, "At least one dispatch item is required"),
  notes: z.string().optional(),
});

dispatchesRouter.post("/", async (req, res) => {
  const parsed = createDispatchSchema.parse(req.body),
    organizationId = req.tenantId!,
    requestKey = parsed.requestId ?? randomUUID();
  const data = await prisma.$transaction(
    async (tx) => {
      await lockDocument(tx, "SalesOrder", parsed.salesOrderId, organizationId);
      const order = await tx.salesOrder.findFirst({
        where: { id: parsed.salesOrderId, organizationId },
      });
      if (!order) throw new StockError("NOT_FOUND", "Order not found.", 404);
      if (["CANCELLED", "REJECTED", "CLOSED"].includes(order.status))
        throw new StockError(
          "ORDER_UNAVAILABLE",
          "The order is closed or unavailable.",
        );
      const number =
        "DISP-" +
        new Date().getFullYear() +
        "-" +
        randomUUID().slice(0, 8).toUpperCase();
      const lineIds = parsed.lines.map(() => randomUUID());
      const document = await tx.dispatch.create({
        data: {
          organizationId,
          number,
          salesOrderId: order.id,
          vehicleNo: parsed.vehicleNo.toUpperCase().trim(),
          dispatchedAt: new Date(),
          status: DocumentStatus.CLOSED,
          lines: {
            create: parsed.lines.map((l, index) => ({
              id: lineIds[index],
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
      const items = parsed.lines
        .map((item, index) => ({ ...item, index }))
        .sort((a, b) => a.fromBinId.localeCompare(b.fromBinId));
      for (const item of items) {
        let remaining = new Prisma.Decimal(item.quantity);
        const orderLines = await tx.salesOrderLine.findMany({
          where: { salesOrderId: order.id, productId: item.productId },
          orderBy: { id: "asc" },
        });
        for (const line of orderLines) {
          if (remaining.lte(0)) break;
          const room = line.quantity.minus(line.dispatchedQty);
          if (room.lte(0)) continue;
          const amount = Prisma.Decimal.min(
            room,
            await convertQuantity(
              tx,
              organizationId,
              remaining,
              item.uomId,
              line.uomId,
            ),
          );
          await tx.salesOrderLine.update({
            where: { id: line.id },
            data: { dispatchedQty: { increment: amount } },
          });
          remaining = remaining.minus(
            await convertQuantity(
              tx,
              organizationId,
              amount,
              line.uomId,
              item.uomId,
            ),
          );
        }
        if (remaining.gt(0))
          throw new StockError(
            "ORDER_QUANTITY",
            "Product or quantity exceeds the remaining order requirements.",
          );
        await postStock(tx, {
          organizationId,
          binId: item.fromBinId,
          productId: item.productId,
          lotId: item.lotId,
          uomId: item.uomId,
          quantity: item.quantity,
          direction: "OUT",
          storeType: "FM_STORE",
          movementType: "DISPATCH",
          documentType: "DISPATCH",
          documentId: document.number,
          sourceDocumentId: document.id,
          sourceLineId: lineIds[item.index],
          referenceType: "SALES_ORDER",
          referenceId: order.id,
          referenceNumber: order.number,
          postingKey: "DISPATCH:" + requestKey + ":" + item.index,
          performedById: req.auth?.id,
          note: parsed.notes,
        });
      }
      const lines = await tx.salesOrderLine.findMany({
        where: { salesOrderId: order.id },
      });
      await tx.salesOrder.update({
        where: { id: order.id },
        data: {
          status: lines.every((l) => l.dispatchedQty.gte(l.quantity))
            ? DocumentStatus.CLOSED
            : DocumentStatus.PARTIALLY_RECEIVED,
        },
      });
      return document;
    },
    { timeout: 20000 },
  );
  res.status(201).json({ data });
});
