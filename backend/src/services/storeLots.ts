import { Prisma, type StoreType } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
export async function storeLots(organizationId: string, storeType: StoreType) {
  const lots = await prisma.lot.findMany({
    where: {
      organizationId,
      balances: { some: { bin: { store: { storeType } } } },
    },
    include: {
      balances: {
        where: { bin: { store: { storeType } } },
        include: {
          bin: { include: { store: true } },
          uom: true,
          product: true,
        },
      },
    },
    orderBy: { code: "asc" },
  });
  return lots.map((lot) => {
    const unit = lot.balances[0]?.uom;
    const currentQty = lot.balances.reduce(
      (sum, b) =>
        unit && b.uom.dimension === unit.dimension
          ? sum.plus(b.quantity.mul(b.uom.factorToBase).div(unit.factorToBase))
          : sum,
      new Prisma.Decimal(0),
    );
    return {
      ...lot,
      lotNumber: lot.code,
      currentQty,
      product: lot.balances[0]?.product,
      uom: unit,
      expiresAt: lot.expiryDate,
      status: lot.qualityStatus,
    };
  });
}
