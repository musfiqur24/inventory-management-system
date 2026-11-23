BEGIN;
CREATE UNIQUE INDEX "Lot_tenant_product_key" ON "Lot" ("organizationId",id,"productId");
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "balance_lot_product_scope" FOREIGN KEY ("organizationId","lotId","productId") REFERENCES "Lot" ("organizationId",id,"productId") ON DELETE RESTRICT;
CREATE FUNCTION immutable_stock_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Stock movements are immutable; post a reversal or correction'; END $$;
CREATE TRIGGER immutable_stock_ledger BEFORE UPDATE OR DELETE ON "StockMovement" FOR EACH ROW EXECUTE FUNCTION immutable_stock_ledger();
CREATE FUNCTION protect_used_unit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.dimension IS NOT DISTINCT FROM OLD.dimension AND NEW."factorToBase"=OLD."factorToBase" AND NEW.code=OLD.code THEN RETURN NEW; END IF;
 IF EXISTS(SELECT 1 FROM "Product" WHERE "baseUomId"=OLD.id) OR EXISTS(SELECT 1 FROM "StockMovement" WHERE "uomId"=OLD.id)
 OR EXISTS(SELECT 1 FROM "RecipeLine" WHERE "uomId"=OLD.id) OR EXISTS(SELECT 1 FROM "Recipe" WHERE "outputUomId"=OLD.id)
 OR EXISTS(SELECT 1 FROM "PurchaseRequisitionLine" WHERE "uomId"=OLD.id) OR EXISTS(SELECT 1 FROM "SupplierDeliveryLine" WHERE "uomId"=OLD.id)
 OR EXISTS(SELECT 1 FROM "ProductionOrderLine" WHERE "uomId"=OLD.id) OR EXISTS(SELECT 1 FROM "SalesOrderLine" WHERE "uomId"=OLD.id)
 OR EXISTS(SELECT 1 FROM "InventoryBalance" WHERE "uomId"=OLD.id) THEN RAISE EXCEPTION 'Used unit semantics are immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER used_unit_semantics BEFORE UPDATE ON "UnitOfMeasure" FOR EACH ROW EXECUTE FUNCTION protect_used_unit();
CREATE FUNCTION protect_used_product() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.type=OLD.type AND NEW."baseUomId"=OLD."baseUomId" THEN RETURN NEW; END IF;
 IF EXISTS(SELECT 1 FROM "Lot" WHERE "productId"=OLD.id) OR EXISTS(SELECT 1 FROM "Recipe" WHERE "finishedProductId"=OLD.id)
 OR EXISTS(SELECT 1 FROM "RecipeLine" WHERE "rawProductId"=OLD.id) OR EXISTS(SELECT 1 FROM "SalesOrderLine" WHERE "productId"=OLD.id)
 OR EXISTS(SELECT 1 FROM "ProductionOrderLine" WHERE "productId"=OLD.id) OR EXISTS(SELECT 1 FROM "PurchaseRequisitionLine" WHERE "productId"=OLD.id)
 THEN RAISE EXCEPTION 'Used product stock semantics are immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER used_product_semantics BEFORE UPDATE ON "Product" FOR EACH ROW EXECUTE FUNCTION protect_used_product();
CREATE FUNCTION protect_recipe_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status='APPROVED' AND (NEW."finishedProductId"<>OLD."finishedProductId" OR NEW."outputQty"<>OLD."outputQty" OR NEW."outputUomId"<>OLD."outputUomId" OR NEW."wastePercent"<>OLD."wastePercent" OR NEW.version<>OLD.version) THEN RAISE EXCEPTION 'Approved recipe versions are immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER approved_recipe_version BEFORE UPDATE ON "Recipe" FOR EACH ROW EXECUTE FUNCTION protect_recipe_version();
CREATE FUNCTION protect_recipe_lines() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_id text; approved boolean; created_here boolean;
BEGIN
 IF TG_OP='DELETE' THEN parent_id:=OLD."recipeId"; ELSE parent_id:=NEW."recipeId"; END IF;
 SELECT status='APPROVED',xmin::text::bigint=txid_current() INTO approved,created_here FROM "Recipe" WHERE id=parent_id;
 IF approved AND NOT (TG_OP='INSERT' AND created_here) THEN RAISE EXCEPTION 'Approved recipe lines are immutable' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER approved_recipe_lines BEFORE INSERT OR UPDATE OR DELETE ON "RecipeLine" FOR EACH ROW EXECUTE FUNCTION protect_recipe_lines();
COMMIT;
