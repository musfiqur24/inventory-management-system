import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feedPermissionFor,hasPermission } from '../../src/modules/rbac.js';
import { AREA_PERMISSIONS } from '../../src/modules/permissionCatalog.js';
test('every Feed endpoint maps to a catalog read/write pair',()=>{
 for(const endpoint of ['purchase-requisitions','deliveries','weighments','rm-store','fm-store','recipes','production-orders','material-issues','batches','sales-orders','dispatches','uoms','currencies','categories','products','partners','stores','bins','operations','inventory','traceability','reservations','notifications']){
  for(const method of ['GET','HEAD','OPTIONS','POST','PUT','PATCH','DELETE'])assert.ok(AREA_PERMISSIONS.some(p=>p.key===feedPermissionFor('/'+endpoint+'/example',method)),endpoint+' '+method);
 }
 assert.equal(feedPermissionFor('/unknown','GET'),null);
 assert.equal(feedPermissionFor('/deliveries','POST'),'feed.procurement.write');
 assert.equal(feedPermissionFor('/rm-store','GET'),'feed.rm_store.read');
});
test('permissions are scoped to selected organization and deny missing users',()=>{
 const user={isSuperAdmin:false,organizations:[{id:'one',permissions:['feed.rm_store.read']},{id:'two',permissions:['agro.reports.read'] }]} as any;
 assert.equal(hasPermission(user,'one','feed.rm_store.read'),true);
 assert.equal(hasPermission(user,'two','feed.rm_store.read'),false);
 assert.equal(hasPermission(user,'one','feed.rm_store.write'),false);
 assert.equal(hasPermission(undefined,'one','feed.rm_store.read'),false);
});
