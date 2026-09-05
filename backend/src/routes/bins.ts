import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { Prisma } from "../generated/prisma/client.js";

export const binsRouter = Router();

binsRouter.get("/", async (req, res) => {
  const typeFilter = req.query.type as string | undefined;
  const bins = await prisma.bin.findMany({
    where: {
      organizationId: req.tenantId,
      isActive: true,
      ...(typeFilter ? { warehouseType: typeFilter } : {}),
    },
    include: {
      balances: {
        include: {
          product: true,
          lot: true,
          uom: true,
        },
      },
    },
    orderBy: { code: "asc" },
  });

  const enriched = bins.map((bin) => {
    const currentOccupancy = bin.balances.reduce(
      (sum, b) => sum + Number(b.quantity),
      0
    );
    const capacityNum = bin.capacity ? Number(bin.capacity) : 0;
    const utilizationPercent =
      capacityNum > 0
        ? Math.min(100, Math.round((currentOccupancy / capacityNum) * 100))
        : 0;

    return {
      ...bin,
      currentOccupancy,
      utilizationPercent,
    };
  });

  res.json({ data: enriched });
});

const createBinSchema = z.object({
  siteId: z.string().uuid().optional(),
  code: z.string().min(2),
  name: z.string().min(2),
  zone: z.string().optional(),
  warehouseType: z.enum(["RM_STORE", "FM_STORE", "SILO", "FACTORY_FLOOR"]).default("RM_STORE"),
  capacity: z.coerce.number().positive().optional(),
});

binsRouter.post("/", async (req, res) => {
  const parsed = createBinSchema.parse(req.body);

  // If siteId not provided, pick first site for tenant or create a default plant site
  let siteId = parsed.siteId;
  if (!siteId) {
    const site = await prisma.site.findFirst({
      where: { organizationId: req.tenantId },
    });
    if (site) {
      siteId = site.id;
    } else {
      const newSite = await prisma.site.create({
        data: {
          organizationId: req.tenantId!,
          code: "MAIN-PLANT",
          name: "Main Production Plant",
        },
      });
      siteId = newSite.id;
    }
  }

  const bin = await prisma.bin.create({
    data: {
      organizationId: req.tenantId!,
      siteId,
      code: parsed.code.toUpperCase().trim(),
      name: parsed.name.trim(),
      zone: parsed.zone?.trim() || null,
      warehouseType: parsed.warehouseType,
      capacity: parsed.capacity ? new Prisma.Decimal(parsed.capacity) : null,
    },
  });

  res.status(201).json({ data: bin });
});
