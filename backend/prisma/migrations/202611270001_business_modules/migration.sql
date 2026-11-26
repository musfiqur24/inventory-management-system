CREATE TABLE "BusinessModule" (
 "code" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT true, "sortOrder" INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE "MembershipModuleAccess" (
 "membershipId" TEXT NOT NULL REFERENCES "OrganizationMember"("id") ON DELETE CASCADE,
 "moduleCode" TEXT NOT NULL REFERENCES "BusinessModule"("code") ON DELETE RESTRICT,
 "canRead" BOOLEAN NOT NULL DEFAULT true, "canWrite" BOOLEAN NOT NULL DEFAULT false,
 PRIMARY KEY ("membershipId","moduleCode"),
 CONSTRAINT "module_write_requires_read" CHECK (NOT "canWrite" OR "canRead")
);
CREATE INDEX "MembershipModuleAccess_moduleCode_idx" ON "MembershipModuleAccess"("moduleCode");
CREATE TABLE "ModuleReport" (
 "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
 "moduleCode" TEXT NOT NULL REFERENCES "BusinessModule"("code") ON DELETE RESTRICT,
 "title" TEXT NOT NULL, "reportingDate" TIMESTAMP(3) NOT NULL, "metrics" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ModuleReport_organizationId_moduleCode_reportingDate_idx" ON "ModuleReport"("organizationId","moduleCode","reportingDate");
INSERT INTO "BusinessModule" ("code","name","sortOrder") VALUES ('feed','Feed',0),('agro','Agro',1);
INSERT INTO "MembershipModuleAccess" ("membershipId","moduleCode","canRead","canWrite") SELECT id,'feed',true,true FROM "OrganizationMember";
CREATE FUNCTION grant_default_feed_access() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO "MembershipModuleAccess" ("membershipId","moduleCode","canRead","canWrite") VALUES (NEW.id,'feed',true,true);
 RETURN NEW;
END; $$;
CREATE TRIGGER membership_default_feed_access AFTER INSERT ON "OrganizationMember" FOR EACH ROW EXECUTE FUNCTION grant_default_feed_access();
