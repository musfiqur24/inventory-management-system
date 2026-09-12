import "dotenv/config";
import { Prisma, ProductType, DocumentStatus, QualityStatus, MovementType } from "../src/generated/prisma/client.js";
import { prisma } from "../src/prisma.js";
const Decimal = Prisma.Decimal;

async function main() {
  console.log("Seeding Feed Production Inventory System database...");

  // 1. Organizations
  const apex = await prisma.organization.upsert({
    where: { code: "APEX-FEED" },
    update: {},
    create: {
      code: "APEX-FEED",
      name: "Apex Feed Mills Ltd.",
      isActive: true,
    },
  });

  const delta = await prisma.organization.upsert({
    where: { code: "DELTA-AGRO" },
    update: {},
    create: {
      code: "DELTA-AGRO",
      name: "Delta Agro-Industries",
      isActive: true,
    },
  });

  const orgId = apex.id;

  // 2. Sites
  const siteMain = await prisma.site.upsert({
    where: { organizationId_code: { organizationId: orgId, code: "PLANT-01" } },
    update: {},
    create: {
      organizationId: orgId,
      code: "PLANT-01",
      name: "Apex Central Feed Plant - Gazipur",
      address: "Plot 45-52, Industrial Zone, Gazipur, Dhaka",
    },
  });

  // 3. Dynamic Units of Measure (UOMs)
  const uomConfigs = [
    { code: "kg", name: "Kilogram", dimension: "WEIGHT", factorToBase: 1.0 },
    { code: "ton", name: "Metric Tonne", dimension: "WEIGHT", factorToBase: 1000.0 },
    { code: "bag_50kg", name: "50kg Woven Bag", dimension: "WEIGHT", factorToBase: 50.0 },
    { code: "bag_25kg", name: "25kg Woven Bag", dimension: "WEIGHT", factorToBase: 25.0 },
    { code: "g", name: "Gram", dimension: "WEIGHT", factorToBase: 0.001 },
    { code: "liter", name: "Liter", dimension: "VOLUME", factorToBase: 1.0 },
  ];

  const uomMap: Record<string, string> = {};
  for (const u of uomConfigs) {
    const record = await prisma.unitOfMeasure.upsert({
      where: { organizationId_code: { organizationId: orgId, code: u.code } },
      update: { factorToBase: new Decimal(u.factorToBase) },
      create: {
        organizationId: orgId,
        code: u.code,
        name: u.name,
        dimension: u.dimension as "WEIGHT" | "VOLUME",
        factorToBase: new Decimal(u.factorToBase),
      },
    });
    uomMap[u.code] = record.id;
  }

  const groupRaw = await prisma.groupLayer.upsert({ where: { organizationId_code: { organizationId: orgId, code: 'RM' } }, update: {}, create: { organizationId: orgId, code: 'RM', name: 'Raw Materials' } });
  const groupFinished = await prisma.groupLayer.upsert({ where: { organizationId_code: { organizationId: orgId, code: 'FG' } }, update: {}, create: { organizationId: orgId, code: 'FG', name: 'Finished Goods' } });
  // 4. 5-Layer Product Hierarchy (L1: Type -> L2: Division -> L3: Feed Line -> L4: Stage/Form -> L5: SKU)
  // L1: Finished Goods Categories
  const catL2Poultry = await prisma.controlLayer.upsert({
    where: { organizationId_code: { organizationId: orgId, code: "CAT-FG-POULTRY" } },
    update: {},
    create: {
      organizationId: orgId,
      parentId: groupFinished.id,
      code: "CAT-FG-POULTRY",
      name: "Poultry Feed Division",
    },
  });

  const catL2Aqua = await prisma.controlLayer.upsert({
    where: { organizationId_code: { organizationId: orgId, code: "CAT-FG-AQUA" } },
    update: {},
    create: {
      organizationId: orgId,
      parentId: groupFinished.id,
      code: "CAT-FG-AQUA",
      name: "Aqua Feed Division",
    },
  });

  // L2 Raw Materials Categories
  const catL2Grains = await prisma.controlLayer.upsert({
    where: { organizationId_code: { organizationId: orgId, code: "CAT-RM-GRAINS" } },
    update: {},
    create: {
      organizationId: orgId,
      parentId: groupRaw.id,
      code: "CAT-RM-GRAINS",
      name: "Grains & Energy Sources",
    },
  });

  const catL2PlantProtein = await prisma.controlLayer.upsert({
    where: { organizationId_code: { organizationId: orgId, code: "CAT-RM-PLANT-PROT" } },
    update: {},
    create: {
      organizationId: orgId,
      parentId: groupRaw.id,
      code: "CAT-RM-PLANT-PROT",
      name: "Plant Protein Meals",
    },
  });

  const catL2AnimalProtein = await prisma.controlLayer.upsert({
    where: { organizationId_code: { organizationId: orgId, code: "CAT-RM-ANIM-PROT" } },
    update: {},
    create: {
      organizationId: orgId,
      parentId: groupRaw.id,
      code: "CAT-RM-ANIM-PROT",
      name: "Animal Protein Sources",
    },
  });

  const catL2Micros = await prisma.controlLayer.upsert({
    where: { organizationId_code: { organizationId: orgId, code: "CAT-RM-MICROS" } },
    update: {},
    create: {
      organizationId: orgId,
      parentId: groupRaw.id,
      code: "CAT-RM-MICROS",
      name: "Premixes, Vitamins & Amino Acids",
    },
  });

  const catL2Minerals = await prisma.controlLayer.upsert({
    where: { organizationId_code: { organizationId: orgId, code: "CAT-RM-MINERALS" } },
    update: {},
    create: {
      organizationId: orgId,
      parentId: groupRaw.id,
      code: "CAT-RM-MINERALS",
      name: "Minerals & Additives",
    },
  });

  // L3 Lines
  const catL3Broiler = await prisma.subLayer.upsert({
    where: { organizationId_code: { organizationId: orgId, code: "CAT-LINE-BROILER" } },
    update: {},
    create: {
      organizationId: orgId,
      parentId: catL2Poultry.id,
      code: "CAT-LINE-BROILER",
      name: "Broiler Commercial Feeds",
    },
  });

  const catL3Layer = await prisma.subLayer.upsert({
    where: { organizationId_code: { organizationId: orgId, code: "CAT-LINE-LAYER" } },
    update: {},
    create: {
      organizationId: orgId,
      parentId: catL2Poultry.id,
      code: "CAT-LINE-LAYER",
      name: "Commercial Layer Feeds",
    },
  });

  const catL3Corn = await prisma.subLayer.upsert({
    where: { organizationId_code: { organizationId: orgId, code: "CAT-LINE-CORN" } },
    update: {},
    create: {
      organizationId: orgId,
      parentId: catL2Grains.id,
      code: "CAT-LINE-CORN",
      name: "Yellow Maize & Grains",
    },
  });

  const catL3SBM = await prisma.subLayer.upsert({
    where: { organizationId_code: { organizationId: orgId, code: "CAT-LINE-SBM" } },
    update: {},
    create: {
      organizationId: orgId,
      parentId: catL2PlantProtein.id,
      code: "CAT-LINE-SBM",
      name: "Soybean Meal Products",
    },
  });

  // L4 Stages
  const catL4BroilerStarter = await prisma.subSubLayer.upsert({
    where: { organizationId_code: { organizationId: orgId, code: "CAT-STG-BROIL-START" } },
    update: {},
    create: {
      organizationId: orgId,
      parentId: catL3Broiler.id,
      code: "CAT-STG-BROIL-START",
      name: "Starter Phase Crumble (Day 1 - 14)",
    },
  });

  const catL4BroilerGrower = await prisma.subSubLayer.upsert({
    where: { organizationId_code: { organizationId: orgId, code: "CAT-STG-BROIL-GROW" } },
    update: {},
    create: {
      organizationId: orgId,
      parentId: catL3Broiler.id,
      code: "CAT-STG-BROIL-GROW",
      name: "Grower Phase Pellet (Day 15 - 28)",
    },
  });

  // Complete parent chains for seeded products previously attached to earlier layers.
  async function productLeaf(categoryId: string): Promise<string> {
    if (await prisma.subSubLayer.findFirst({ where: { id: categoryId, organizationId: orgId } })) return categoryId;
    let sub = await prisma.subLayer.findFirst({ where: { id: categoryId, organizationId: orgId } });
    if (!sub) {
      const control = await prisma.controlLayer.findFirstOrThrow({ where: { id: categoryId, organizationId: orgId } });
      sub = await prisma.subLayer.upsert({ where: { organizationId_code: { organizationId: orgId, code: 'SEED-' + control.code } }, update: {}, create: { organizationId: orgId, parentId: control.id, code: 'SEED-' + control.code, name: control.name + ' - General' } });
    }
    const leaf = await prisma.subSubLayer.upsert({ where: { organizationId_code: { organizationId: orgId, code: 'SEED-' + sub.code } }, update: {}, create: { organizationId: orgId, parentId: sub.id, code: 'SEED-' + sub.code, name: sub.name + ' - General' } });
    return leaf.id;
  }
  // 5. Products (Level 5)
  // Raw Materials
  const rawProducts = [
    { sku: "RM-CORN-01", name: "Prime Yellow Maize / Corn", type: ProductType.RAW_MATERIAL, catId: catL3Corn.id, uom: "kg", shelfLife: 180, reorder: 50000 },
    { sku: "RM-SBM-01", name: "Soybean Meal 46% CP (Dehulled)", type: ProductType.RAW_MATERIAL, catId: catL3SBM.id, uom: "kg", shelfLife: 180, reorder: 30000 },
    { sku: "RM-FISH-01", name: "Steam Dried Fish Meal 60% CP", type: ProductType.RAW_MATERIAL, catId: catL2AnimalProtein.id, uom: "kg", shelfLife: 120, reorder: 10000 },
    { sku: "RM-SOYOIL-01", name: "Crude Degummed Soybean Oil", type: ProductType.RAW_MATERIAL, catId: catL2Grains.id, uom: "kg", shelfLife: 180, reorder: 5000 },
    { sku: "RM-DCP-01", name: "Di-Calcium Phosphate 18% P", type: ProductType.RAW_MATERIAL, catId: catL2Minerals.id, uom: "kg", shelfLife: 365, reorder: 5000 },
    { sku: "RM-LIME-01", name: "Feed Grade Calcium Limestone Powder", type: ProductType.RAW_MATERIAL, catId: catL2Minerals.id, uom: "kg", shelfLife: 365, reorder: 10000 },
    { sku: "RM-PREMIX-01", name: "Broiler Vitamin & Mineral Premix 0.25%", type: ProductType.RAW_MATERIAL, catId: catL2Micros.id, uom: "kg", shelfLife: 180, reorder: 1000 },
    { sku: "RM-MET-01", name: "DL-Methionine 99% Feed Grade", type: ProductType.RAW_MATERIAL, catId: catL2Micros.id, uom: "kg", shelfLife: 365, reorder: 1000 },
    { sku: "RM-LYS-01", name: "L-Lysine HCl 98.5%", type: ProductType.RAW_MATERIAL, catId: catL2Micros.id, uom: "kg", shelfLife: 365, reorder: 1000 },
  ];

  const productMap: Record<string, string> = {};
  for (const p of rawProducts) {
    const record = await prisma.product.upsert({
      where: { organizationId_sku: { organizationId: orgId, sku: p.sku } },
      update: {},
      create: {
        organizationId: orgId,
        sku: p.sku,
        name: p.name,
        type: p.type,
        categoryId: await productLeaf(p.catId),
        baseUomId: uomMap[p.uom],
        shelfLifeDays: p.shelfLife,
        reorderLevel: new Decimal(p.reorder),
      },
    });
    productMap[p.sku] = record.id;
  }

  // Finished Goods (Level 5)
  const fgProducts = [
    { sku: "FG-BROIL-START-01", name: "Apex Supreme Broiler Starter Crumble (50kg)", type: ProductType.FINISHED_GOOD, catId: catL4BroilerStarter.id, uom: "bag_50kg", shelfLife: 90, reorder: 500 },
    { sku: "FG-BROIL-GROW-02", name: "Apex Rapid Broiler Grower Pellet (50kg)", type: ProductType.FINISHED_GOOD, catId: catL4BroilerGrower.id, uom: "bag_50kg", shelfLife: 90, reorder: 500 },
    { sku: "FG-LAY-PHASE1-01", name: "Apex High-Yield Layer Mash (50kg)", type: ProductType.FINISHED_GOOD, catId: catL3Layer.id, uom: "bag_50kg", shelfLife: 90, reorder: 300 },
  ];

  for (const p of fgProducts) {
    const record = await prisma.product.upsert({
      where: { organizationId_sku: { organizationId: orgId, sku: p.sku } },
      update: {},
      create: {
        organizationId: orgId,
        sku: p.sku,
        name: p.name,
        type: p.type,
        categoryId: await productLeaf(p.catId),
        baseUomId: uomMap[p.uom],
        shelfLifeDays: p.shelfLife,
        reorderLevel: new Decimal(p.reorder),
      },
    });
    productMap[p.sku] = record.id;
  }

  // 6. Partners (Suppliers & Customers)
  const partners = [
    { code: "SUP-001", name: "National Grain & Agro Traders Ltd.", type: "SUPPLIER", phone: "+880 1711 223344", address: "Khatunganj Commercial Area, Chittagong" },
    { code: "SUP-002", name: "Bengal Oil Mills & Agro Imports", type: "SUPPLIER", phone: "+880 1819 556677", address: "Narayanganj Port Road, Dhaka" },
    { code: "SUP-003", name: "Marine Bio-Products Ltd.", type: "SUPPLIER", phone: "+880 1912 334455", address: "Cox's Bazar Coastal Hub" },
    { code: "SUP-004", name: "Chemo-Agro Nutrients International", type: "SUPPLIER", phone: "+880 1714 889900", address: "Banani, Dhaka" },
    { code: "CUST-001", name: "Green Valley Broiler Farms Ltd.", type: "CUSTOMER", phone: "+880 1715 001122", address: "Mymensingh Highway, Bhaluka" },
    { code: "CUST-002", name: "Sonali Breeder & Hatchery Complex", type: "CUSTOMER", phone: "+880 1811 445566", address: "Bogra Central, Bogra" },
  ];

  const partnerMap: Record<string, string> = {};
  for (const p of partners) {
    const record = await prisma.partner.upsert({
      where: { organizationId_code: { organizationId: orgId, code: p.code } },
      update: {},
      create: {
        organizationId: orgId,
        code: p.code,
        name: p.name,
        partnerType: p.type,
        phone: p.phone,
        address: p.address,
      },
    });
    partnerMap[p.code] = record.id;
  }

  // 7. Warehouses & Bins
  const bins = [
    { code: "SILO-01", name: "Grain Steel Silo #1 (Corn)", zone: "RM_SILO", warehouseType: "RM_STORE", capacity: 500000 },
    { code: "SILO-02", name: "Meal Steel Silo #2 (SBM)", zone: "RM_SILO", warehouseType: "RM_STORE", capacity: 300000 },
    { code: "BIN-RM-A1", name: "RM Warehouse Bay A-1 (Fish Meal)", zone: "RM_BAY", warehouseType: "RM_STORE", capacity: 50000 },
    { code: "BIN-RM-M1", name: "AC Micro-Nutrient Vault M-1", zone: "RM_AC_ROOM", warehouseType: "RM_STORE", capacity: 15000 },
    { code: "BIN-FM-P1", name: "Finished Goods Pallet Bay P-01", zone: "FM_BAY", warehouseType: "FM_STORE", capacity: 100000 },
    { code: "BIN-FM-P2", name: "Finished Goods Pallet Bay P-02", zone: "FM_BAY", warehouseType: "FM_STORE", capacity: 100000 },
  ];

  const binMap: Record<string, string> = {};
  for (const b of bins) {
    const record = await prisma.bin.upsert({
      where: { organizationId_siteId_code: { organizationId: orgId, siteId: siteMain.id, code: b.code } },
      update: { warehouseType: b.warehouseType, zone: b.zone, capacity: new Decimal(b.capacity) },
      create: {
        organizationId: orgId,
        siteId: siteMain.id,
        code: b.code,
        name: b.name,
        zone: b.zone,
        warehouseType: b.warehouseType,
        capacity: new Decimal(b.capacity),
      },
    });
    binMap[b.code] = record.id;
  }

  // 8. Recipe (Nutritionist Master Formula per 1 Ton / 1,000 kg with 2.5% Waste)
  const fgBroilerId = productMap["FG-BROIL-START-01"];
  const recipe = await prisma.recipe.upsert({
    where: { organizationId_finishedProductId_version: { organizationId: orgId, finishedProductId: fgBroilerId, version: 1 } },
    update: {},
    create: {
      organizationId: orgId,
      finishedProductId: fgBroilerId,
      version: 1,
      outputQty: new Decimal(1000.0), // 1 Ton basis
      outputUomId: uomMap["kg"],
      status: DocumentStatus.APPROVED,
      wastePercent: new Decimal(2.5), // 2.5% production loss
      effectiveFrom: new Date(),
    },
  });

  // Delete existing lines if any before re-adding
  await prisma.recipeLine.deleteMany({ where: { recipeId: recipe.id } });
  await prisma.recipeLine.createMany({
    data: [
      { recipeId: recipe.id, rawProductId: productMap["RM-CORN-01"], uomId: uomMap["kg"], quantityPerOutput: new Decimal(550.0) }, // 55%
      { recipeId: recipe.id, rawProductId: productMap["RM-SBM-01"], uomId: uomMap["kg"], quantityPerOutput: new Decimal(330.0) }, // 33%
      { recipeId: recipe.id, rawProductId: productMap["RM-FISH-01"], uomId: uomMap["kg"], quantityPerOutput: new Decimal(50.0) }, // 5%
      { recipeId: recipe.id, rawProductId: productMap["RM-SOYOIL-01"], uomId: uomMap["kg"], quantityPerOutput: new Decimal(25.0) }, // 2.5%
      { recipeId: recipe.id, rawProductId: productMap["RM-DCP-01"], uomId: uomMap["kg"], quantityPerOutput: new Decimal(18.0) }, // 1.8%
      { recipeId: recipe.id, rawProductId: productMap["RM-LIME-01"], uomId: uomMap["kg"], quantityPerOutput: new Decimal(14.0) }, // 1.4%
      { recipeId: recipe.id, rawProductId: productMap["RM-PREMIX-01"], uomId: uomMap["kg"], quantityPerOutput: new Decimal(2.5) }, // 0.25%
      { recipeId: recipe.id, rawProductId: productMap["RM-MET-01"], uomId: uomMap["kg"], quantityPerOutput: new Decimal(3.5) }, // 0.35%
      { recipeId: recipe.id, rawProductId: productMap["RM-LYS-01"], uomId: uomMap["kg"], quantityPerOutput: new Decimal(7.0) }, // 0.7%
    ],
  });

  // 9. Workflow Seed Transactions (Traceability Chain)
  // Step 1: RM Purchase Requisition
  const reqNumber = "RM-REQ-2026-0001";
  const rmReq = await prisma.purchaseRequisition.upsert({
    where: { organizationId_number: { organizationId: orgId, number: reqNumber } },
    update: {},
    create: {
      organizationId: orgId,
      number: reqNumber,
      salesOrderRef: "SO-DEMAND-2026-Q1",
      supplierId: partnerMap["SUP-001"],
      status: DocumentStatus.APPROVED,
      requestedOn: new Date(Date.now() - 7 * 86400000),
      approvedAt: new Date(Date.now() - 6 * 86400000),
    },
  });

  await prisma.purchaseRequisitionLine.deleteMany({ where: { requisitionId: rmReq.id } });
  await prisma.purchaseRequisitionLine.create({
    data: {
      requisitionId: rmReq.id,
      productId: productMap["RM-CORN-01"],
      uomId: uomMap["kg"],
      requestedQty: new Decimal(30000.0),
      receivedQty: new Decimal(29950.0),
      unitPrice: new Decimal(34.50),
    },
  });

  // Step 2 & 3: Supplier Delivery Challan & Weighbridge Measurement
  const chalNumber = "CHAL-2026-8841";
  const delivery = await prisma.supplierDelivery.upsert({
    where: { organizationId_number: { organizationId: orgId, number: chalNumber } },
    update: {},
    create: {
      organizationId: orgId,
      number: chalNumber,
      requisitionId: rmReq.id,
      supplierId: partnerMap["SUP-001"],
      invoiceNo: "INV-NGT-2026-901",
      vehicleNo: "DHK-METRO-TA-11-4092",
      grossWeight: new Decimal(42500.0),
      tareWeight: new Decimal(12500.0),
      netWeight: new Decimal(30000.0), // Declared Net Weight
      status: DocumentStatus.RECEIVED,
      deliveredAt: new Date(Date.now() - 5 * 86400000),
    },
  });

  await prisma.supplierDeliveryLine.deleteMany({ where: { deliveryId: delivery.id } });
  await prisma.supplierDeliveryLine.create({
    data: {
      deliveryId: delivery.id,
      productId: productMap["RM-CORN-01"],
      uomId: uomMap["kg"],
      declaredQty: new Decimal(30000.0),
      acceptedQty: new Decimal(29950.0),
      unitPrice: new Decimal(34.50),
    },
  });

  // Weighbridge physical scale recording
  await prisma.weighment.create({
    data: {
      organizationId: orgId,
      deliveryId: delivery.id,
      vehicleNo: "DHK-METRO-TA-11-4092",
      grossWeight: new Decimal(42500.0),
      tareWeight: new Decimal(12550.0), // 50kg higher tare weight
      netWeight: new Decimal(29950.0), // Actual physical net weight (-50kg variance)
      measuredAt: new Date(Date.now() - 5 * 86400000),
      operatorId: "WB-OP-01",
    },
  });

  // Step 4 & 5: RM Store Verification, Lot Creation & Bin Put-Away
  const lotCornCode = "LOT-RM-CORN-2026-0104";
  const rmLot = await prisma.lot.upsert({
    where: { organizationId_code: { organizationId: orgId, code: lotCornCode } },
    update: {},
    create: {
      organizationId: orgId,
      productId: productMap["RM-CORN-01"],
      code: lotCornCode,
      supplierDeliveryId: delivery.id,
      manufactureDate: new Date(Date.now() - 10 * 86400000),
      expiryDate: new Date(Date.now() + 170 * 86400000),
      qualityStatus: QualityStatus.RELEASED,
    },
  });

  // Put away into SILO-01
  await prisma.inventoryBalance.upsert({
    where: {
      organizationId_productId_lotId_binId: {
        organizationId: orgId,
        productId: productMap["RM-CORN-01"],
        lotId: rmLot.id,
        binId: binMap["SILO-01"],
      },
    },
    update: { quantity: new Decimal(18675.0) }, // 29950 received - 11275 issued = 18675 remaining
    create: {
      organizationId: orgId,
      productId: productMap["RM-CORN-01"],
      lotId: rmLot.id,
      binId: binMap["SILO-01"],
      uomId: uomMap["kg"],
      quantity: new Decimal(18675.0),
      reservedQty: new Decimal(0),
    },
  });

  await prisma.stockMovement.create({
    data: {
      organizationId: orgId,
      movementType: MovementType.RECEIPT,
      productId: productMap["RM-CORN-01"],
      lotId: rmLot.id,
      toBinId: binMap["SILO-01"],
      quantity: new Decimal(29950.0),
      uomId: uomMap["kg"],
      documentType: "SUPPLIER_DELIVERY",
      documentId: delivery.number,
      occurredAt: new Date(Date.now() - 5 * 86400000),
      note: `Received from ${delivery.number} against ${reqNumber}. Verified on weighbridge.`,
    },
  });

  // Seed inventory balances for other ingredients in their bins so production can run
  const otherRMStock = [
    { sku: "RM-SBM-01", bin: "SILO-02", qty: 45000, lotCode: "LOT-RM-SBM-2026-009" },
    { sku: "RM-FISH-01", bin: "BIN-RM-A1", qty: 12000, lotCode: "LOT-RM-FISH-2026-003" },
    { sku: "RM-SOYOIL-01", bin: "BIN-RM-A1", qty: 8000, lotCode: "LOT-RM-OIL-2026-001" },
    { sku: "RM-DCP-01", bin: "BIN-RM-M1", qty: 4500, lotCode: "LOT-RM-DCP-2026-001" },
    { sku: "RM-LIME-01", bin: "BIN-RM-A1", qty: 9000, lotCode: "LOT-RM-LIME-2026-001" },
    { sku: "RM-PREMIX-01", bin: "BIN-RM-M1", qty: 850, lotCode: "LOT-RM-PREMIX-2026-001" },
    { sku: "RM-MET-01", bin: "BIN-RM-M1", qty: 950, lotCode: "LOT-RM-MET-2026-001" },
    { sku: "RM-LYS-01", bin: "BIN-RM-M1", qty: 900, lotCode: "LOT-RM-LYS-2026-001" },
  ];

  for (const item of otherRMStock) {
    const lot = await prisma.lot.upsert({
      where: { organizationId_code: { organizationId: orgId, code: item.lotCode } },
      update: {},
      create: {
        organizationId: orgId,
        productId: productMap[item.sku],
        code: item.lotCode,
        expiryDate: new Date(Date.now() + 180 * 86400000),
        qualityStatus: QualityStatus.RELEASED,
      },
    });

    await prisma.inventoryBalance.upsert({
      where: {
        organizationId_productId_lotId_binId: {
          organizationId: orgId,
          productId: productMap[item.sku],
          lotId: lot.id,
          binId: binMap[item.bin],
        },
      },
      update: { quantity: new Decimal(item.qty) },
      create: {
        organizationId: orgId,
        productId: productMap[item.sku],
        lotId: lot.id,
        binId: binMap[item.bin],
        uomId: uomMap["kg"],
        quantity: new Decimal(item.qty),
        reservedQty: new Decimal(0),
      },
    });
  }

  // Step 6 & 7: Production Manager FM Requisition (Production Order)
  // Target: 20 Tonnes Broiler Starter Crumble
  // 1 Ton Recipe * 20 * (1 + 0.025 waste)
  const poNumber = "FM-REQ-2026-0005";
  const prodOrder = await prisma.productionOrder.upsert({
    where: { organizationId_number: { organizationId: orgId, number: poNumber } },
    update: {},
    create: {
      organizationId: orgId,
      number: poNumber,
      finishedProductId: fgBroilerId,
      recipeId: recipe.id,
      plannedQty: new Decimal(20000.0), // 20 Tonnes in kg
      plannedUomId: uomMap["kg"],
      expectedWastePercent: new Decimal(2.5),
      status: DocumentStatus.APPROVED,
      scheduledFor: new Date(Date.now() - 3 * 86400000),
    },
  });

  await prisma.productionOrderLine.deleteMany({ where: { productionOrderId: prodOrder.id } });
  await prisma.productionOrderLine.createMany({
    data: [
      { productionOrderId: prodOrder.id, productId: productMap["RM-CORN-01"], uomId: uomMap["kg"], recipeQty: new Decimal(11000.0), wasteAdjustedQty: new Decimal(11275.0), issuedQty: new Decimal(11275.0) },
      { productionOrderId: prodOrder.id, productId: productMap["RM-SBM-01"], uomId: uomMap["kg"], recipeQty: new Decimal(6600.0), wasteAdjustedQty: new Decimal(6765.0), issuedQty: new Decimal(6765.0) },
      { productionOrderId: prodOrder.id, productId: productMap["RM-FISH-01"], uomId: uomMap["kg"], recipeQty: new Decimal(1000.0), wasteAdjustedQty: new Decimal(1025.0), issuedQty: new Decimal(1025.0) },
      { productionOrderId: prodOrder.id, productId: productMap["RM-SOYOIL-01"], uomId: uomMap["kg"], recipeQty: new Decimal(500.0), wasteAdjustedQty: new Decimal(512.5), issuedQty: new Decimal(512.5) },
      { productionOrderId: prodOrder.id, productId: productMap["RM-DCP-01"], uomId: uomMap["kg"], recipeQty: new Decimal(360.0), wasteAdjustedQty: new Decimal(369.0), issuedQty: new Decimal(369.0) },
      { productionOrderId: prodOrder.id, productId: productMap["RM-LIME-01"], uomId: uomMap["kg"], recipeQty: new Decimal(280.0), wasteAdjustedQty: new Decimal(287.0), issuedQty: new Decimal(287.0) },
      { productionOrderId: prodOrder.id, productId: productMap["RM-PREMIX-01"], uomId: uomMap["kg"], recipeQty: new Decimal(50.0), wasteAdjustedQty: new Decimal(51.25), issuedQty: new Decimal(51.25) },
      { productionOrderId: prodOrder.id, productId: productMap["RM-MET-01"], uomId: uomMap["kg"], recipeQty: new Decimal(70.0), wasteAdjustedQty: new Decimal(71.75), issuedQty: new Decimal(71.75) },
      { productionOrderId: prodOrder.id, productId: productMap["RM-LYS-01"], uomId: uomMap["kg"], recipeQty: new Decimal(140.0), wasteAdjustedQty: new Decimal(143.5), issuedQty: new Decimal(143.5) },
    ],
  });

  // Step 8: RM Store Issues RM to Factory
  const issueNumber = "ISSUE-2026-0089";
  const issue = await prisma.materialIssue.upsert({
    where: { organizationId_number: { organizationId: orgId, number: issueNumber } },
    update: {},
    create: {
      organizationId: orgId,
      number: issueNumber,
      productionOrderId: prodOrder.id,
      fromSiteId: siteMain.id,
      toSiteId: siteMain.id,
      status: DocumentStatus.CLOSED,
      issuedAt: new Date(Date.now() - 3 * 86400000),
    },
  });

  await prisma.materialIssueLine.deleteMany({ where: { issueId: issue.id } });
  await prisma.materialIssueLine.create({
    data: {
      issueId: issue.id,
      productId: productMap["RM-CORN-01"],
      lotId: rmLot.id,
      fromBinId: binMap["SILO-01"],
      quantity: new Decimal(11275.0),
      uomId: uomMap["kg"],
    },
  });

  await prisma.stockMovement.create({
    data: {
      organizationId: orgId,
      movementType: MovementType.ISSUE,
      productId: productMap["RM-CORN-01"],
      lotId: rmLot.id,
      fromBinId: binMap["SILO-01"],
      quantity: new Decimal(11275.0),
      uomId: uomMap["kg"],
      documentType: "MATERIAL_ISSUE",
      documentId: issue.number,
      occurredAt: new Date(Date.now() - 3 * 86400000),
      note: `Issued to Factory for ${prodOrder.number}. Deducted from SILO-01.`,
    },
  });

  // Step 9 & 10: Factory Execution, Batch Production & Actual Waste Verification
  const batchNumber = "BATCH-2026-0042";
  const fgLotCode = "LOT-FG-BROIL-2026-0042";

  const fgLot = await prisma.lot.upsert({
    where: { organizationId_code: { organizationId: orgId, code: fgLotCode } },
    update: {},
    create: {
      organizationId: orgId,
      productId: fgBroilerId,
      code: fgLotCode,
      manufactureDate: new Date(Date.now() - 2 * 86400000),
      expiryDate: new Date(Date.now() + 88 * 86400000),
      qualityStatus: QualityStatus.RELEASED,
    },
  });

  const batch = await prisma.productionBatch.upsert({
    where: { organizationId_number: { organizationId: orgId, number: batchNumber } },
    update: {},
    create: {
      organizationId: orgId,
      number: batchNumber,
      productionOrderId: prodOrder.id,
      actualRMConsumed: new Decimal(20500.0), // Total RM fed into mixer
      actualOutputQty: new Decimal(20000.0), // 20,000 kg produced = 400 bags of 50kg
      actualWasteQty: new Decimal(500.0), // 500kg loss
      actualWastePercent: new Decimal(2.44), // 500 / 20500 = 2.44%
      wasteVariancePercent: new Decimal(-0.06), // -0.06% variance compared to 2.5% planned allowance
      fgLotId: fgLot.id,
      status: DocumentStatus.CLOSED,
      startedAt: new Date(Date.now() - 3 * 86400000),
      completedAt: new Date(Date.now() - 2 * 86400000),
      notes: "Pelleting and cooling normal. Moisture 11.8%. Packaged 400 bags (50kg each).",
    },
  });

  // Step 11: Finished Goods Store Put-Away into BIN-FM-P1
  await prisma.inventoryBalance.upsert({
    where: {
      organizationId_productId_lotId_binId: {
        organizationId: orgId,
        productId: fgBroilerId,
        lotId: fgLot.id,
        binId: binMap["BIN-FM-P1"],
      },
    },
    update: { quantity: new Decimal(10000.0) }, // 20000 produced - 10000 dispatched = 10000 remaining (200 bags)
    create: {
      organizationId: orgId,
      productId: fgBroilerId,
      lotId: fgLot.id,
      binId: binMap["BIN-FM-P1"],
      uomId: uomMap["kg"],
      quantity: new Decimal(10000.0),
      reservedQty: new Decimal(0),
    },
  });

  await prisma.stockMovement.create({
    data: {
      organizationId: orgId,
      movementType: MovementType.PRODUCTION_OUTPUT,
      productId: fgBroilerId,
      lotId: fgLot.id,
      toBinId: binMap["BIN-FM-P1"],
      quantity: new Decimal(20000.0),
      uomId: uomMap["kg"],
      documentType: "PRODUCTION_BATCH",
      documentId: batch.number,
      occurredAt: new Date(Date.now() - 2 * 86400000),
      note: `Received 400 bags (20 Tons) of Broiler Starter into Pallet Bay P-01.`,
    },
  });

  // Step 12: Sales Order & Dispatch to Customer
  const soNumber = "SO-2026-0912";
  const salesOrder = await prisma.salesOrder.upsert({
    where: { organizationId_number: { organizationId: orgId, number: soNumber } },
    update: {},
    create: {
      organizationId: orgId,
      number: soNumber,
      customerId: partnerMap["CUST-001"],
      status: DocumentStatus.CLOSED,
      orderedAt: new Date(Date.now() - 2 * 86400000),
    },
  });

  await prisma.salesOrderLine.deleteMany({ where: { salesOrderId: salesOrder.id } });
  await prisma.salesOrderLine.create({
    data: {
      salesOrderId: salesOrder.id,
      productId: fgBroilerId,
      uomId: uomMap["bag_50kg"],
      quantity: new Decimal(200.0), // 200 bags = 10,000 kg
      dispatchedQty: new Decimal(200.0),
      unitPrice: new Decimal(3250.0), // BDT 3250 per 50kg bag
    },
  });

  const dispNumber = "DISP-2026-0301";
  const dispatch = await prisma.dispatch.upsert({
    where: { organizationId_number: { organizationId: orgId, number: dispNumber } },
    update: {},
    create: {
      organizationId: orgId,
      number: dispNumber,
      salesOrderId: salesOrder.id,
      vehicleNo: "DHK-METRO-UA-77-8899",
      status: DocumentStatus.CLOSED,
      dispatchedAt: new Date(Date.now() - 1 * 86400000),
    },
  });

  await prisma.dispatchLine.deleteMany({ where: { dispatchId: dispatch.id } });
  await prisma.dispatchLine.create({
    data: {
      dispatchId: dispatch.id,
      productId: fgBroilerId,
      lotId: fgLot.id,
      fromBinId: binMap["BIN-FM-P1"],
      quantity: new Decimal(10000.0),
      uomId: uomMap["kg"],
    },
  });

  await prisma.stockMovement.create({
    data: {
      organizationId: orgId,
      movementType: MovementType.DISPATCH,
      productId: fgBroilerId,
      lotId: fgLot.id,
      fromBinId: binMap["BIN-FM-P1"],
      quantity: new Decimal(10000.0),
      uomId: uomMap["kg"],
      documentType: "DISPATCH",
      documentId: dispatch.number,
      occurredAt: new Date(Date.now() - 1 * 86400000),
      note: `Dispatched 200 bags (10 Tons) to ${partners[4].name} on vehicle ${dispatch.vehicleNo}.`,
    },
  });

  console.log("Seeding completed successfully!");
  console.log(`Organization: ${apex.name} (${apex.code})`);
  console.log(`Sample Requisition: ${reqNumber}`);
  console.log(`Sample Supplier Challan: ${chalNumber}`);
  console.log(`Sample RM Lot: ${lotCornCode}`);
  console.log(`Sample FM Requisition: ${poNumber}`);
  console.log(`Sample Production Batch: ${batchNumber}`);
  console.log(`Sample Finished Good Lot: ${fgLotCode}`);
  console.log(`Sample Dispatch Challan: ${dispNumber}`);
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
