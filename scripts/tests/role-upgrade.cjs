const fs=require('node:fs');
const path=require('node:path');
module.exports=async function verifyRoleUpgrade(pg,url){
 const server=new pg.Client({connectionString:url});await server.connect();await server.query('CREATE DATABASE role_upgrade');await server.end();
 const target=new URL(url);target.pathname='/role_upgrade';const db=new pg.Client({connectionString:target.toString()});await db.connect();
 const assert=require('node:assert/strict');
 try{
 const dir=path.resolve(__dirname,'../../backend/prisma/migrations');
 for(const migration of fs.readdirSync(dir).filter(n=>n<'202611270002'&&fs.statSync(path.join(dir,n)).isDirectory()).sort())await db.query(fs.readFileSync(path.join(dir,migration,'migration.sql'),'utf8'));
 await db.query(`INSERT INTO "Organization" (id,code,name,"updatedAt") VALUES ('org','UPGRADE','Upgrade',now());
 INSERT INTO "Role" (id,code,name,"isSystem") VALUES ('role','STAFF','Staff',true);
 INSERT INTO "Permission" (id,key,name) VALUES ('read','departments.read','Read'),('write','departments.write','Write'),('roles','roles.manage','Roles');
 INSERT INTO "RolePermission" ("roleId","permissionId") VALUES ('role','read');
 INSERT INTO "User" (id,email,"fullName","passwordHash","updatedAt") VALUES ('reader','reader@test.local','Reader','hash',now()),('agro','agro@test.local','Agro','hash',now());
 INSERT INTO "OrganizationMember" (id,"userId","organizationId","roleId") VALUES ('reader','reader','org','role'),('agro','agro','org','role');
 UPDATE "MembershipModuleAccess" SET "canWrite"=false WHERE "membershipId"='reader';
 DELETE FROM "MembershipModuleAccess" WHERE "membershipId"='agro';
 INSERT INTO "MembershipModuleAccess" ("membershipId","moduleCode","canRead","canWrite") VALUES ('agro','agro',true,false);`);
 await db.query(fs.readFileSync(path.join(dir,'202611270002_role_area_permissions/migration.sql'),'utf8'));
 const keys=async member=>(await db.query('SELECT p.key FROM "OrganizationMember" m JOIN "RolePermission" rp ON rp."roleId"=m."roleId" JOIN "Permission" p ON p.id=rp."permissionId" WHERE m.id=$1',[member])).rows.map(r=>r.key);
 const reader=await keys('reader');assert.ok(reader.includes('feed.rm_store.read'));assert.ok(!reader.some(k=>k.endsWith('.write')));
 const agro=await keys('agro');assert.ok(agro.includes('agro.reports.read'));assert.ok(!agro.some(k=>k.startsWith('feed.')));assert.ok(!agro.includes('agro.reports.write'));
 console.log('PASS: role migration preserves Feed read-only and Agro-only memberships');
 }finally{await db.end()}
};
