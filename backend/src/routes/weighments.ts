import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { Prisma } from "../generated/prisma/client.js";

export const weighmentsRouter = Router();

weighmentsRouter.get("/", async (req, res) => {
  const weighments = await prisma.weighment.findMany({
    where: { organizationId: req.tenantId },
    orderBy: { measuredAt: "desc" },
  });

  const deliveries = await prisma.supplierDelivery.findMany({
    where: { organizationId: req.tenantId },
  });
  const delMap = new Map(deliveries.map((d) => [d.id, d]));

  const enriched = weighments.map((w) => {
    const delivery = w.deliveryId ? delMap.get(w.deliveryId) : null;
    let variance: number | null = null;
    let variancePercent: number | null = null;
    let isWarning = false;

    if (delivery && delivery.netWeight) {
      const declared = Number(delivery.netWeight);
      const measured = Number(w.netWeight);
      variance = measured - declared;
      variancePercent = declared > 0 ? (variance / declared) * 100 : 0;
      isWarning = Math.abs(variancePercent) > 0.5; // Warning if > 0.5% weight difference
    }

    return {
      ...w,
      delivery,
      variance,
      variancePercent,
      isWarning,
    };
  });

  res.json({ data: enriched });
});

const createWeighmentSchema = z.object({
  deliveryId: z.string().uuid().optional(),
  vehicleNo: z.string().min(2),
  grossWeight: z.coerce.number().positive(),
  tareWeight: z.coerce.number().positive(),
  operatorId: z.string().optional(),
});

weighmentsRouter.post("/", async (req, res) => {
  const parsed = createWeighmentSchema.parse(req.body);

  if (parsed.grossWeight <= parsed.tareWeight) {
    return res.status(400).json({
      error: {
        code: "INVALID_WEIGHT",
        message: "Gross weight must be strictly greater than tare weight",
      },
    });
  }

  const netWeight = parsed.grossWeight - parsed.tareWeight;

  const weighment = await prisma.weighment.create({
    data: {
      organizationId: req.tenantId!,
      deliveryId: parsed.deliveryId || null,
      vehicleNo: parsed.vehicleNo.toUpperCase().trim(),
      grossWeight: new Prisma.Decimal(parsed.grossWeight),
      tareWeight: new Prisma.Decimal(parsed.tareWeight),
      netWeight: new Prisma.Decimal(netWeight),
      operatorId: parsed.operatorId || "WB-OP-CURRENT",
      measuredAt: new Date(),
    },
  });

  // Calculate variance against delivery if provided
  let variance: number | null = null;
  let variancePercent: number | null = null;
  let isWarning = false;

  if (parsed.deliveryId) {
    const delivery = await prisma.supplierDelivery.findUnique({
      where: { id: parsed.deliveryId },
    });
    if (delivery && delivery.netWeight) {
      const declared = Number(delivery.netWeight);
      variance = netWeight - declared;
      variancePercent = declared > 0 ? (variance / declared) * 100 : 0;
      isWarning = Math.abs(variancePercent) > 0.5;
    }
  }

  res.status(201).json({
    data: {
      ...weighment,
      variance,
      variancePercent,
      isWarning,
    },
  });
});
