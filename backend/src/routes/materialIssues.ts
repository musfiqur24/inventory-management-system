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

export const materialIssuesRouter = Router();

materialIssuesRouter.get("/", async (req, res) => {
  const issues = await prisma.materialIssue.findMany({
    where: { organizationId: req.tenantId },
    include: {
      lines: true,
    },
    orderBy: { issuedAt: "desc" },
  });

  const [products, uoms, lots, bins, orders] = await Promise.all([
    prisma.product.findMany({ where: { organizationId: req.tenantId } }),
    prisma.unitOfMeasure.findMany({ where: { organizationId: req.tenantId } }),
    prisma.lot.findMany({ where: { organizationId: req.tenantId } }),
    prisma.bin.findMany({ where: { organizationId: req.tenantId } }),
    prisma.productionOrder.findMany({
      where: { organizationId: req.tenantId },
    }),
  ]);

  const prodMap = new Map(products.map((p) => [p.id, p]));
  const uomMap = new Map(uoms.map((u) => [u.id, u]));
  const lotMap = new Map(lots.map((l) => [l.id, l]));
  const binMap = new Map(bins.map((b) => [b.id, b]));
  const orderMap = new Map(orders.map((o) => [o.id, o]));

  const enriched = issues.map((iss) => {
    const productionOrder = orderMap.get(iss.productionOrderId);
    const lines = iss.lines.map((l) => ({
      ...l,
      rawMaterial: prodMap.get(l.productId),
      issuedQty: l.quantity,
      product: prodMap.get(l.productId),
      uom: uomMap.get(l.uomId),
      lot: l.lotId
        ? { ...lotMap.get(l.lotId), lotNumber: lotMap.get(l.lotId)?.code }
        : null,
      fromBin: l.fromBinId ? binMap.get(l.fromBinId) : null,
    }));

    const totalIssuedQty = lines.reduce(
      (sum, l) => sum + Number(l.quantity),
      0,
    );

    return {
      ...iss,
      issueNumber: iss.number,
      productionOrder,
      lines,
      totalIssuedQty,
    };
  });

  res.json({ data: enriched });
});

const createIssueSchema = z.object({
  requestId: z.string().uuid().optional(),
  productionOrderId: z.string().uuid(),
  fromSiteId: z.string().uuid().optional(),
  toSiteId: z.string().uuid().optional(),
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
    .min(1, "At least one material issue line is required"),
  notes: z.string().optional(),
});

materialIssuesRouter.post("/", async (req, res) => {
  const parsed = createIssueSchema.parse(req.body),
    organizationId = req.tenantId!,
    requestKey = parsed.requestId ?? randomUUID();
  const data = await prisma.$transaction(
    async (tx) => {
      await lockDocument(
        tx,
        "ProductionOrder",
        parsed.productionOrderId,
        organizationId,
      );
      const order = await tx.productionOrder.findFirst({
        where: { id: parsed.productionOrderId, organizationId },
      });
      if (!order) throw new StockError("NOT_FOUND", "Order not found.", 404);
      if (["CANCELLED", "REJECTED", "CLOSED"].includes(order.status))
        throw new StockError(
          "ORDER_UNAVAILABLE",
          "The order is closed or unavailable.",
        );
      const number =
        "ISSUE-" +
        new Date().getFullYear() +
        "-" +
        randomUUID().slice(0, 8).toUpperCase();
      const lineIds = parsed.lines.map(() => randomUUID());
      const document = await tx.materialIssue.create({
        data: {
          organizationId,
          number,
          productionOrderId: order.id,
          fromSiteId: parsed.fromSiteId || null,
          toSiteId: parsed.toSiteId || null,
          issuedAt: new Date(),
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
        const orderLines = await tx.productionOrderLine.findMany({
          where: { productionOrderId: order.id, productId: item.productId },
          orderBy: { id: "asc" },
        });
        for (const line of orderLines) {
          if (remaining.lte(0)) break;
          const room = line.wasteAdjustedQty.minus(line.issuedQty);
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
          await tx.productionOrderLine.update({
            where: { id: line.id },
            data: { issuedQty: { increment: amount } },
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
          storeType: "RM_STORE",
          movementType: "ISSUE",
          documentType: "MATERIAL_ISSUE",
          documentId: document.number,
          sourceDocumentId: document.id,
          sourceLineId: lineIds[item.index],
          referenceType: "PRODUCTION_ORDER",
          referenceId: order.id,
          referenceNumber: order.number,
          postingKey: "ISSUE:" + requestKey + ":" + item.index,
          performedById: req.auth?.id,
          note: parsed.notes,
        });
      }

      return document;
    },
    { timeout: 20000 },
  );
  res.status(201).json({ data });
});
