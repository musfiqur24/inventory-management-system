import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { Prisma, DocumentStatus } from "../generated/prisma/client.js";

export const deliveriesRouter = Router();

deliveriesRouter.get("/", async (req, res) => {
  const deliveries = await prisma.supplierDelivery.findMany({
    where: { organizationId: req.tenantId },
    include: {
      lines: true,
    },
    orderBy: { deliveredAt: "desc" },
  });

  const [products, uoms, partners, weighments, requisitions] = await Promise.all([
    prisma.product.findMany({ where: { organizationId: req.tenantId } }),
    prisma.unitOfMeasure.findMany({ where: { organizationId: req.tenantId } }),
    prisma.partner.findMany({ where: { organizationId: req.tenantId } }),
    prisma.weighment.findMany({ where: { organizationId: req.tenantId } }),
    prisma.purchaseRequisition.findMany({ where: { organizationId: req.tenantId } }),
  ]);

  const prodMap = new Map(products.map((p) => [p.id, p]));
  const uomMap = new Map(uoms.map((u) => [u.id, u]));
  const partMap = new Map(partners.map((p) => [p.id, p]));
  const reqMap = new Map(requisitions.map((r) => [r.id, r]));

  const enriched = deliveries.map((del) => {
    const supplier = partMap.get(del.supplierId);
    const requisition = del.requisitionId ? reqMap.get(del.requisitionId) : null;
    const deliveryWeighments = weighments.filter((w) => w.deliveryId === del.id);
    const latestWeighment = deliveryWeighments[deliveryWeighments.length - 1];

    const lines = del.lines.map((l) => ({
      ...l,
      product: prodMap.get(l.productId),
      uom: uomMap.get(l.uomId),
    }));

    // Calculate variance if weighment exists
    let weightVariance: number | null = null;
    let weightVariancePercent: number | null = null;
    if (latestWeighment && del.netWeight) {
      const declaredNet = Number(del.netWeight);
      const measuredNet = Number(latestWeighment.netWeight);
      weightVariance = measuredNet - declaredNet;
      weightVariancePercent = declaredNet > 0 ? (weightVariance / declaredNet) * 100 : 0;
    }

    return {
      ...del,
      supplier,
      requisition,
      lines,
      latestWeighment,
      weighments: deliveryWeighments,
      weightVariance,
      weightVariancePercent,
    };
  });

  res.json({ data: enriched });
});

const createDeliverySchema = z.object({
  requisitionId: z.string().uuid().optional(),
  supplierId: z.string().uuid(),
  invoiceNo: z.string().optional(),
  vehicleNo: z.string().min(2),
  grossWeight: z.coerce.number().positive().optional(),
  tareWeight: z.coerce.number().positive().optional(),
  netWeight: z.coerce.number().positive().optional(),
  lines: z.array(
    z.object({
      productId: z.string().uuid(),
      uomId: z.string().uuid(),
      declaredQty: z.coerce.number().positive(),
      unitPrice: z.coerce.number().positive().optional(),
    })
  ).min(1, "At least one delivery item is required"),
});

deliveriesRouter.post("/", async (req, res) => {
  const parsed = createDeliverySchema.parse(req.body);

  const count = await prisma.supplierDelivery.count({
    where: { organizationId: req.tenantId },
  });
  const year = new Date().getFullYear();
  const number = `CHAL-${year}-${String(count + 1).padStart(4, "0")}`;

  // If netWeight not directly provided, calculate from gross - tare
  let netWeight = parsed.netWeight;
  if (!netWeight && parsed.grossWeight && parsed.tareWeight) {
    netWeight = parsed.grossWeight - parsed.tareWeight;
  }

  const delivery = await prisma.supplierDelivery.create({
    data: {
      organizationId: req.tenantId!,
      number,
      requisitionId: parsed.requisitionId || null,
      supplierId: parsed.supplierId,
      invoiceNo: parsed.invoiceNo?.trim() || null,
      vehicleNo: parsed.vehicleNo.toUpperCase().trim(),
      grossWeight: parsed.grossWeight ? new Prisma.Decimal(parsed.grossWeight) : null,
      tareWeight: parsed.tareWeight ? new Prisma.Decimal(parsed.tareWeight) : null,
      netWeight: netWeight ? new Prisma.Decimal(netWeight) : null,
      status: DocumentStatus.SUBMITTED,
      deliveredAt: new Date(),
      lines: {
        create: parsed.lines.map((l) => ({
          productId: l.productId,
          uomId: l.uomId,
          declaredQty: new Prisma.Decimal(l.declaredQty),
          acceptedQty: new Prisma.Decimal(l.declaredQty),
          unitPrice: l.unitPrice ? new Prisma.Decimal(l.unitPrice) : null,
        })),
      },
    },
    include: {
      lines: true,
    },
  });

  res.status(201).json({ data: delivery });
});
