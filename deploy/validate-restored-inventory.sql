-- Read-only validation after restoring into isolation. Any inconsistency fails.
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM "InventoryBalance" WHERE quantity<0 OR "reservedQty"<0 OR "reservedQty">quantity) THEN
  RAISE EXCEPTION 'Invalid inventory balances';
 END IF;
 IF EXISTS (
  WITH entries AS (
   SELECT m."organizationId",m."productId",m."lotId",m."toBinId" AS "binId",m.quantity*u."factorToBase" AS qty
   FROM "StockMovement" m JOIN "UnitOfMeasure" u ON u.id=m."uomId" WHERE m."toBinId" IS NOT NULL
   UNION ALL
   SELECT m."organizationId",m."productId",m."lotId",m."fromBinId",-m.quantity*u."factorToBase"
   FROM "StockMovement" m JOIN "UnitOfMeasure" u ON u.id=m."uomId" WHERE m."fromBinId" IS NOT NULL
  ), ledger AS (
   SELECT "organizationId","productId","lotId","binId",sum(qty) AS qty FROM entries GROUP BY 1,2,3,4
  ), balances AS (
   SELECT b."organizationId",b."productId",b."lotId",b."binId",b.quantity*u."factorToBase" AS qty
   FROM "InventoryBalance" b JOIN "UnitOfMeasure" u ON u.id=b."uomId"
  ) SELECT 1 FROM ledger l FULL JOIN balances b USING("organizationId","productId","lotId","binId")
  WHERE abs(coalesce(l.qty,0)-coalesce(b.qty,0))>0.0005
 ) THEN RAISE EXCEPTION 'Stock ledger does not reconcile with balances'; END IF;
 IF EXISTS (
  SELECT 1 FROM "InventoryBalance" b LEFT JOIN "Reservation" r ON r."balanceId"=b.id
  GROUP BY b.id,b."reservedQty" HAVING abs(b."reservedQty"-coalesce(sum(r.quantity),0))>0.0005
 ) THEN RAISE EXCEPTION 'Reservations do not reconcile with reserved balances'; END IF;
END $$;
SELECT count(*) AS users FROM "User";
SELECT count(*) AS movements FROM "StockMovement";
