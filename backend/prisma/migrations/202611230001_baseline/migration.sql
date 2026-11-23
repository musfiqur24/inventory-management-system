-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "StoreType" AS ENUM ('RM_STORE', 'FM_STORE');

-- CreateEnum
CREATE TYPE "UomCategory" AS ENUM ('WEIGHT', 'VOLUME', 'COUNT', 'LENGTH', 'AREA', 'TIME');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('RAW_MATERIAL', 'FINISHED_GOOD', 'PACKAGING', 'BY_PRODUCT');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'PENDING', 'SUBMITTED', 'WEIGHED', 'AWAITING_DELIVERY', 'APPROVED', 'IN_PRODUCTION', 'READY', 'COMPLETED', 'REJECTED', 'PARTIALLY_RECEIVED', 'INCOMPLETE', 'RECEIVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QualityStatus" AS ENUM ('PENDING', 'RELEASED', 'HOLD', 'REJECTED');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('RECEIPT', 'ISSUE', 'TRANSFER', 'CONSUMPTION', 'PRODUCTION_OUTPUT', 'DISPATCH', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "phone" TEXT,
    "presentAddress" TEXT,
    "permanentAddress" TEXT,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitOfMeasure" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dimension" "UomCategory" NOT NULL,
    "factorToBase" DECIMAL(18,6) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UnitOfMeasure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupLayer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GroupLayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlLayer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ControlLayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubLayer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SubLayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubSubLayer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SubSubLayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Currency" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimalPlaces" INTEGER NOT NULL DEFAULT 2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "baseUomId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProductType" NOT NULL,
    "shelfLifeDays" INTEGER,
    "reorderLevel" DECIMAL(18,3),
    "amount" DECIMAL(18,2),
    "currencyId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "partnerType" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "email" TEXT,
    "contactPerson" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "siteId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storeType" "StoreType" NOT NULL,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bin" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "zone" TEXT,
    "capacity" DECIMAL(18,3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Bin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequisition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "salesOrderRef" TEXT,
    "supplierId" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "requestedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "assignedManagerId" TEXT,
    "approvedById" TEXT,

    CONSTRAINT "PurchaseRequisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequisitionLine" (
    "id" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "uomId" TEXT NOT NULL,
    "requestedQty" DECIMAL(18,3) NOT NULL,
    "receivedQty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(18,4),

    CONSTRAINT "PurchaseRequisitionLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierDelivery" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "requisitionId" TEXT,
    "supplierId" TEXT NOT NULL,
    "invoiceNo" TEXT,
    "vehicleNo" TEXT,
    "grossWeight" DECIMAL(18,3),
    "tareWeight" DECIMAL(18,3),
    "netWeight" DECIMAL(18,3),
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "deliveredAt" TIMESTAMP(3),
    "createdById" TEXT,
    "assignedManagerId" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "weighedAt" TIMESTAMP(3),
    "weighedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "attachmentName" TEXT,
    "attachmentMime" TEXT,
    "attachmentData" TEXT,

    CONSTRAINT "SupplierDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierDeliveryLine" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "uomId" TEXT NOT NULL,
    "declaredQty" DECIMAL(18,3) NOT NULL,
    "acceptedQty" DECIMAL(18,3),
    "verifiedQty" DECIMAL(18,3),
    "measuredQty" DECIMAL(18,3),
    "weighbridgeMatched" BOOLEAN,
    "weighedAt" TIMESTAMP(3),
    "weighedById" TEXT,
    "unitPrice" DECIMAL(18,4),
    "destinationBinId" TEXT,

    CONSTRAINT "SupplierDeliveryLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Weighment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "deliveryId" TEXT,
    "issueId" TEXT,
    "vehicleNo" TEXT,
    "grossWeight" DECIMAL(18,3) NOT NULL,
    "tareWeight" DECIMAL(18,3) NOT NULL,
    "netWeight" DECIMAL(18,3) NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operatorId" TEXT,

    CONSTRAINT "Weighment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "supplierDeliveryId" TEXT,
    "productionBatchId" TEXT,
    "manufactureDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "qualityStatus" "QualityStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Lot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryBalance" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "binId" TEXT NOT NULL,
    "uomId" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "reservedQty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "movementType" "MovementType" NOT NULL,
    "productId" TEXT NOT NULL,
    "lotId" TEXT,
    "fromBinId" TEXT,
    "toBinId" TEXT,
    "fromStoreId" TEXT,
    "toStoreId" TEXT,
    "sourceDocumentId" TEXT,
    "sourceLineId" TEXT,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "referenceNumber" TEXT,
    "postingKey" TEXT,
    "balanceAfter" DECIMAL(18,3),
    "quantity" DECIMAL(18,3) NOT NULL,
    "uomId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performedById" TEXT,
    "note" TEXT,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "finishedProductId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "outputQty" DECIMAL(18,3) NOT NULL,
    "outputUomId" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "wastePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "effectiveFrom" TIMESTAMP(3),

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeLine" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "rawProductId" TEXT NOT NULL,
    "uomId" TEXT NOT NULL,
    "quantityPerOutput" DECIMAL(18,3) NOT NULL,

    CONSTRAINT "RecipeLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionRequisition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'SUBMITTED',
    "requestedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "assignedManagerId" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "ProductionRequisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requisitionId" TEXT,
    "number" TEXT NOT NULL,
    "finishedProductId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "plannedQty" DECIMAL(18,3) NOT NULL,
    "plannedUomId" TEXT NOT NULL,
    "expectedWastePercent" DECIMAL(5,2) NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledFor" TIMESTAMP(3),

    CONSTRAINT "ProductionOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOrderLine" (
    "id" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "uomId" TEXT NOT NULL,
    "recipeQty" DECIMAL(18,3) NOT NULL,
    "wasteAdjustedQty" DECIMAL(18,3) NOT NULL,
    "issuedQty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(18,4),

    CONSTRAINT "ProductionOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialIssue" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "fromSiteId" TEXT,
    "toSiteId" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "issuedAt" TIMESTAMP(3),

    CONSTRAINT "MaterialIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialIssueLine" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "lotId" TEXT,
    "fromBinId" TEXT,
    "quantity" DECIMAL(18,3) NOT NULL,
    "uomId" TEXT NOT NULL,

    CONSTRAINT "MaterialIssueLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionBatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "actualRMConsumed" DECIMAL(18,3),
    "actualOutputQty" DECIMAL(18,3),
    "actualWasteQty" DECIMAL(18,3),
    "actualWastePercent" DECIMAL(5,2),
    "wasteVariancePercent" DECIMAL(5,2),
    "fgLotId" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "ProductionBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionBatchInput" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'RAW_MATERIAL',
    "quantity" DECIMAL(18,3) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "ProductionBatchInput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionBatchOutput" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "unitPrice" DECIMAL(18,4),
    "lotCode" TEXT,

    CONSTRAINT "ProductionBatchOutput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionBatchCost" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "ProductionBatchCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "assignedPersonId" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "orderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrderLine" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "uomId" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "dispatchedQty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(18,4),

    CONSTRAINT "SalesOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "vehicleNo" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "dispatchedAt" TIMESTAMP(3),

    CONSTRAINT "Dispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchLine" (
    "id" TEXT NOT NULL,
    "dispatchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "lotId" TEXT,
    "fromBinId" TEXT,
    "quantity" DECIMAL(18,3) NOT NULL,
    "uomId" TEXT NOT NULL,

    CONSTRAINT "DispatchLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermissionOverride" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,

    CONSTRAINT "UserPermissionOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "requisitionId" TEXT,
    "deliveryId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_code_key" ON "Organization"("code");

-- CreateIndex
CREATE INDEX "Site_organizationId_idx" ON "Site"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Site_organizationId_code_key" ON "Site"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "UnitOfMeasure_organizationId_idx" ON "UnitOfMeasure"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "UnitOfMeasure_organizationId_code_key" ON "UnitOfMeasure"("organizationId", "code");

-- CreateIndex
CREATE INDEX "GroupLayer_organizationId_idx" ON "GroupLayer"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupLayer_organizationId_id_key" ON "GroupLayer"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "GroupLayer_organizationId_code_key" ON "GroupLayer"("organizationId", "code");

-- CreateIndex
CREATE INDEX "ControlLayer_organizationId_parentId_idx" ON "ControlLayer"("organizationId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "ControlLayer_organizationId_id_key" ON "ControlLayer"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ControlLayer_organizationId_code_key" ON "ControlLayer"("organizationId", "code");

-- CreateIndex
CREATE INDEX "SubLayer_organizationId_parentId_idx" ON "SubLayer"("organizationId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "SubLayer_organizationId_id_key" ON "SubLayer"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SubLayer_organizationId_code_key" ON "SubLayer"("organizationId", "code");

-- CreateIndex
CREATE INDEX "SubSubLayer_organizationId_parentId_idx" ON "SubSubLayer"("organizationId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "SubSubLayer_organizationId_id_key" ON "SubSubLayer"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SubSubLayer_organizationId_code_key" ON "SubSubLayer"("organizationId", "code");

-- CreateIndex
CREATE INDEX "Currency_organizationId_idx" ON "Currency"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Currency_organizationId_code_key" ON "Currency"("organizationId", "code");

-- CreateIndex
CREATE INDEX "Product_organizationId_type_categoryId_idx" ON "Product"("organizationId", "type", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_organizationId_sku_key" ON "Product"("organizationId", "sku");

-- CreateIndex
CREATE INDEX "Partner_organizationId_partnerType_idx" ON "Partner"("organizationId", "partnerType");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_organizationId_code_key" ON "Partner"("organizationId", "code");

-- CreateIndex
CREATE INDEX "Store_organizationId_storeType_idx" ON "Store"("organizationId", "storeType");

-- CreateIndex
CREATE UNIQUE INDEX "Store_organizationId_id_key" ON "Store"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Store_organizationId_code_key" ON "Store"("organizationId", "code");

-- CreateIndex
CREATE INDEX "Bin_organizationId_storeId_idx" ON "Bin"("organizationId", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "Bin_organizationId_storeId_code_key" ON "Bin"("organizationId", "storeId", "code");

-- CreateIndex
CREATE INDEX "PurchaseRequisition_organizationId_status_requestedOn_idx" ON "PurchaseRequisition"("organizationId", "status", "requestedOn");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequisition_organizationId_number_key" ON "PurchaseRequisition"("organizationId", "number");

-- CreateIndex
CREATE INDEX "PurchaseRequisitionLine_requisitionId_productId_idx" ON "PurchaseRequisitionLine"("requisitionId", "productId");

-- CreateIndex
CREATE INDEX "SupplierDelivery_organizationId_requisitionId_status_idx" ON "SupplierDelivery"("organizationId", "requisitionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierDelivery_organizationId_number_key" ON "SupplierDelivery"("organizationId", "number");

-- CreateIndex
CREATE INDEX "SupplierDeliveryLine_deliveryId_productId_idx" ON "SupplierDeliveryLine"("deliveryId", "productId");

-- CreateIndex
CREATE INDEX "Weighment_organizationId_deliveryId_measuredAt_idx" ON "Weighment"("organizationId", "deliveryId", "measuredAt");

-- CreateIndex
CREATE INDEX "Lot_organizationId_productId_expiryDate_idx" ON "Lot"("organizationId", "productId", "expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "Lot_organizationId_code_key" ON "Lot"("organizationId", "code");

-- CreateIndex
CREATE INDEX "InventoryBalance_organizationId_binId_idx" ON "InventoryBalance"("organizationId", "binId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryBalance_organizationId_productId_lotId_binId_key" ON "InventoryBalance"("organizationId", "productId", "lotId", "binId");

-- CreateIndex
CREATE INDEX "StockMovement_organizationId_productId_occurredAt_idx" ON "StockMovement"("organizationId", "productId", "occurredAt");

-- CreateIndex
CREATE INDEX "StockMovement_organizationId_lotId_occurredAt_idx" ON "StockMovement"("organizationId", "lotId", "occurredAt");

-- CreateIndex
CREATE INDEX "StockMovement_organizationId_documentType_documentId_idx" ON "StockMovement"("organizationId", "documentType", "documentId");

-- CreateIndex
CREATE INDEX "StockMovement_organizationId_fromStoreId_occurredAt_idx" ON "StockMovement"("organizationId", "fromStoreId", "occurredAt");

-- CreateIndex
CREATE INDEX "StockMovement_organizationId_toStoreId_occurredAt_idx" ON "StockMovement"("organizationId", "toStoreId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_organizationId_postingKey_key" ON "StockMovement"("organizationId", "postingKey");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_organizationId_finishedProductId_version_key" ON "Recipe"("organizationId", "finishedProductId", "version");

-- CreateIndex
CREATE INDEX "RecipeLine_recipeId_rawProductId_idx" ON "RecipeLine"("recipeId", "rawProductId");

-- CreateIndex
CREATE INDEX "ProductionRequisition_organizationId_status_requestedOn_idx" ON "ProductionRequisition"("organizationId", "status", "requestedOn");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionRequisition_organizationId_number_key" ON "ProductionRequisition"("organizationId", "number");

-- CreateIndex
CREATE INDEX "ProductionOrder_organizationId_status_scheduledFor_idx" ON "ProductionOrder"("organizationId", "status", "scheduledFor");

-- CreateIndex
CREATE INDEX "ProductionOrder_requisitionId_idx" ON "ProductionOrder"("requisitionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOrder_organizationId_number_key" ON "ProductionOrder"("organizationId", "number");

-- CreateIndex
CREATE INDEX "ProductionOrderLine_productionOrderId_productId_idx" ON "ProductionOrderLine"("productionOrderId", "productId");

-- CreateIndex
CREATE INDEX "MaterialIssue_organizationId_productionOrderId_status_idx" ON "MaterialIssue"("organizationId", "productionOrderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialIssue_organizationId_number_key" ON "MaterialIssue"("organizationId", "number");

-- CreateIndex
CREATE INDEX "MaterialIssueLine_issueId_productId_idx" ON "MaterialIssueLine"("issueId", "productId");

-- CreateIndex
CREATE INDEX "ProductionBatch_organizationId_productionOrderId_status_idx" ON "ProductionBatch"("organizationId", "productionOrderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionBatch_organizationId_number_key" ON "ProductionBatch"("organizationId", "number");

-- CreateIndex
CREATE INDEX "ProductionBatchInput_batchId_category_idx" ON "ProductionBatchInput"("batchId", "category");

-- CreateIndex
CREATE INDEX "ProductionBatchOutput_batchId_productId_idx" ON "ProductionBatchOutput"("batchId", "productId");

-- CreateIndex
CREATE INDEX "ProductionBatchCost_batchId_idx" ON "ProductionBatchCost"("batchId");

-- CreateIndex
CREATE INDEX "SalesOrder_organizationId_status_orderedAt_idx" ON "SalesOrder"("organizationId", "status", "orderedAt");

-- CreateIndex
CREATE INDEX "SalesOrder_assignedPersonId_idx" ON "SalesOrder"("assignedPersonId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_organizationId_number_key" ON "SalesOrder"("organizationId", "number");

-- CreateIndex
CREATE INDEX "SalesOrderLine_salesOrderId_productId_idx" ON "SalesOrderLine"("salesOrderId", "productId");

-- CreateIndex
CREATE INDEX "Dispatch_organizationId_salesOrderId_status_idx" ON "Dispatch"("organizationId", "salesOrderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Dispatch_organizationId_number_key" ON "Dispatch"("organizationId", "number");

-- CreateIndex
CREATE INDEX "DispatchLine_dispatchId_productId_idx" ON "DispatchLine"("dispatchId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE INDEX "OrganizationMember_organizationId_roleId_idx" ON "OrganizationMember"("organizationId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_userId_organizationId_key" ON "OrganizationMember"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermissionOverride_membershipId_permissionId_key" ON "UserPermissionOverride"("membershipId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_expiresAt_idx" ON "RefreshToken"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_createdAt_idx" ON "PasswordResetToken"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE INDEX "Notification_organizationId_recipientId_createdAt_idx" ON "Notification"("organizationId", "recipientId", "createdAt");

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitOfMeasure" ADD CONSTRAINT "UnitOfMeasure_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupLayer" ADD CONSTRAINT "GroupLayer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlLayer" ADD CONSTRAINT "ControlLayer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlLayer" ADD CONSTRAINT "ControlLayer_organizationId_parentId_fkey" FOREIGN KEY ("organizationId", "parentId") REFERENCES "GroupLayer"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubLayer" ADD CONSTRAINT "SubLayer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubLayer" ADD CONSTRAINT "SubLayer_organizationId_parentId_fkey" FOREIGN KEY ("organizationId", "parentId") REFERENCES "ControlLayer"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubSubLayer" ADD CONSTRAINT "SubSubLayer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubSubLayer" ADD CONSTRAINT "SubSubLayer_organizationId_parentId_fkey" FOREIGN KEY ("organizationId", "parentId") REFERENCES "SubLayer"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Currency" ADD CONSTRAINT "Currency_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_organizationId_categoryId_fkey" FOREIGN KEY ("organizationId", "categoryId") REFERENCES "SubSubLayer"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_baseUomId_fkey" FOREIGN KEY ("baseUomId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bin" ADD CONSTRAINT "Bin_organizationId_storeId_fkey" FOREIGN KEY ("organizationId", "storeId") REFERENCES "Store"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisition" ADD CONSTRAINT "PurchaseRequisition_assignedManagerId_fkey" FOREIGN KEY ("assignedManagerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisitionLine" ADD CONSTRAINT "PurchaseRequisitionLine_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "PurchaseRequisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierDeliveryLine" ADD CONSTRAINT "SupplierDeliveryLine_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "SupplierDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_binId_fkey" FOREIGN KEY ("binId") REFERENCES "Bin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_fromStoreId_fkey" FOREIGN KEY ("fromStoreId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_toStoreId_fkey" FOREIGN KEY ("toStoreId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeLine" ADD CONSTRAINT "RecipeLine_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionRequisition" ADD CONSTRAINT "ProductionRequisition_assignedManagerId_fkey" FOREIGN KEY ("assignedManagerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionRequisition" ADD CONSTRAINT "ProductionRequisition_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "ProductionRequisition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrderLine" ADD CONSTRAINT "ProductionOrderLine_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIssueLine" ADD CONSTRAINT "MaterialIssueLine_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "MaterialIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBatchInput" ADD CONSTRAINT "ProductionBatchInput_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBatchOutput" ADD CONSTRAINT "ProductionBatchOutput_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBatchCost" ADD CONSTRAINT "ProductionBatchCost_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_assignedPersonId_fkey" FOREIGN KEY ("assignedPersonId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchLine" ADD CONSTRAINT "DispatchLine_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "Dispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "OrganizationMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
