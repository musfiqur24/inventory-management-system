import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { Prisma, DocumentStatus } from "../generated/prisma/client.js";

export const salesOrdersRouter = Router();

salesOrdersRouter.get("/", async (req, res) => {
  const orders = await prisma.salesOrder.findMany({
    where: { organizationId: req.tenantId },
    include: {
      lines: true,
    },
    orderBy: { orderedAt: "desc" },
  });

  const [products, uoms, partners] = await Promise.all([
    prisma.product.findMany({ where: { organizationId: req.tenantId } }),
    prisma.unitOfMeasure.findMany({ where: { organizationId: req.tenantId } }),
    prisma.partner.findMany({ where: { organizationId: req.tenantId } }),
  ]);

  const prodMap = new Map(products.map((p) => [p.id, p]));
  const uomMap = new Map(uoms.map((u) => [u.id, u]));
  const partMap = new Map(partners.map((p) => [p.id, p]));

  const enriched = orders.map((ord) => {
    const customer = partMap.get(ord.customerId);
    const lines = ord.lines.map((l) => ({
      ...l,
      product: prodMap.get(l.productId),
      uom: uomMap.get(l.uomId),
    }));

    const totalValue = lines.reduce(
      (sum, l) => sum + Number(l.quantity) * (l.unitPrice ? Number(l.unitPrice) : 0),
      0
    );

    return {
      ...ord,
      customer,
      lines,
      totalValue,
    };
  });

  res.json({ data: enriched });
});

salesOrdersRouter.get("/:id", async (req, res) => {
  const order = await prisma.salesOrder.findFirst({
    where: { id: req.params.id, organizationId: req.tenantId },
    include: { lines: true },
  });
  if (!order) return res.status(404).json({ error: { message: "Sales order not found" } });

  const [products, uoms, customer] = await Promise.all([
    prisma.product.findMany({ where: { organizationId: req.tenantId } }),
    prisma.unitOfMeasure.findMany({ where: { organizationId: req.tenantId } }),
    prisma.partner.findUnique({ where: { id: order.customerId } }),
  ]);

  const prodMap = new Map(products.map((p) => [p.id, p]));
  const uomMap = new Map(uoms.map((u) => [u.id, u]));

  const lines = order.lines.map((l) => ({
    ...l,
    product: prodMap.get(l.productId),
    uom: uomMap.get(l.uomId),
  }));

  const totalValue = lines.reduce(
    (sum, l) => sum + Number(l.quantity) * (l.unitPrice ? Number(l.unitPrice) : 0),
    0
  );

  res.json({
    data: {
      ...order,
      customer,
      lines,
      totalValue,
    },
  });
});

const createSalesOrderSchema = z.object({
  customerId: z.string().uuid("Please select a customer"),
  lines: z.array(
    z.object({
      productId: z.string().uuid("Please select a product"),
      uomId: z.string().uuid("Please select a unit of measure"),
      quantity: z.coerce.number().positive("Quantity must be greater than 0"),
      unitPrice: z.coerce.number().positive("Unit price must be positive").optional(),
    })
  ).min(1, "At least one sales line is required"),
});

salesOrdersRouter.post("/", async (req, res) => {
  const parsed = createSalesOrderSchema.parse(req.body);

  const count = await prisma.salesOrder.count({
    where: { organizationId: req.tenantId },
  });
  const year = new Date().getFullYear();
  const number = `SO-${year}-${String(count + 1).padStart(4, "0")}`;

  const order = await prisma.salesOrder.create({
    data: {
      organizationId: req.tenantId!,
      number,
      customerId: parsed.customerId,
      status: DocumentStatus.SUBMITTED,
      lines: {
        create: parsed.lines.map((l) => ({
          productId: l.productId,
          uomId: l.uomId,
          quantity: new Prisma.Decimal(l.quantity),
          dispatchedQty: new Prisma.Decimal(0),
          unitPrice: l.unitPrice ? new Prisma.Decimal(l.unitPrice) : null,
        })),
      },
    },
    include: {
      lines: true,
    },
  });

  res.status(201).json({ data: order });
});

salesOrdersRouter.post("/:id/approve", async (req, res) => {
  const order = await prisma.salesOrder.findFirst({
    where: { id: req.params.id, organizationId: req.tenantId },
  });
  if (!order) return res.status(404).json({ error: { message: "Sales order not found" } });

  const updated = await prisma.salesOrder.update({
    where: { id: order.id },
    data: { status: DocumentStatus.APPROVED },
    include: { lines: true },
  });

  res.json({ data: updated });
});

salesOrdersRouter.delete("/:id", async (req, res) => {
  const order = await prisma.salesOrder.findFirst({
    where: { id: req.params.id, organizationId: req.tenantId },
  });
  if (!order) return res.status(404).json({ error: { message: "Sales order not found" } });

  await prisma.salesOrder.delete({
    where: { id: order.id },
  });

  res.json({ data: { message: "Sales order deleted successfully" } });
});
