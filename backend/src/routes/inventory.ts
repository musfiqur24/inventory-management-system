import { Router } from "express";
import { prisma } from "../prisma.js";

export const inventoryRouter = Router();

inventoryRouter.get("/balances", async (req, res) => {
  const type = req.query.type as string | undefined;

  const balances = await prisma.inventoryBalance.findMany({
    where: {
      organizationId: req.tenantId,
      ...(type ? { product: { type: type as any } } : {}),
    },
    include: {
      product: {
        include: {
          category: true,
        },
      },
      lot: true,
      bin: true,
      uom: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  res.json({ data: balances });
});

inventoryRouter.get("/movements", async (req, res) => {
  const movements = await prisma.stockMovement.findMany({
    where: { organizationId: req.tenantId },
    orderBy: { occurredAt: "desc" },
    take: 200,
  });

  const [products, lots, bins, uoms] = await Promise.all([
    prisma.product.findMany({ where: { organizationId: req.tenantId } }),
    prisma.lot.findMany({ where: { organizationId: req.tenantId } }),
    prisma.bin.findMany({ where: { organizationId: req.tenantId } }),
    prisma.unitOfMeasure.findMany({ where: { organizationId: req.tenantId } }),
  ]);

  const prodMap = new Map(products.map((p) => [p.id, p]));
  const lotMap = new Map(lots.map((l) => [l.id, l]));
  const binMap = new Map(bins.map((b) => [b.id, b]));
  const uomMap = new Map(uoms.map((u) => [u.id, u]));

  const enriched = movements.map((m) => ({
    ...m,
    product: prodMap.get(m.productId),
    lot: m.lotId ? lotMap.get(m.lotId) : null,
    fromBin: m.fromBinId ? binMap.get(m.fromBinId) : null,
    toBin: m.toBinId ? binMap.get(m.toBinId) : null,
    uom: uomMap.get(m.uomId),
  }));

  res.json({ data: enriched });
});
