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
  const exact = new Prisma.Decimal(quantity)
    .mul(from.factorToBase)
    .div(to.factorToBase);
  const result=exact.toDecimalPlaces(3);
  if(!exact.eq(result))throw new StockError('QUANTITY_PRECISION','Quantity cannot be represented exactly in the stock or document unit. Use a quantity with at most three decimals after conversion.',422);
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
  // Serialize RM postings across bins so threshold crossings are counted once.
  if (input.storeType === "RM_STORE") {
    const position = await tx.bin.findFirst({ where: { id: input.binId, organizationId: input.organizationId }, select: { storeId: true } });
    if (position) await tx.$queryRaw`SELECT id FROM "Store" WHERE id=${position.storeId} AND "organizationId"=${input.organizationId} FOR UPDATE`;
  }
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
  const reservations=input.direction==="OUT"&&existing&&input.referenceId?await tx.reservation.findMany({where:{organizationId:input.organizationId,balanceId:existing.id,sourceId:input.referenceId,quantity:{gt:0}},orderBy:{createdAt:"asc"}}):[];
  const owned=reservations.reduce((sum,r)=>sum.plus(r.quantity),new Prisma.Decimal(0));
  const consume=Prisma.Decimal.min(quantity,owned);
  if (
    input.direction === "OUT" &&
    (!existing || existing.quantity.minus(existing.reservedQty).plus(owned).lt(quantity))
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
          ...(input.direction==="OUT"?{reservedQty:{decrement:consume}}:{}),
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
  let toConsume=consume;
  for(const reservation of reservations){const used=Prisma.Decimal.min(reservation.quantity,toConsume);await tx.reservation.update({where:{id:reservation.id},data:{quantity:{decrement:used}}});toConsume=toConsume.minus(used);if(toConsume.lte(0))break;}
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
  if (input.storeType === "RM_STORE") {
    const positions = await tx.inventoryBalance.findMany({
      where: { organizationId: input.organizationId, productId: input.productId, bin: { storeId: bin.storeId } },
      include: { uom: true },
    });
    const unit = await tx.unitOfMeasure.findUniqueOrThrow({ where: { id: uomId } });
    if (unit.dimension === "WEIGHT") {
      // Weight factors use kg as their base, matching bin capacity validation.
      const after = positions.filter(b => b.uom.dimension === "WEIGHT").reduce(
        (sum, b) => sum.plus(b.quantity.mul(b.uom.factorToBase)), new Prisma.Decimal(0));
      const stateKey={organizationId_storeId_productId:{organizationId:input.organizationId,storeId:bin.storeId,productId:input.productId}};
      const state=await tx.reorderState.findUnique({where:stateKey});
      const low=after.lt(20);
      await tx.reorderState.upsert({where:stateKey,create:{...stateKey.organizationId_storeId_productId,low},update:{low}});
      if (low && !state?.low) {
        const members = await tx.organizationMember.findMany({
          where: { organizationId: input.organizationId, isActive: true, user: { isActive: true } },
          select: { userId: true },
        });
        await tx.notification.createMany({ data: members.map(member => ({
          organizationId: input.organizationId, recipientId: member.userId,
          title: "RM stock below reorder level",
          message: product.name + " (" + product.sku + ") in " + bin.store.name + " has " + after.toDecimalPlaces(3).toString() + " kg on hand, below the 20 kg reorder level.",
        })) });
      }
    }
  }
  await tx.auditEvent.create({data:{organizationId:input.organizationId,actorId:input.performedById,action:"STOCK_"+input.direction,resourceId:movement.id,details:{productId:input.productId,lotId:input.lotId,binId:input.binId,quantity:quantity.toString(),balanceAfter:balance.quantity.toString(),sourceDocumentId:input.sourceDocumentId}}});
  return { balance, movement };
}
