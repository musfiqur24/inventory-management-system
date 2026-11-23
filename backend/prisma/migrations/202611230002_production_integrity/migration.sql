BEGIN;
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "DispatchLine" ADD COLUMN     "unitPrice" DECIMAL(18,4);

-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN     "consumedAt" TIMESTAMP(3),
ADD COLUMN     "familyId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "resourceId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentSequence" (
    "organizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("organizationId","kind")
);

-- CreateTable
CREATE TABLE "IdempotencyRequest" (
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyRequest_pkey" PRIMARY KEY ("organizationId","key")
);

-- CreateTable
CREATE TABLE "AuthThrottle" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthThrottle_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ReorderState" (
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "low" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReorderState_pkey" PRIMARY KEY ("organizationId","storeId","productId")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "balanceId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_createdAt_idx" ON "AuditEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuthThrottle_expiresAt_idx" ON "AuthThrottle"("expiresAt");

-- CreateIndex
CREATE INDEX "Reservation_organizationId_sourceType_sourceId_idx" ON "Reservation"("organizationId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "Reservation_balanceId_idx" ON "Reservation"("balanceId");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

CREATE UNIQUE INDEX IF NOT EXISTS "Product_tenant_id_key" ON "Product" ("organizationId",id);

CREATE UNIQUE INDEX IF NOT EXISTS "UnitOfMeasure_tenant_id_key" ON "UnitOfMeasure" ("organizationId",id);

CREATE UNIQUE INDEX IF NOT EXISTS "Partner_tenant_id_key" ON "Partner" ("organizationId",id);

CREATE UNIQUE INDEX IF NOT EXISTS "Recipe_tenant_id_key" ON "Recipe" ("organizationId",id);

CREATE UNIQUE INDEX IF NOT EXISTS "SupplierDelivery_tenant_id_key" ON "SupplierDelivery" ("organizationId",id);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductionOrder_tenant_id_key" ON "ProductionOrder" ("organizationId",id);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductionBatch_tenant_id_key" ON "ProductionBatch" ("organizationId",id);

CREATE UNIQUE INDEX IF NOT EXISTS "SalesOrder_tenant_id_key" ON "SalesOrder" ("organizationId",id);

CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseRequisition_tenant_id_key" ON "PurchaseRequisition" ("organizationId",id);

CREATE UNIQUE INDEX IF NOT EXISTS "Lot_tenant_id_key" ON "Lot" ("organizationId",id);

CREATE UNIQUE INDEX IF NOT EXISTS "Bin_tenant_id_key" ON "Bin" ("organizationId",id);

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryBalance_tenant_id_key" ON "InventoryBalance" ("organizationId",id);
ALTER TABLE "Product" ADD CONSTRAINT "Product_baseUomId_tenant_fk" FOREIGN KEY ("organizationId","baseUomId") REFERENCES "UnitOfMeasure" ("organizationId",id) ON DELETE RESTRICT;
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_finishedProductId_tenant_fk" FOREIGN KEY ("organizationId","finishedProductId") REFERENCES "Product" ("organizationId",id) ON DELETE RESTRICT;
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_outputUomId_tenant_fk" FOREIGN KEY ("organizationId","outputUomId") REFERENCES "UnitOfMeasure" ("organizationId",id) ON DELETE RESTRICT;
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_productId_tenant_fk" FOREIGN KEY ("organizationId","productId") REFERENCES "Product" ("organizationId",id) ON DELETE RESTRICT;
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_supplierDeliveryId_tenant_fk" FOREIGN KEY ("organizationId","supplierDeliveryId") REFERENCES "SupplierDelivery" ("organizationId",id) ON DELETE RESTRICT;
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_productionBatchId_tenant_fk" FOREIGN KEY ("organizationId","productionBatchId") REFERENCES "ProductionBatch" ("organizationId",id) ON DELETE RESTRICT;
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_recipeId_tenant_fk" FOREIGN KEY ("organizationId","recipeId") REFERENCES "Recipe" ("organizationId",id) ON DELETE RESTRICT;
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_finishedProductId_tenant_fk" FOREIGN KEY ("organizationId","finishedProductId") REFERENCES "Product" ("organizationId",id) ON DELETE RESTRICT;
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_plannedUomId_tenant_fk" FOREIGN KEY ("organizationId","plannedUomId") REFERENCES "UnitOfMeasure" ("organizationId",id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS "ProductionRequisition_tenant_id_key" ON "ProductionRequisition" ("organizationId",id);
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_requisitionId_tenant_fk" FOREIGN KEY ("organizationId","requisitionId") REFERENCES "ProductionRequisition" ("organizationId",id) ON DELETE RESTRICT;
ALTER TABLE "ProductionBatch" ADD CONSTRAINT "ProductionBatch_productionOrderId_tenant_fk" FOREIGN KEY ("organizationId","productionOrderId") REFERENCES "ProductionOrder" ("organizationId",id) ON DELETE RESTRICT;
ALTER TABLE "MaterialIssue" ADD CONSTRAINT "MaterialIssue_productionOrderId_tenant_fk" FOREIGN KEY ("organizationId","productionOrderId") REFERENCES "ProductionOrder" ("organizationId",id) ON DELETE RESTRICT;
ALTER TABLE "Dispatch" ADD CONSTRAINT "Dispatch_salesOrderId_tenant_fk" FOREIGN KEY ("organizationId","salesOrderId") REFERENCES "SalesOrder" ("organizationId",id) ON DELETE RESTRICT;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_customerId_tenant_fk" FOREIGN KEY ("organizationId","customerId") REFERENCES "Partner" ("organizationId",id) ON DELETE RESTRICT;
ALTER TABLE "SupplierDelivery" ADD CONSTRAINT "SupplierDelivery_supplierId_tenant_fk" FOREIGN KEY ("organizationId","supplierId") REFERENCES "Partner" ("organizationId",id) ON DELETE RESTRICT;
ALTER TABLE "SupplierDelivery" ADD CONSTRAINT "SupplierDelivery_requisitionId_tenant_fk" FOREIGN KEY ("organizationId","requisitionId") REFERENCES "PurchaseRequisition" ("organizationId",id) ON DELETE RESTRICT;
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_productId_tenant_fk" FOREIGN KEY ("organizationId","productId") REFERENCES "Product" ("organizationId",id) ON DELETE RESTRICT;
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_lotId_tenant_fk" FOREIGN KEY ("organizationId","lotId") REFERENCES "Lot" ("organizationId",id) ON DELETE RESTRICT;
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_binId_tenant_fk" FOREIGN KEY ("organizationId","binId") REFERENCES "Bin" ("organizationId",id) ON DELETE RESTRICT;
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_uomId_tenant_fk" FOREIGN KEY ("organizationId","uomId") REFERENCES "UnitOfMeasure" ("organizationId",id) ON DELETE RESTRICT;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_balanceId_tenant_fk" FOREIGN KEY ("organizationId","balanceId") REFERENCES "InventoryBalance" ("organizationId",id) ON DELETE RESTRICT;

ALTER TABLE "InventoryBalance" ADD CONSTRAINT "balance_nonnegative" CHECK (quantity>=0 AND "reservedQty">=0 AND "reservedQty"<=quantity);
ALTER TABLE "UnitOfMeasure" ADD CONSTRAINT "uom_positive_factor" CHECK ("factorToBase">0);
ALTER TABLE "StockMovement" ADD CONSTRAINT "movement_positive_quantity" CHECK (quantity>0);
ALTER TABLE "Reservation" ADD CONSTRAINT "reservation_nonnegative" CHECK (quantity>=0);
ALTER TABLE "Reservation" ADD CONSTRAINT "reservation_source_type" CHECK ("sourceType" IN ('SALES_ORDER','PRODUCTION_REQUISITION'));
CREATE INDEX "reservation_live" ON "Reservation" ("organizationId","sourceId","balanceId") WHERE quantity>0;
CREATE INDEX "balance_product_query" ON "InventoryBalance" ("organizationId","productId");
-- Defense in depth: line IDs must belong to the header's organization.
CREATE FUNCTION enforce_line_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE row_data jsonb:=to_jsonb(NEW); org text; product text; unit text; lot text; position text; linked_org text;
BEGIN
  EXECUTE format('SELECT "organizationId" FROM %I WHERE id=$1',TG_ARGV[0]) INTO org USING row_data->>TG_ARGV[1];
  IF org IS NULL THEN RAISE EXCEPTION 'Missing source document' USING ERRCODE='23503'; END IF;
  product:=row_data->>TG_ARGV[2]; unit:=row_data->>'uomId'; lot:=row_data->>'lotId'; position:=row_data->>'fromBinId';
  IF product IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "Product" WHERE id=product AND "organizationId"=org) THEN RAISE EXCEPTION 'Product organization mismatch' USING ERRCODE='23503'; END IF;
  IF unit IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "UnitOfMeasure" WHERE id=unit AND "organizationId"=org) THEN RAISE EXCEPTION 'Unit organization mismatch' USING ERRCODE='23503'; END IF;
  IF lot IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "Lot" WHERE id=lot AND "organizationId"=org AND "productId"=product) THEN RAISE EXCEPTION 'Lot organization/product mismatch' USING ERRCODE='23503'; END IF;
  IF position IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "Bin" WHERE id=position AND "organizationId"=org) THEN RAISE EXCEPTION 'Bin organization mismatch' USING ERRCODE='23503'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "PurchaseRequisitionLine_tenant_guard" BEFORE INSERT OR UPDATE ON "PurchaseRequisitionLine" FOR EACH ROW EXECUTE FUNCTION enforce_line_tenant('PurchaseRequisition','requisitionId','productId');
