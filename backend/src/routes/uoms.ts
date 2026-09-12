import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { Prisma, UomCategory } from "../generated/prisma/client.js";

export const uomsRouter = Router();

const categoryLabels: Record<UomCategory, string> = { WEIGHT: "Mass / Weight", VOLUME: "Volume", COUNT: "Count", LENGTH: "Length", AREA: "Area", TIME: "Time" };
uomsRouter.get("/categories", (_req, res) => {
  res.json({ data: Object.values(UomCategory).map(value => ({ value, label: categoryLabels[value] })) });
});

uomsRouter.get("/", async (req, res) => {
  const uoms = await prisma.unitOfMeasure.findMany({
    where: { organizationId: req.tenantId },
    orderBy: { code: "asc" },
  });
  res.json({ data: uoms });
});

const createUomSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1),
  dimension: z.enum(UomCategory).default("WEIGHT"),
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

const updateUomSchema = createUomSchema
  .partial()
  .extend({ dimension: z.enum(UomCategory).optional() })
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    { message: "Provide at least one field to update" },
  );

uomsRouter
  .route("/:id")
  .put(async (req, res) => {
    const parsed = createUomSchema.parse(req.body);
    const uom = await prisma.unitOfMeasure.update({
      where: { id: String(req.params.id), organizationId: req.tenantId! },
      data: {
        ...parsed,
        code: parsed.code.toLowerCase(),
        factorToBase: new Prisma.Decimal(parsed.factorToBase),
      },
    });
    res.json({ data: uom });
  })
  .patch(async (req, res) => {
    const parsed = updateUomSchema.parse(req.body);
    const uom = await prisma.unitOfMeasure.update({
      where: { id: String(req.params.id), organizationId: req.tenantId! },
      data: {
        ...parsed,
        ...(parsed.code !== undefined && { code: parsed.code.toLowerCase() }),
        ...(parsed.factorToBase !== undefined && {
          factorToBase: new Prisma.Decimal(parsed.factorToBase),
        }),
      },
    });
    res.json({ data: uom });
  });

uomsRouter.delete("/:id", async (req, res) => {
  const id = String(req.params.id);
  try {
    const result = await prisma.$transaction(async (tx) => {
      const uom = await tx.unitOfMeasure.findFirst({
        where: { id, organizationId: req.tenantId! },
      });
      if (!uom) return "missing";

      const references = await Promise.all([
        tx.product.count({ where: { baseUomId: id } }),
        tx.inventoryBalance.count({ where: { uomId: id } }),
        tx.purchaseRequisitionLine.count({ where: { uomId: id } }),
        tx.supplierDeliveryLine.count({ where: { uomId: id } }),
        tx.stockMovement.count({ where: { uomId: id } }),
        tx.recipeLine.count({ where: { uomId: id } }),
        tx.productionOrderLine.count({ where: { uomId: id } }),
        tx.materialIssueLine.count({ where: { uomId: id } }),
        tx.salesOrderLine.count({ where: { uomId: id } }),
        tx.dispatchLine.count({ where: { uomId: id } }),
      ]);
      if (references.some((count) => count > 0)) return "in-use";
      await tx.unitOfMeasure.delete({
        where: { id, organizationId: req.tenantId! },
      });
      return "deleted";
    });
    if (result === "missing")
      return res
        .status(404)
        .json({
          error: { code: "NOT_FOUND", message: "Unit of measure not found" },
        });
    if (result === "in-use")
      return res
        .status(409)
        .json({
          error: {
            code: "UOM_IN_USE",
            message:
              "This unit of measure is used by products or inventory documents and cannot be deleted.",
          },
        });
    return res.status(204).send();
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return res
        .status(409)
        .json({
          error: {
            code: "UOM_IN_USE",
            message: "This unit of measure is in use and cannot be deleted.",
          },
        });
    }
    throw error;
  }
});
