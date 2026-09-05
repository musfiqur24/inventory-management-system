import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";

export const partnersRouter = Router();

partnersRouter.get("/", async (req, res) => {
  const type = req.query.type as string | undefined;
  const partners = await prisma.partner.findMany({
    where: {
      organizationId: req.tenantId,
      isActive: true,
      ...(type ? { partnerType: type } : {}),
    },
    orderBy: { name: "asc" },
  });
  res.json({ data: partners });
});

const createPartnerSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  partnerType: z.enum(["SUPPLIER", "CUSTOMER"]),
  phone: z.string().optional(),
  address: z.string().optional(),
});

partnersRouter.post("/", async (req, res) => {
  const parsed = createPartnerSchema.parse(req.body);
  const partner = await prisma.partner.create({
    data: {
      organizationId: req.tenantId!,
      code: parsed.code.toUpperCase().trim(),
      name: parsed.name.trim(),
      partnerType: parsed.partnerType,
      phone: parsed.phone?.trim() || null,
      address: parsed.address?.trim() || null,
    },
  });
  res.status(201).json({ data: partner });
});
