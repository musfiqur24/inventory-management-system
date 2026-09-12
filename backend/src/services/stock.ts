import {
  Prisma,
  type MovementType,
  type StoreType,
} from "../generated/prisma/client.js";
export class StockError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}
export async function lockDocument(
  tx: Prisma.TransactionClient,
  table:
    | "SupplierDelivery"
    | "ProductionBatch"
    | "ProductionOrder"
    | "SalesOrder",
  id: string,
  organizationId: string,
) {
  await tx.$queryRawUnsafe(
    `SELECT id FROM "${table}" WHERE id=$1 AND "organizationId"=$2 FOR UPDATE`,
    id,
    organizationId,
  );
}
export async function convertQuantity(
  tx: Prisma.TransactionClient,
  organizationId: string,
  quantity: Prisma.Decimal | string | number,
  fromId: string,
  toId: string,
) {
  const units = await tx.unitOfMeasure.findMany({
    where: { organizationId, id: { in: [fromId, toId] } },
  });
  const from = units.find((u) => u.id === fromId),
    to = units.find((u) => u.id === toId);
  if (!from || !to || from.dimension !== to.dimension)
    throw new StockError(
      "INVALID_UOM",
      "The selected unit is incompatible with the stock unit.",
      422,
    );
  const result = new Prisma.Decimal(quantity)
    .mul(from.factorToBase)
    .div(to.factorToBase)
    .toDecimalPlaces(3);
  if (!result.isPositive())
    throw new StockError(
      "INVALID_QUANTITY",
      "Quantity must be greater than zero at stock precision.",
      422,
    );
  return result;
}
type Posting = {
  organizationId: string;
  binId: string;
  productId: string;
  lotId: string;
  uomId: string;
  quantity: Prisma.Decimal | string | number;
  direction: "IN" | "OUT";
  storeType: StoreType;
  movementType: MovementType;
  documentType: string;
  documentId: string;
  sourceDocumentId: string;
  sourceLineId?: string;
  referenceType?: string;
  referenceId?: string;
  referenceNumber?: string;
  postingKey?: string;
  performedById?: string;
  note?: string;
};
export async function postStock(tx: Prisma.TransactionClient, input: Posting) {
  // Lock the bin even when its balance does not exist yet. All receipt/release paths use this service.
  await tx.$queryRaw`SELECT id FROM "Bin" WHERE id=${input.binId} AND "organizationId"=${input.organizationId} FOR UPDATE`;
  const bin = await tx.bin.findFirst({
    where: {
      id: input.binId,
      organizationId: input.organizationId,
      isActive: true,
    },
    include: { store: true },
  });
  if (!bin || !bin.store.isActive || bin.store.storeType !== input.storeType)
    throw new StockError(
      "INVALID_BIN",
      `Select an active bin in an ${input.storeType === "RM_STORE" ? "RM" : "FM"} store.`,
      422,
    );
  const product = await tx.product.findFirst({
    where: {
      id: input.productId,
      organizationId: input.organizationId,
      isActive: true,
    },
  });
  const lot = await tx.lot.findFirst({
    where: {
      id: input.lotId,
      organizationId: input.organizationId,
      productId: input.productId,
    },
  });
  if (!product || !lot)
    throw new StockError(
      "INVALID_STOCK",
      "Product and lot must belong to this organization.",
      422,
    );
  const fmProduct = ["FINISHED_GOOD", "BY_PRODUCT"].includes(product.type);
  if (fmProduct !== (input.storeType === "FM_STORE"))
    throw new StockError(
      "WRONG_STORE_TYPE",
      "Product type does not match the selected store.",
      422,
    );
  if (
    input.direction === "OUT" &&
    (lot.qualityStatus !== "RELEASED" ||
      (lot.expiryDate && lot.expiryDate < new Date()))
  )
    throw new StockError(
      "LOT_UNAVAILABLE",
      "Held, rejected, or expired lots cannot be released.",
    );
  const where = {
    organizationId_productId_lotId_binId: {
      organizationId: input.organizationId,
      productId: input.productId,
      lotId: input.lotId,
      binId: input.binId,
    },
  };
  const existing = await tx.inventoryBalance.findUnique({ where });
  const uomId = existing?.uomId ?? product.baseUomId;
  const quantity = await convertQuantity(
    tx,
    input.organizationId,
    input.quantity,
    input.uomId,
    uomId,
  );
  if (
    input.direction === "OUT" &&
    (!existing || existing.quantity.minus(existing.reservedQty).lt(quantity))
  )
    throw new StockError(
      "INSUFFICIENT_STOCK",
      "Insufficient available stock in the selected bin.",
    );
  // Capacity is expressed in kg; enforce it only for weight-based stock.
  if (input.direction === "IN" && bin.capacity) {
    const unit = await tx.unitOfMeasure.findUniqueOrThrow({
      where: { id: uomId },
    });
    if (unit.dimension === "WEIGHT") {
      const balances = await tx.inventoryBalance.findMany({
        where: { binId: bin.id },
        include: { uom: true },
      });
      const weight = balances
        .filter((b) => b.uom.dimension === "WEIGHT")
        .reduce(
          (sum, b) => sum.plus(b.quantity.mul(b.uom.factorToBase)),
          new Prisma.Decimal(0),
        );
      if (weight.plus(quantity.mul(unit.factorToBase)).gt(bin.capacity))
        throw new StockError(
          "BIN_CAPACITY",
          "Receipt exceeds the bin weight capacity.",
        );
    }
  }
  const balance = existing
    ? await tx.inventoryBalance.update({
        where,
        data: {
          quantity:
            input.direction === "IN"
              ? { increment: quantity }
              : { decrement: quantity },
        },
      })
    : await tx.inventoryBalance.create({
        data: {
          ...where.organizationId_productId_lotId_binId,
          uomId,
          quantity,
        },
      });
  const movement = await tx.stockMovement.create({
    data: {
      organizationId: input.organizationId,
      movementType: input.movementType,
      productId: input.productId,
      lotId: input.lotId,
      ...(input.direction === "IN"
        ? { toBinId: bin.id, toStoreId: bin.storeId }
        : { fromBinId: bin.id, fromStoreId: bin.storeId }),
      quantity,
      uomId,
      documentType: input.documentType,
      documentId: input.documentId,
      sourceDocumentId: input.sourceDocumentId,
      sourceLineId: input.sourceLineId,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      referenceNumber: input.referenceNumber,
      postingKey: input.postingKey,
      performedById: input.performedById,
      note: input.note,
      balanceAfter: balance.quantity,
    },
  });
  return { balance, movement };
}
