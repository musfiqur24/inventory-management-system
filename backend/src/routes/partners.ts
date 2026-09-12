import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import type { Prisma } from "../generated/prisma/client.js";

export const partnersRouter = Router();
partnersRouter.get("/", async (req, res) => {
  const type = req.query.type as string | undefined;
  const partners = await prisma.partner.findMany({
    where: { organizationId: req.tenantId, isActive: true, ...(type ? { partnerType: type } : {}) },
    orderBy: { name: "asc" },
  });
  res.json({ data: partners });
});
const optionalText = z.string().trim().nullable().optional().transform(value => value === "" ? null : value);
const createPartnerSchema = z.object({
  code: z.string().trim().min(2).transform(value => value.toUpperCase()),
  name: z.string().trim().min(2),
  partnerType: z.enum(["SUPPLIER", "CUSTOMER"]),
  phone: optionalText,
  address: optionalText,
  contactPerson: optionalText,
  email: z.union([z.string().trim().email(), z.literal(""), z.null()]).optional().transform(value => value === "" ? null : value),
});
const updatePartnerSchema = createPartnerSchema.partial().refine(value => Object.values(value).some(field => field !== undefined), { message: "Provide at least one field to update" });

async function isReferenced(tx: Prisma.TransactionClient, id: string) {
  const counts = await Promise.all([
    tx.purchaseRequisition.count({ where: { supplierId: id } }),
    tx.supplierDelivery.count({ where: { supplierId: id } }),
    tx.salesOrder.count({ where: { customerId: id } }),
  ]);
  return counts.some(count => count > 0);
}
partnersRouter.post("/", async (req, res) => {
  const parsed = createPartnerSchema.parse(req.body);
  const partner = await prisma.partner.create({ data: { ...parsed, organizationId: req.tenantId! } });
  res.status(201).json({ data: partner });
});
const updatePartner: RequestHandler = async (req, res) => {
  const parsed = (req.method === "PATCH" ? updatePartnerSchema : createPartnerSchema).parse(req.body);
  const result = await prisma.$transaction(async tx => {
    const where = { id: String(req.params.id), organizationId: req.tenantId!, isActive: true };
    const existing = await tx.partner.findFirst({ where });
    if (!existing) return { kind: "missing" as const };
    if (parsed.partnerType && parsed.partnerType !== existing.partnerType && await isReferenced(tx, existing.id)) return { kind: "in-use" as const };
    const partner = await tx.partner.update({ where, data: parsed });
    return { kind: "updated" as const, partner };
  });
  if (result.kind === "missing") { res.status(404).json({ error: { code: "NOT_FOUND", message: "Partner not found" } }); return; }
  if (result.kind === "in-use") { res.status(409).json({ error: { code: "PARTNER_IN_USE", message: "The type of a partner used in documents cannot be changed." } }); return; }
  res.json({ data: result.partner });
};
partnersRouter.put("/:id", updatePartner);
partnersRouter.patch("/:id", updatePartner);
partnersRouter.delete("/:id", async (req, res) => {
  const result = await prisma.$transaction(async tx => {
    const where = { id: String(req.params.id), organizationId: req.tenantId!, isActive: true };
    const existing = await tx.partner.findFirst({ where });
    if (!existing) return "missing";
    if (await isReferenced(tx, existing.id)) return "in-use";
    await tx.partner.delete({ where });
    return "deleted";
  });
  if (result === "missing") return res.status(404).json({ error: { code: "NOT_FOUND", message: "Partner not found" } });
  if (result === "in-use") return res.status(409).json({ error: { code: "PARTNER_IN_USE", message: "This partner is used in requisitions, deliveries, or sales orders and cannot be deleted." } });
  return res.status(204).send();
});
