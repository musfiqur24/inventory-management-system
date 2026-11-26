ALTER TABLE "Permission" ADD COLUMN "moduleCode" TEXT REFERENCES "BusinessModule"(code) ON DELETE RESTRICT, ADD COLUMN resource TEXT, ADD COLUMN action TEXT;
ALTER TABLE "Role" ADD COLUMN "organizationId" TEXT REFERENCES "Organization"(id) ON DELETE CASCADE;
DROP TRIGGER membership_default_feed_access ON "OrganizationMember";
DROP FUNCTION grant_default_feed_access();
INSERT INTO "Permission" (id,key,name,"moduleCode",resource,action) VALUES (gen_random_uuid()::text,'feed.procurement.read','RM Procurement','feed','procurement','read');
INSERT INTO "Permission" (id,key,name,"moduleCode",resource,action) VALUES (gen_random_uuid()::text,'feed.procurement.write','RM Procurement','feed','procurement','write');
INSERT INTO "Permission" (id,key,name,"moduleCode",resource,action) VALUES (gen_random_uuid()::text,'feed.rm_store.read','RM Store','feed','rm_store','read');
INSERT INTO "Permission" (id,key,name,"moduleCode",resource,action) VALUES (gen_random_uuid()::text,'feed.rm_store.write','RM Store','feed','rm_store','write');
INSERT INTO "Permission" (id,key,name,"moduleCode",resource,action) VALUES (gen_random_uuid()::text,'feed.fm_store.read','FM Store','feed','fm_store','read');
INSERT INTO "Permission" (id,key,name,"moduleCode",resource,action) VALUES (gen_random_uuid()::text,'feed.fm_store.write','FM Store','feed','fm_store','write');
INSERT INTO "Permission" (id,key,name,"moduleCode",resource,action) VALUES (gen_random_uuid()::text,'feed.production.read','Production','feed','production','read');
INSERT INTO "Permission" (id,key,name,"moduleCode",resource,action) VALUES (gen_random_uuid()::text,'feed.production.write','Production','feed','production','write');
INSERT INTO "Permission" (id,key,name,"moduleCode",resource,action) VALUES (gen_random_uuid()::text,'feed.recipes.read','Recipes','feed','recipes','read');
INSERT INTO "Permission" (id,key,name,"moduleCode",resource,action) VALUES (gen_random_uuid()::text,'feed.recipes.write','Recipes','feed','recipes','write');
INSERT INTO "Permission" (id,key,name,"moduleCode",resource,action) VALUES (gen_random_uuid()::text,'feed.sales.read','Sales','feed','sales','read');
INSERT INTO "Permission" (id,key,name,"moduleCode",resource,action) VALUES (gen_random_uuid()::text,'feed.sales.write','Sales','feed','sales','write');
INSERT INTO "Permission" (id,key,name,"moduleCode",resource,action) VALUES (gen_random_uuid()::text,'feed.sales_approval.read','Sales Approval','feed','sales_approval','read');
INSERT INTO "Permission" (id,key,name,"moduleCode",resource,action) VALUES (gen_random_uuid()::text,'feed.sales_approval.write','Sales Approval','feed','sales_approval','write');
INSERT INTO "Permission" (id,key,name,"moduleCode",resource,action) VALUES (gen_random_uuid()::text,'feed.setup.read','Master Setup','feed','setup','read');
INSERT INTO "Permission" (id,key,name,"moduleCode",resource,action) VALUES (gen_random_uuid()::text,'feed.setup.write','Master Setup','feed','setup','write');
INSERT INTO "Permission" (id,key,name,"moduleCode",resource,action) VALUES (gen_random_uuid()::text,'feed.partners.read','Suppliers & Customers','feed','partners','read');
INSERT INTO "Permission" (id,key,name,"moduleCode",resource,action) VALUES (gen_random_uuid()::text,'feed.partners.write','Suppliers & Customers','feed','partners','write');
INSERT INTO "Permission" (id,key,name,"moduleCode",resource,action) VALUES (gen_random_uuid()::text,'feed.weighbridge.read','Weighbridge','feed','weighbridge','read');
INSERT INTO "Permission" (id,key,name,"moduleCode",resource,action) VALUES (gen_random_uuid()::text,'feed.weighbridge.write','Weighbridge','feed','weighbridge','write');
INSERT INTO "Permission" (id,key,name,"moduleCode",resource,action) VALUES (gen_random_uuid()::text,'feed.reports.read','Reports','feed','reports','read');
INSERT INTO "Permission" (id,key,name,"moduleCode",resource,action) VALUES (gen_random_uuid()::text,'feed.reports.write','Reports','feed','reports','write');
INSERT INTO "Permission" (id,key,name,"moduleCode",resource,action) VALUES (gen_random_uuid()::text,'agro.reports.read','Reports','agro','reports','read');
INSERT INTO "Permission" (id,key,name,"moduleCode",resource,action) VALUES (gen_random_uuid()::text,'agro.reports.write','Reports','agro','reports','write');
INSERT INTO "RolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "Role" r CROSS JOIN "Permission" p
WHERE p."moduleCode"='feed' AND (
 r.code='SUPER_ADMIN' OR
 (p.action='read' AND EXISTS (SELECT 1 FROM "RolePermission" rp JOIN "Permission" old ON old.id=rp."permissionId" WHERE rp."roleId"=r.id AND old.key='departments.read')) OR
 (p.action='write' AND (
  (p.resource IN ('procurement','weighbridge') AND r.code='STAFF') OR
  (p.resource IN ('recipes','partners') AND r.code='MANAGER') OR
  (p.resource='sales_approval' AND r.code IN ('ADMIN','MANAGER')) OR
  (p.resource NOT IN ('recipes','partners','sales_approval') AND EXISTS (SELECT 1 FROM "RolePermission" rp JOIN "Permission" old ON old.id=rp."permissionId" WHERE rp."roleId"=r.id AND old.key='departments.write'))
 ))) ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId","permissionId") SELECT r.id,p.id FROM "Role" r CROSS JOIN "Permission" p WHERE r.code='SUPER_ADMIN' AND p."moduleCode"='agro' ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId","permissionId") SELECT r.id,p.id FROM "Role" r JOIN "Permission" p ON p.key='roles.manage' WHERE r.code='ADMIN' ON CONFLICT DO NOTHING;
