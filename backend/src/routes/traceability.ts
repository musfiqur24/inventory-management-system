import { Router } from "express";
import { prisma } from "../prisma.js";

export const traceabilityRouter = Router();

traceabilityRouter.get("/", async (req, res) => {
  const query = (req.query.q as string || "").trim().toLowerCase();

  const [
    lots,
    batches,
    dispatches,
    orders,
    deliveries,
    requisitions,
    products,
  ] = await Promise.all([
    prisma.lot.findMany({ where: { organizationId: req.tenantId }, take: 100 }),
    prisma.productionBatch.findMany({ where: { organizationId: req.tenantId }, take: 50 }),
    prisma.dispatch.findMany({ where: { organizationId: req.tenantId }, take: 50 }),
    prisma.productionOrder.findMany({ where: { organizationId: req.tenantId }, take: 50 }),
    prisma.supplierDelivery.findMany({ where: { organizationId: req.tenantId }, take: 50 }),
    prisma.purchaseRequisition.findMany({ where: { organizationId: req.tenantId }, take: 50 }),
    prisma.product.findMany({ where: { organizationId: req.tenantId } }),
  ]);

  const prodMap = new Map(products.map((p) => [p.id, p]));

  const results = [];

  for (const lot of lots) {
    const prod = prodMap.get(lot.productId);
    if (!query || lot.code.toLowerCase().includes(query) || (prod && prod.name.toLowerCase().includes(query))) {
      results.push({
        id: lot.id,
        code: lot.code,
        type: prod?.type === "FINISHED_GOOD" ? "FG_LOT" : "RM_LOT",
        title: `Lot: ${lot.code}`,
        subtitle: `${prod?.name || "Product"} · Expiry: ${lot.expiryDate ? new Date(lot.expiryDate).toLocaleDateString() : "N/A"}`,
        targetId: lot.code,
      });
    }
  }

  for (const disp of dispatches) {
    if (!query || disp.number.toLowerCase().includes(query) || (disp.vehicleNo && disp.vehicleNo.toLowerCase().includes(query))) {
      results.push({
        id: disp.id,
        code: disp.number,
        type: "DISPATCH",
        title: `Dispatch: ${disp.number}`,
        subtitle: `Vehicle: ${disp.vehicleNo || "N/A"} · Dispatched: ${disp.dispatchedAt ? new Date(disp.dispatchedAt).toLocaleDateString() : "N/A"}`,
        targetId: disp.number,
      });
    }
  }

  for (const batch of batches) {
    if (!query || batch.number.toLowerCase().includes(query)) {
      results.push({
        id: batch.id,
        code: batch.number,
        type: "PRODUCTION_BATCH",
        title: `Batch: ${batch.number}`,
        subtitle: `Output: ${batch.actualOutputQty} kg · Waste: ${batch.actualWastePercent}%`,
        targetId: batch.number,
      });
    }
  }

  for (const del of deliveries) {
    if (!query || del.number.toLowerCase().includes(query) || (del.vehicleNo && del.vehicleNo.toLowerCase().includes(query))) {
      results.push({
        id: del.id,
        code: del.number,
        type: "SUPPLIER_DELIVERY",
        title: `Supplier Challan: ${del.number}`,
        subtitle: `Vehicle: ${del.vehicleNo || "N/A"} · Net: ${del.netWeight} kg`,
        targetId: del.number,
      });
    }
  }

  for (const reqItem of requisitions) {
    if (!query || reqItem.number.toLowerCase().includes(query)) {
      results.push({
        id: reqItem.id,
        code: reqItem.number,
        type: "RM_REQUISITION",
        title: `RM Requisition: ${reqItem.number}`,
        subtitle: `Status: ${reqItem.status} · Requested: ${new Date(reqItem.requestedOn).toLocaleDateString()}`,
        targetId: reqItem.number,
      });
    }
  }

  res.json({ data: results });
});

