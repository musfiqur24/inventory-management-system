import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { Prisma, DocumentStatus } from "../generated/prisma/client.js";

export const purchaseRequisitionsRouter = Router();

purchaseRequisitionsRouter.get("/", async (req, res) => {
  const requisitions = await prisma.purchaseRequisition.findMany({
    where: { organizationId: req.tenantId },
    include: {
      lines: {
        include: {
          requisition: false,
        },
      },
    },
    orderBy: { requestedOn: "desc" },
  });

  // Enrich with product, uom, supplier details
  const [products, uoms, partners] = await Promise.all([
    prisma.product.findMany({ where: { organizationId: req.tenantId } }),
    prisma.unitOfMeasure.findMany({ where: { organizationId: req.tenantId } }),
    prisma.partner.findMany({ where: { organizationId: req.tenantId } }),
  ]);

  const prodMap = new Map(products.map((p) => [p.id, p]));
  const uomMap = new Map(uoms.map((u) => [u.id, u]));
  const partMap = new Map(partners.map((p) => [p.id, p]));

  const enriched = requisitions.map((reqItem) => {
    const supplier = reqItem.supplierId ? partMap.get(reqItem.supplierId) : null;
    const lines = reqItem.lines.map((l) => ({
      ...l,
      product: prodMap.get(l.productId),
      uom: uomMap.get(l.uomId),
    }));

    const totalEstimatedCost = lines.reduce(
      (sum, l) => sum + Number(l.requestedQty) * (l.unitPrice ? Number(l.unitPrice) : 0),
      0
    );

    return {
      ...reqItem,
      supplier,
      lines,
      totalEstimatedCost,
    };
  });

  res.json({ data: enriched });
});

const getRequisitionDetails = async (req: any, res: any) => {
  const requisition = await prisma.purchaseRequisition.findFirst({
    where: { id: req.params.id, organizationId: req.tenantId },
    include: {
      lines: true,
    },
  });

  if (!requisition) {
    return res.status(404).json({ error: { message: "Requisition not found" } });
  }

  const [products, uoms, supplier, organization] = await Promise.all([
    prisma.product.findMany({ where: { organizationId: req.tenantId } }),
    prisma.unitOfMeasure.findMany({ where: { organizationId: req.tenantId } }),
    requisition.supplierId
      ? prisma.partner.findFirst({ where: { id: requisition.supplierId } })
      : null,
    prisma.organization.findUnique({ where: { id: req.tenantId } }),
  ]);

  const prodMap = new Map(products.map((p) => [p.id, p]));
  const uomMap = new Map(uoms.map((u) => [u.id, u]));

  const lines = requisition.lines.map((l) => ({
    ...l,
    product: prodMap.get(l.productId),
    uom: uomMap.get(l.uomId),
  }));

  res.json({
    data: {
      ...requisition,
      organization,
      supplier,
      lines,
    },
  });
};

purchaseRequisitionsRouter.get("/:id", getRequisitionDetails);
purchaseRequisitionsRouter.get("/:id/report", getRequisitionDetails);

const createRequisitionSchema = z.object({
  salesOrderRef: z.string().optional(),
  supplierId: z.string().uuid().optional(),
  lines: z.array(
    z.object({
      productId: z.string().uuid(),
      uomId: z.string().uuid(),
      requestedQty: z.coerce.number().positive(),
      unitPrice: z.coerce.number().positive().optional(),
    })
  ).min(1, "At least one raw material line is required"),
});

purchaseRequisitionsRouter.post("/", async (req, res) => {
  const parsed = createRequisitionSchema.parse(req.body);

  const count = await prisma.purchaseRequisition.count({
    where: { organizationId: req.tenantId },
  });
  const year = new Date().getFullYear();
  const number = `RM-REQ-${year}-${String(count + 1).padStart(4, "0")}`;

  const requisition = await prisma.purchaseRequisition.create({
    data: {
      organizationId: req.tenantId!,
      number,
      salesOrderRef: parsed.salesOrderRef?.trim() || null,
      supplierId: parsed.supplierId || null,
      status: DocumentStatus.SUBMITTED,
      lines: {
        create: parsed.lines.map((l) => ({
          productId: l.productId,
          uomId: l.uomId,
          requestedQty: new Prisma.Decimal(l.requestedQty),
          unitPrice: l.unitPrice ? new Prisma.Decimal(l.unitPrice) : null,
        })),
      },
    },
    include: {
      lines: true,
    },
  });

  res.status(201).json({ data: requisition });
});

purchaseRequisitionsRouter.post("/:id/approve", async (req, res) => {
  const updated = await prisma.purchaseRequisition.update({
    where: { id: req.params.id, organizationId: req.tenantId },
    data: {
      status: DocumentStatus.APPROVED,
      approvedAt: new Date(),
    },
  });
  res.json({ data: updated });
});