-- Preserve exceptional membership grants in organization-owned roles. Legacy rows remain for audit only.
DO $$ DECLARE m RECORD; new_role TEXT; BEGIN
 FOR m IN SELECT om.*,r.code,r.name FROM "OrganizationMember" om JOIN "Role" r ON r.id=om."roleId" WHERE r.code<>'SUPER_ADMIN' AND (
 EXISTS(SELECT 1 FROM "MembershipModuleAccess" a WHERE a."membershipId"=om.id AND (a."moduleCode"<>'feed' OR NOT a."canRead" OR NOT a."canWrite")) OR
 NOT EXISTS(SELECT 1 FROM "MembershipModuleAccess" a WHERE a."membershipId"=om.id AND a."moduleCode"='feed' AND a."canRead") OR
 EXISTS(SELECT 1 FROM "UserPermissionOverride" o WHERE o."membershipId"=om.id))
 LOOP
 new_role:=gen_random_uuid()::text;
 INSERT INTO "Role" (id,code,name,"isSystem","organizationId") VALUES(new_role,'MIGRATED_'||replace(new_role,'-',''),m.name||' (preserved access)',false,m."organizationId");
 INSERT INTO "RolePermission" ("roleId","permissionId") SELECT new_role,p.id FROM "Permission" p WHERE
 (p."moduleCode" IS NULL AND EXISTS(SELECT 1 FROM "RolePermission" rp WHERE rp."roleId"=m."roleId" AND rp."permissionId"=p.id)) OR
 (p."moduleCode" IS NOT NULL AND EXISTS(SELECT 1 FROM "MembershipModuleAccess" a WHERE a."membershipId"=m.id AND a."moduleCode"=p."moduleCode" AND a."canRead" AND (p.action='read' OR a."canWrite")) AND
 (p."moduleCode"<>'feed' OR EXISTS(SELECT 1 FROM "RolePermission" rp WHERE rp."roleId"=m."roleId" AND rp."permissionId"=p.id)));
 -- Fold legacy user overrides into the preserved role; runtime access is role-only.
 DELETE FROM "RolePermission" rp USING "UserPermissionOverride" o WHERE rp."roleId"=new_role AND o."membershipId"=m.id AND o."permissionId"=rp."permissionId" AND NOT o.granted;
 INSERT INTO "RolePermission" ("roleId","permissionId") SELECT new_role,o."permissionId" FROM "UserPermissionOverride" o WHERE o."membershipId"=m.id AND o.granted ON CONFLICT DO NOTHING;
 IF EXISTS(SELECT 1 FROM "UserPermissionOverride" o JOIN "Permission" p ON p.id=o."permissionId" WHERE o."membershipId"=m.id AND p.key='departments.write' AND NOT o.granted) THEN
  DELETE FROM "RolePermission" rp USING "Permission" p WHERE rp."roleId"=new_role AND p.id=rp."permissionId" AND p."moduleCode"='feed' AND p.action='write' AND NOT(m.code='STAFF' AND p.resource IN ('procurement','weighbridge'));
 END IF;
 IF EXISTS(SELECT 1 FROM "UserPermissionOverride" o JOIN "Permission" p ON p.id=o."permissionId" WHERE o."membershipId"=m.id AND p.key='departments.read' AND NOT o.granted) THEN
  DELETE FROM "RolePermission" rp USING "Permission" p WHERE rp."roleId"=new_role AND p.id=rp."permissionId" AND p."moduleCode"='feed';
 END IF;
 UPDATE "OrganizationMember" SET "roleId"=new_role WHERE id=m.id;
 END LOOP;
END $$;