const handleTrace = async (req: any, res: any) => {
  const idOrCode = req.params.identifier;
  const orgId = req.tenantId!;

  // 1. Try finding by Lot code or ID
  let fgLot = await prisma.lot.findFirst({
    where: {
      organizationId: orgId,
      OR: [{ id: idOrCode }, { code: idOrCode }],
    },
  });

  // 2. Try finding by Dispatch number or ID
  let dispatch = null;
  if (!fgLot) {
    dispatch = await prisma.dispatch.findFirst({
      where: {
        organizationId: orgId,
        OR: [{ id: idOrCode }, { number: idOrCode }],
      },
      include: { lines: true },
    });

    if (dispatch && dispatch.lines.length > 0 && dispatch.lines[0].lotId) {
      fgLot = await prisma.lot.findUnique({ where: { id: dispatch.lines[0].lotId } });
    }
  }

  // 3. Try finding by Batch number or ID
  let batch = null;
  if (!fgLot) {
    batch = await prisma.productionBatch.findFirst({
      where: {
        organizationId: orgId,
        OR: [{ id: idOrCode }, { number: idOrCode }],
      },
    });
    if (batch && batch.fgLotId) {
      fgLot = await prisma.lot.findUnique({ where: { id: batch.fgLotId } });
    }
  }

  // If still not found, check if it is an RM Lot
  let isRmLot = false;
  if (fgLot) {
    const product = await prisma.product.findUnique({ where: { id: fgLot.productId } });
    if (product?.type === "RAW_MATERIAL") {
      isRmLot = true;
    }
  }

  // Resolve Batch if not resolved
  if (fgLot && !batch && fgLot.productionBatchId) {
    batch = await prisma.productionBatch.findUnique({ where: { id: fgLot.productionBatchId } });
  }

  // Resolve Production Order (FM Requisition)
  let productionOrder = null;
  let recipe = null;
  let materialIssues: any[] = [];
  if (batch) {
    productionOrder = await prisma.productionOrder.findUnique({
      where: { id: batch.productionOrderId },
      include: { lines: true },
    });

    if (productionOrder) {
      recipe = await prisma.recipe.findUnique({
        where: { id: productionOrder.recipeId },
        include: { lines: true },
      });

      materialIssues = await prisma.materialIssue.findMany({
        where: { productionOrderId: productionOrder.id },
        include: { lines: true },
      });
    }
  }

  // Resolve RM components, RM Lots, Supplier Deliveries, and RM Requisitions
  const rmLotsFound: any[] = [];
  const supplierDeliveriesFound: any[] = [];
  const rmRequisitionsFound: any[] = [];
  const weighmentsFound: any[] = [];

  // If tracing from RM lot directly:
  if (isRmLot && fgLot) {
    rmLotsFound.push(fgLot);
    if (fgLot.supplierDeliveryId) {
      const del = await prisma.supplierDelivery.findUnique({
        where: { id: fgLot.supplierDeliveryId },
        include: { lines: true },
      });
      if (del) {
        supplierDeliveriesFound.push(del);
        const wbs = await prisma.weighment.findMany({ where: { deliveryId: del.id } });
        weighmentsFound.push(...wbs);

        if (del.requisitionId) {
          const r = await prisma.purchaseRequisition.findUnique({
            where: { id: del.requisitionId },
            include: { lines: true },
          });
          if (r) rmRequisitionsFound.push(r);
        }
      }
    }
  } else {
    // Collect from material issues
    for (const issue of materialIssues) {
      for (const line of issue.lines) {
        if (line.lotId) {
          const rmLot = await prisma.lot.findUnique({ where: { id: line.lotId } });
          if (rmLot) {
            rmLotsFound.push(rmLot);
            if (rmLot.supplierDeliveryId) {
              const del = await prisma.supplierDelivery.findUnique({
                where: { id: rmLot.supplierDeliveryId },
                include: { lines: true },
              });
              if (del && !supplierDeliveriesFound.some((d) => d.id === del.id)) {
                supplierDeliveriesFound.push(del);
                const wbs = await prisma.weighment.findMany({ where: { deliveryId: del.id } });
                weighmentsFound.push(...wbs);

                if (del.requisitionId) {
                  const r = await prisma.purchaseRequisition.findUnique({
                    where: { id: del.requisitionId },
                    include: { lines: true },
                  });
                  if (r && !rmRequisitionsFound.some((reqI) => reqI.id === r.id)) {
                    rmRequisitionsFound.push(r);
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // Resolve Dispatch and Sales Order if not yet found
  if (fgLot && !dispatch) {
    dispatch = await prisma.dispatch.findFirst({
      where: {
        organizationId: orgId,
        lines: {
          some: { lotId: fgLot.id },
        },
      },
      include: { lines: true },
    });
  }

  let salesOrder = null;
  let customer = null;
  if (dispatch) {
    salesOrder = await prisma.salesOrder.findUnique({
      where: { id: dispatch.salesOrderId },
      include: { lines: true },
    });
    if (salesOrder) {
      customer = await prisma.partner.findUnique({ where: { id: salesOrder.customerId } });
    }
  }

  // Lookup products, bins, and uoms for all entities
  const [allProducts, allBins, allUoms] = await Promise.all([
    prisma.product.findMany({ where: { organizationId: orgId } }),
    prisma.bin.findMany({ where: { organizationId: orgId } }),
    prisma.unitOfMeasure.findMany({ where: { organizationId: orgId } }),
  ]);

  const prodMap = new Map(allProducts.map((p) => [p.id, p]));
  const binMap = new Map(allBins.map((b) => [b.id, b]));
  const uomMap = new Map(allUoms.map((u) => [u.id, u]));

  // Get FM bin location for FG lot
  const fgBalance = fgLot
    ? await prisma.inventoryBalance.findFirst({
        where: { lotId: fgLot.id },
      })
    : null;
  const fgBin = fgBalance ? binMap.get(fgBalance.binId) : null;

  // Build genealogical trace graph
  res.json({
    data: {
      searchedIdentifier: idOrCode,
      targetType: isRmLot ? "RAW_MATERIAL" : "FINISHED_GOOD",
      salesOrder: salesOrder
        ? {
            ...salesOrder,
            customer,
          }
        : null,
      dispatch: dispatch
        ? {
            ...dispatch,
            lines: dispatch.lines.map((l: any) => ({
              ...l,
              product: prodMap.get(l.productId),
              uom: uomMap.get(l.uomId),
            })),
          }
        : null,
      fgLot: fgLot
        ? {
            ...fgLot,
            product: prodMap.get(fgLot.productId),
            bin: fgBin,
          }
        : null,
      productionBatch: batch,
      productionOrder: productionOrder
        ? {
            ...productionOrder,
            finishedProduct: prodMap.get(productionOrder.finishedProductId),
            recipe,
            lines: productionOrder.lines.map((l: any) => ({
              ...l,
              product: prodMap.get(l.productId),
              uom: uomMap.get(l.uomId),
            })),
          }
        : null,
      materialIssues: materialIssues.map((iss) => ({
        ...iss,
        lines: iss.lines.map((l: any) => ({
          ...l,
          product: prodMap.get(l.productId),
          uom: uomMap.get(l.uomId),
          fromBin: l.fromBinId ? binMap.get(l.fromBinId) : null,
        })),
      })),
      rmLots: rmLotsFound.map((l) => ({
        ...l,
        product: prodMap.get(l.productId),
      })),
      weighments: weighmentsFound,
      supplierDeliveries: supplierDeliveriesFound.map((del) => ({
        ...del,
        lines: del.lines.map((l: any) => ({
          ...l,
          product: prodMap.get(l.productId),
          uom: uomMap.get(l.uomId),
        })),
      })),
      rmRequisitions: rmRequisitionsFound.map((reqI) => ({
        ...reqI,
        lines: reqI.lines.map((l: any) => ({
          ...l,
          product: prodMap.get(l.productId),
          uom: uomMap.get(l.uomId),
        })),
      })),
    },
  });
};

traceabilityRouter.get("/:identifier", handleTrace);
traceabilityRouter.get("/:type/:identifier", handleTrace);