CREATE TRIGGER "SupplierDeliveryLine_tenant_guard" BEFORE INSERT OR UPDATE ON "SupplierDeliveryLine" FOR EACH ROW EXECUTE FUNCTION enforce_line_tenant('SupplierDelivery','deliveryId','productId');
CREATE TRIGGER "RecipeLine_tenant_guard" BEFORE INSERT OR UPDATE ON "RecipeLine" FOR EACH ROW EXECUTE FUNCTION enforce_line_tenant('Recipe','recipeId','rawProductId');
CREATE TRIGGER "ProductionOrderLine_tenant_guard" BEFORE INSERT OR UPDATE ON "ProductionOrderLine" FOR EACH ROW EXECUTE FUNCTION enforce_line_tenant('ProductionOrder','productionOrderId','productId');
CREATE TRIGGER "MaterialIssueLine_tenant_guard" BEFORE INSERT OR UPDATE ON "MaterialIssueLine" FOR EACH ROW EXECUTE FUNCTION enforce_line_tenant('MaterialIssue','issueId','productId');
CREATE TRIGGER "SalesOrderLine_tenant_guard" BEFORE INSERT OR UPDATE ON "SalesOrderLine" FOR EACH ROW EXECUTE FUNCTION enforce_line_tenant('SalesOrder','salesOrderId','productId');
CREATE TRIGGER "DispatchLine_tenant_guard" BEFORE INSERT OR UPDATE ON "DispatchLine" FOR EACH ROW EXECUTE FUNCTION enforce_line_tenant('Dispatch','dispatchId','productId');
CREATE TRIGGER "ProductionBatchInput_tenant_guard" BEFORE INSERT OR UPDATE ON "ProductionBatchInput" FOR EACH ROW EXECUTE FUNCTION enforce_line_tenant('ProductionBatch','batchId','productId');
CREATE TRIGGER "ProductionBatchOutput_tenant_guard" BEFORE INSERT OR UPDATE ON "ProductionBatchOutput" FOR EACH ROW EXECUTE FUNCTION enforce_line_tenant('ProductionBatch','batchId','productId');
-- Audit entries are append-only except for completion of their initial request outcome.
CREATE FUNCTION protect_audit_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Audit history cannot be deleted'; END IF;
 IF OLD.details->>'status' IS DISTINCT FROM 'attempted' OR NEW.id<>OLD.id OR NEW.action<>OLD.action OR NEW."actorId" IS DISTINCT FROM OLD."actorId" OR NEW."organizationId" IS DISTINCT FROM OLD."organizationId" THEN RAISE EXCEPTION 'Completed audit history is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION protect_audit_event();
COMMIT;
