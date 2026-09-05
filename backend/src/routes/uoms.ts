import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { Prisma } from "../generated/prisma/client.js";

export const uomsRouter = Router();

uomsRouter.get("/", async (req, res) => {
  const uoms = await prisma.unitOfMeasure.findMany({
    where: { organizationId: req.tenantId },
    orderBy: { code: "asc" },
  });
  res.json({ data: uoms });
});

const createUomSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1),
  dimension: z.string().default("WEIGHT"),
  factorToBase: z.coerce.number().positive(),
});

uomsRouter.post("/", async (req, res) => {
  const parsed = createUomSchema.parse(req.body);
  const uom = await prisma.unitOfMeasure.create({
    data: {
      organizationId: req.tenantId!,
      code: parsed.code.toLowerCase().trim(),
      name: parsed.name.trim(),
      dimension: parsed.dimension,
      factorToBase: new Prisma.Decimal(parsed.factorToBase),
    },
  });
  res.status(201).json({ data: uom });
});
