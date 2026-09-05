import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { Prisma, DocumentStatus, MovementType } from "../generated/prisma/client.js";

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
    prisma.productionOrder.findMany({ where: { organizationId: req.tenantId } }),
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
      product: prodMap.get(l.productId),
      uom: uomMap.get(l.uomId),
      lot: l.lotId ? lotMap.get(l.lotId) : null,
      fromBin: l.fromBinId ? binMap.get(l.fromBinId) : null,
    }));

    const totalIssuedQty = lines.reduce((sum, l) => sum + Number(l.quantity), 0);

    return {
      ...iss,
      productionOrder,
      lines,
      totalIssuedQty,
    };
  });

  res.json({ data: enriched });
});

const createIssueSchema = z.object({
  productionOrderId: z.string().uuid(),
  fromSiteId: z.string().uuid().optional(),
  toSiteId: z.string().uuid().optional(),
  lines: z.array(
    z.object({
      productId: z.string().uuid(),
      lotId: z.string().uuid(),
      fromBinId: z.string().uuid(),
      quantity: z.coerce.number().positive(),
      uomId: z.string().uuid(),
    })
  ).min(1, "At least one material issue line is required"),
  notes: z.string().optional(),
});

materialIssuesRouter.post("/", async (req, res) => {
  const parsed = createIssueSchema.parse(req.body);

  const order = await prisma.productionOrder.findFirst({
    where: { id: parsed.productionOrderId, organizationId: req.tenantId },
  });

  if (!order) {
    return res.status(404).json({ error: { message: "Production order not found" } });
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
          message: `Insufficient stock in selected bin for product: ${prod?.name || item.productId}. Available: ${balance ? Number(balance.quantity) : 0}, Requested: ${item.quantity}`,
        },
      });
    }
  }

  const count = await prisma.materialIssue.count({
    where: { organizationId: req.tenantId },
  });
  const year = new Date().getFullYear();
  const number = `ISSUE-${year}-${String(count + 1).padStart(4, "0")}`;

  // Execute issue within transaction
  const issue = await prisma.$transaction(async (tx) => {
    const newIssue = await tx.materialIssue.create({
      data: {
        organizationId: req.tenantId!,
        number,
        productionOrderId: order.id,
        fromSiteId: parsed.fromSiteId || null,
        toSiteId: parsed.toSiteId || null,
        status: DocumentStatus.CLOSED,
        issuedAt: new Date(),
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

    // Deduct balances & post stock movements
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
          movementType: MovementType.ISSUE,
          productId: item.productId,
          lotId: item.lotId,
          fromBinId: item.fromBinId,
          quantity: qtyDecimal,
          uomId: item.uomId,
          documentType: "MATERIAL_ISSUE",
          documentId: newIssue.number,
          note: `Issued to Factory for ${order.number}. Deducted from RM bin.`,
          occurredAt: new Date(),
        },
      });

      // Update ProductionOrderLine issuedQty
      const poLine = await tx.productionOrderLine.findFirst({
        where: {
          productionOrderId: order.id,
          productId: item.productId,
        },
      });
      if (poLine) {
        await tx.productionOrderLine.update({
          where: { id: poLine.id },
          data: {
            issuedQty: { increment: qtyDecimal },
          },
        });
      }
    }

    return newIssue;
  });

  res.status(201).json({ data: issue });
});
