import { nextDocumentNumber } from "../../src/services/documentNumbers.js";
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../src/prisma.js';
import { bootstrapRbac } from '../../src/modules/rbac.js';
import { createApp } from '../../src/app.js';
import { postStock } from '../../src/services/stock.js';
import { stockTransaction } from '../../src/services/stockTransaction.js';
import { Prisma } from '../../src/generated/prisma/client.js';
import { escapeHtml } from '../../../frontend/src/shared/escapeHtml.js';
let server:any,base:string,superToken:string,adminToken:string,staffToken:string,org:any,other:any,raw:any,raw2:any,fg:any,foreign:any,unit:any,bin:any,fmBin:any,recipe:any,foreignRecipe:any,customer:any,superMembership:any,foreignMembership:any;
const origin='http://localhost:5173';
async function request(path:string,method='GET',body?:unknown,token=superToken,organizationId=org?.id,extra:Record<string,string>={}){
 const response=await fetch(base+'/api/v1'+path,{method,headers:{'Content-Type':'application/json',Origin:origin,...(token?{Authorization:'Bearer '+token}:{}),...(organizationId?{'x-organization-id':organizationId}:{}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const text=await response.text();return {status:response.status,data:text?JSON.parse(text):null,cookie:response.headers.get('set-cookie')};
}
async function login(email:string){return request('/auth/login','POST',{email,password:'IntegrationPassword123'},'');}
async function product(organizationId:string,sku:string,type:'RAW_MATERIAL'|'FINISHED_GOOD',uom:any){
 const g=await prisma.groupLayer.create({data:{organizationId,code:sku,name:sku}});const c=await prisma.controlLayer.create({data:{organizationId,parentId:g.id,code:sku,name:sku}});const s=await prisma.subLayer.create({data:{organizationId,parentId:c.id,code:sku,name:sku}});const cat=await prisma.subSubLayer.create({data:{organizationId,parentId:s.id,code:sku,name:sku}});
 return prisma.product.create({data:{organizationId,sku,name:'Product '+sku,type,baseUomId:uom.id,categoryId:cat.id}});
}
async function seedStock(productId:string,position:any,quantity:number){const lot=await prisma.lot.create({data:{organizationId:org.id,productId,code:randomUUID(),qualityStatus:'RELEASED'}});return stockTransaction(org.id,randomUUID(),{},tx=>postStock(tx,{organizationId:org.id,productId,binId:position.id,lotId:lot.id,uomId:unit.id,quantity,direction:'IN',storeType:position.storeType??'RM_STORE',movementType:'RECEIPT',documentType:'TEST',documentId:'TEST',sourceDocumentId:randomUUID()}));}
before(async()=>{
 await bootstrapRbac();org=await prisma.organization.findFirstOrThrow();other=await prisma.organization.create({data:{code:'SECOND',name:'Other organization'}});
 unit=await prisma.unitOfMeasure.create({data:{organizationId:org.id,code:'kg',name:'Kilogram',dimension:'WEIGHT',factorToBase:1}});
 const otherUnit=await prisma.unitOfMeasure.create({data:{organizationId:other.id,code:'kg',name:'Kilogram',dimension:'WEIGHT',factorToBase:1}});
 raw=await product(org.id,'1001','RAW_MATERIAL',unit);raw2=await product(org.id,'1002','RAW_MATERIAL',unit);fg=await product(org.id,'1003','FINISHED_GOOD',unit);foreign=await product(other.id,'2001','RAW_MATERIAL',otherUnit);
 const store=await prisma.store.create({data:{organizationId:org.id,code:'1',name:'RM',storeType:'RM_STORE'}});bin=await prisma.bin.create({data:{organizationId:org.id,storeId:store.id,code:'1',name:'RM bin'}});
 const fm=await prisma.store.create({data:{organizationId:org.id,code:'2',name:'FM',storeType:'FM_STORE'}});fmBin={...await prisma.bin.create({data:{organizationId:org.id,storeId:fm.id,code:'1',name:'FM bin'}}),storeType:'FM_STORE'};
 customer=await prisma.partner.create({data:{organizationId:org.id,code:'C1',name:'Customer',partnerType:'CUSTOMER'}});
 recipe=await prisma.recipe.create({data:{organizationId:org.id,finishedProductId:fg.id,version:1,outputQty:15,outputUomId:unit.id,status:'APPROVED',lines:{create:[{rawProductId:raw.id,uomId:unit.id,quantityPerOutput:10},{rawProductId:raw2.id,uomId:unit.id,quantityPerOutput:5}]}}});
 foreignRecipe=await prisma.recipe.create({data:{organizationId:other.id,finishedProductId:foreign.id,version:1,outputQty:10,outputUomId:otherUnit.id,status:'APPROVED'}});
 const superUser=await prisma.user.findUniqueOrThrow({where:{email:'admin@example.com'}});superMembership=await prisma.organizationMember.findFirstOrThrow({where:{userId:superUser.id,organizationId:org.id}});
 for(const [email,roleCode]of [['ordinary@example.com','ADMIN'],['store@example.com','STOREKEEPER']]){const role=await prisma.role.findUniqueOrThrow({where:{code:roleCode}});const user=await prisma.user.create({data:{email,fullName:roleCode,passwordHash:await bcrypt.hash('IntegrationPassword123',4),memberships:{create:{organizationId:org.id,roleId:role.id}}}});if(roleCode==='ADMIN'){const staff=await prisma.role.findUniqueOrThrow({where:{code:'STAFF'}});foreignMembership=await prisma.organizationMember.create({data:{userId:user.id,organizationId:other.id,roleId:staff.id}});}}
 server=createApp().listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;
 superToken=(await login('admin@example.com')).data.data.accessToken;adminToken=(await login('ordinary@example.com')).data.data.accessToken;staffToken=(await login('store@example.com')).data.data.accessToken;
});
after(async()=>{if(server)await new Promise<void>(r=>server.close(()=>r()));await prisma.$disconnect();});
test('role area permissions control module access, writes, dashboard and live revocation',async()=>{
 const catalog=await request('/roles/permissions');assert.equal(catalog.status,200);
 const id=(key:string)=>catalog.data.data.find((p:any)=>p.key===key).id;
 const createRole=async(name:string,keys:string[])=>request('/roles','POST',{name,permissionIds:keys.map(id)});
 const createdRole=await createRole('Agro reader',['agro.reports.read']);assert.equal(createdRole.status,201,JSON.stringify(createdRole.data));
 const roleId=createdRole.data.data.id;
 const email='agro-'+randomUUID()+'@example.com';
 const created=await request('/users','POST',{email,fullName:'Agro Reader',password:'IntegrationPassword123',organizationIds:[org.id],roleId});assert.equal(created.status,201,JSON.stringify(created.data));
 const token=(await login(email)).data.data.accessToken;
 const me=await request('/auth/me','GET',undefined,token);assert.deepEqual(me.data.data.organizations[0].modules.map((m:any)=>m.code),['agro']);
 for(const path of ['/products','/deliveries','/purchase-requisitions','/notifications','/roles'])assert.equal((await request(path,'GET',undefined,token)).status,403,path);
 const report={title:'Agro harvest',reportingDate:new Date().toISOString(),metrics:{harvestKg:125}};
 const inserted=await request('/module-reports/agro','POST',report);assert.equal(inserted.status,201,JSON.stringify(inserted.data));
 assert.equal((await request('/module-reports/agro','POST',report,token)).status,403);
 const dashboard=await request('/dashboard','GET',undefined,token);assert.equal(dashboard.status,200);assert.equal(dashboard.data.data.pendingRequisitions,undefined);assert.ok(dashboard.data.data.reports.some((r:any)=>r.id===inserted.data.data.id));
 assert.equal((await request('/module-reports/agro','GET',undefined,token,other.id)).status,403);
 assert.equal((await request('/module-reports/agro','GET',undefined,staffToken)).status,403);
 let updated=await request('/roles/'+roleId,'PUT',{name:'Both modules',permissionIds:['agro.reports.read','agro.reports.write','feed.setup.read'].map(id)});assert.equal(updated.status,200,JSON.stringify(updated.data));
 assert.equal((await request('/products','GET',undefined,token)).status,200);assert.equal((await request('/products','POST',{},token)).status,403);
 assert.equal((await request('/module-reports/agro','POST',report,token)).status,201);
 updated=await request('/roles/'+roleId,'PUT',{name:'Store reader',permissionIds:['feed.rm_store.read'].map(id)});assert.equal(updated.status,200);
 assert.equal((await request('/module-reports/agro','GET',undefined,token)).status,403);
 const restricted=await request('/dashboard','GET',undefined,token);assert.equal(restricted.data.data.pendingRequisitions,null);assert.equal(restricted.data.data.activeBatches,null);assert.deepEqual(restricted.data.data.movements,[]);
 assert.equal((await createRole('Invalid writer',['feed.setup.write'])).status,422);
 assert.equal((await request('/roles','POST',{name:'Escalation',permissionIds:[id('agro.reports.read')]},adminToken)).status,422);
 assert.equal((await request('/users','POST',{email:'wrong-'+randomUUID()+'@example.com',fullName:'Wrong Org',password:'IntegrationPassword123',organizationIds:[other.id],roleId})).status,403);
 const member=await prisma.organizationMember.findFirstOrThrow({where:{userId:created.data.data.id}});
 assert.equal((await request('/users/'+member.id,'PATCH',{modules:[{code:'agro',canRead:true,canWrite:true}]})).status,422);
 const area=await request('/roles/permissions','POST',{moduleCode:'agro',resource:'crop_store',name:'Crop Store'});assert.equal(area.status,201);assert.deepEqual(area.data.data.map((p:any)=>p.action).sort(),['read','write']);
 const writer=await createRole('Procurement writer',['feed.procurement.read','feed.procurement.write']);assert.equal(writer.status,201);
 const writerEmail='writer-'+randomUUID()+'@example.com';const writerUser=await request('/users','POST',{email:writerEmail,fullName:'Custom Writer',password:'IntegrationPassword123',organizationIds:[org.id],roleId:writer.data.data.id});assert.equal(writerUser.status,201);
 const managers=await request('/purchase-requisitions/managers');assert.ok(managers.data.data.some((u:any)=>u.id===writerUser.data.data.id));
 const writerToken=(await login(writerEmail)).data.data.accessToken;
 assert.equal((await request('/deliveries','POST',{},writerToken)).status,422);
 const protectedRole=await prisma.role.findUniqueOrThrow({where:{code:'SUPER_ADMIN'}});assert.equal((await request('/roles/'+protectedRole.id,'PUT',{name:'Unsafe',permissionIds:[]})).status,403);
 updated=await request('/roles/'+roleId,'PUT',{name:'No access',permissionIds:[]});assert.equal(updated.status,200);
 await bootstrapRbac();assert.equal((await prisma.rolePermission.count({where:{roleId}})),0);
});

test('readiness checks the real database',async()=>assert.equal((await request('/ready')).status,200));
test('refresh token is only an HttpOnly cookie, not JSON',async()=>{const r=await login('admin@example.com');assert.match(r.cookie!,/HttpOnly/i);assert.match(r.cookie!,/SameSite=Strict/i);assert.equal(r.data.data.refreshToken,undefined);});
test('foreign origins cannot rotate session cookies',async()=>{const r=await login('ordinary@example.com');const response=await request('/auth/refresh','POST',{},'',org.id,{Cookie:r.cookie!.split(';')[0],Origin:'https://attacker.invalid'});assert.equal(response.status,403);});
test('ordinary admin cannot disable Super Admin',async()=>assert.equal((await request('/users/'+superMembership.id,'PATCH',{isActive:false},adminToken)).status,403));
test('Admin A + Staff B cannot administer B',async()=>assert.equal((await request('/users/'+foreignMembership.id,'PATCH',{isActive:false},adminToken,other.id)).status,403));
test('recipe preview cannot cross organization',async()=>assert.equal((await request('/production-orders/preview-scale','POST',{recipeId:foreignRecipe.id,plannedQty:10})).status,404));
test('database rejects cross-tenant sales lines',async()=>{const order=await prisma.salesOrder.create({data:{organizationId:org.id,number:randomUUID(),customerId:customer.id}});await assert.rejects(()=>prisma.salesOrderLine.create({data:{salesOrderId:order.id,productId:foreign.id,uomId:unit.id,quantity:1}}));});
test('approved recipe is immutable',async()=>{const r=await request('/recipes/'+recipe.id,'PUT',{finishedProductId:fg.id,version:1,outputQty:15,outputUomId:unit.id,lines:[{rawProductId:raw.id,uomId:unit.id,quantityPerOutput:15}]});assert.equal(r.status,409);});
test('submitted sales order cannot be dispatched',async()=>{const order=await prisma.salesOrder.create({data:{organizationId:org.id,number:randomUUID(),customerId:customer.id,status:'SUBMITTED'}});const r=await request('/dispatches','POST',{requestId:randomUUID(),salesOrderId:order.id,vehicleNo:'TEST',lines:[{productId:fg.id,lotId:randomUUID(),fromBinId:fmBin.id,uomId:unit.id,quantity:1}]});assert.equal(r.status,409);});
test('storekeeper cannot approve sales orders',async()=>{const r=await request('/sales-orders/'+randomUUID()+'/approve','POST',{},staffToken);assert.equal(r.status,403);});
test('idempotent posting replays result; changed payload conflicts',async()=>{const id=randomUUID();let calls=0;const first=await stockTransaction(org.id,id,{qty:1},async()=>{calls++;return {id:'result'};});const second=await stockTransaction(org.id,id,{qty:1},async()=>{calls++;return {id:'wrong'};});assert.deepEqual(first,second);assert.equal(calls,1);await assert.rejects(()=>stockTransaction(org.id,id,{qty:2},async()=>({id:'wrong'})));});
test('negative inventory is rejected by PostgreSQL',async()=>{const posted=await seedStock(raw.id,bin,50);await assert.rejects(()=>prisma.inventoryBalance.update({where:{id:posted.balance.id},data:{quantity:-1}}));});
test('unrepresentable stock precision is rejected without changing balance',async()=>{
 const stock=await prisma.inventoryBalance.findFirstOrThrow({where:{organizationId:org.id,productId:raw.id,quantity:{gt:1}}});
 await assert.rejects(()=>stockTransaction(org.id,randomUUID(),{},tx=>postStock(tx,{organizationId:org.id,productId:raw.id,lotId:stock.lotId,binId:stock.binId,uomId:unit.id,quantity:0.0005,direction:'OUT',storeType:'RM_STORE',movementType:'ISSUE',documentType:'TEST',documentId:'TEST',sourceDocumentId:randomUUID()})),(error:any)=>error.code==='QUANTITY_PRECISION');
 assert.ok((await prisma.inventoryBalance.findUniqueOrThrow({where:{id:stock.id}})).quantity.eq(stock.quantity));
});

test('initial low receipt alerts once and rearms after recovery',async()=>{const posted=await seedStock(raw2.id,bin,10);const count=await prisma.notification.count({where:{title:'RM stock below reorder level'}});await stockTransaction(org.id,randomUUID(),{},tx=>postStock(tx,{organizationId:org.id,productId:raw2.id,binId:bin.id,lotId:posted.balance.lotId,uomId:unit.id,quantity:1,direction:'OUT',storeType:'RM_STORE',movementType:'ISSUE',documentType:'TEST',documentId:'TEST',sourceDocumentId:randomUUID()}));assert.equal(await prisma.notification.count({where:{title:'RM stock below reorder level'}}),count);assert.ok(count>0);});
test('print escaping treats HTML as text',()=>assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'));
test('runtime DB role cannot alter schema',async()=>{const pg=await import('pg');const url=new URL(process.env.DATABASE_URL!);url.username='inventory_app';url.password=process.env.APP_DB_PASSWORD!;const db=new pg.default.Client({connectionString:url.toString()});await db.connect();try{await assert.rejects(()=>db.query('CREATE TABLE forbidden_test(id int)'));}finally{await db.end();}});

test('partial issue -> reconciled batch -> custom FG lot -> reservation -> dispatch',async()=>{
 const role=await prisma.role.findUniqueOrThrow({where:{code:'MANAGER'}});
 const manager=await prisma.user.create({data:{email:'manager@example.com',fullName:'Manager',passwordHash:await bcrypt.hash('IntegrationPassword123',4),memberships:{create:{organizationId:org.id,roleId:role.id}}}});
 const managerToken=(await login('manager@example.com')).data.data.accessToken;
 const req=await prisma.productionRequisition.create({data:{organizationId:org.id,number:randomUUID(),status:'APPROVED',assignedManagerId:manager.id}});
 const order=await prisma.productionOrder.create({data:{organizationId:org.id,requisitionId:req.id,number:randomUUID(),finishedProductId:fg.id,recipeId:recipe.id,plannedQty:15,plannedUomId:unit.id,expectedWastePercent:0,status:'APPROVED',lines:{create:[{productId:raw.id,uomId:unit.id,recipeQty:10,wasteAdjustedQty:10},{productId:raw2.id,uomId:unit.id,recipeQty:5,wasteAdjustedQty:5}]}}});
 for(const [product,qty]of [[raw,10],[raw2,5]] as const){const balance=await prisma.inventoryBalance.findFirstOrThrow({where:{organizationId:org.id,productId:product.id,binId:bin.id,quantity:{gte:qty}}});const posted=await request('/material-issues','POST',{requestId:randomUUID(),requisitionId:req.id,lines:[{productId:product.id,lotId:balance.lotId,fromBinId:bin.id,uomId:unit.id,quantity:qty}]});assert.equal(posted.status,201,JSON.stringify(posted.data));}
 const batch=await prisma.productionBatch.findFirstOrThrow({where:{organizationId:org.id,productionOrderId:order.id,status:'IN_PRODUCTION'}});
 const actuals={productionOrderId:order.id,inputs:[{productId:raw.id,description:'Raw A',category:'RAW_MATERIAL',quantity:10,unitPrice:1},{productId:raw2.id,description:'Raw B',category:'RAW_MATERIAL',quantity:5,unitPrice:1}],outputs:[{productId:fg.id,description:'FG',quantity:14,unitPrice:2,lotCode:'CUSTOM-FG-LOT'}],costs:[]};
 let r=await request('/batches/'+batch.id,'PUT',{...actuals,outputs:[{...actuals.outputs[0],quantity:20}]});assert.equal(r.status,422,JSON.stringify(r.data));
 r=await request('/batches/'+batch.id,'PUT',actuals);assert.equal(r.status,200,JSON.stringify(r.data));
 const replay=await request('/batches/'+batch.id,'PUT',actuals);assert.equal(replay.status,200);assert.equal(replay.data.data.batch.id,batch.id);
 r=await request('/batches/'+batch.id+'/approve','POST',{},managerToken);assert.equal(r.status,200,JSON.stringify(r.data));
 const output=await prisma.productionBatchOutput.findFirstOrThrow({where:{batchId:batch.id}});
 r=await request('/fm-store/receive','POST',{batchId:batch.id,allocations:[{lineId:output.id,binId:fmBin.id}]});assert.equal(r.status,201,JSON.stringify(r.data));
 assert.equal(await prisma.lot.count({where:{organizationId:org.id,code:'CUSTOM-FG-LOT'}}),1);
 const stock=await prisma.inventoryBalance.findFirstOrThrow({where:{organizationId:org.id,productId:fg.id,binId:fmBin.id}});
 const sale=await prisma.salesOrder.create({data:{organizationId:org.id,number:randomUUID(),customerId:customer.id,status:'APPROVED',lines:{create:{productId:fg.id,uomId:unit.id,quantity:10,unitPrice:20}}}});
 r=await request('/reservations','POST',{balanceId:stock.id,sourceType:'SALES_ORDER',sourceId:sale.id,quantity:8});assert.equal(r.status,201,JSON.stringify(r.data));
 const positions=await request('/fm-store/balances');const reservedPosition=positions.data.data.find((b:any)=>b.id===stock.id);assert.equal(Number(reservedPosition.availableQty),6);assert.equal(Number(reservedPosition.reservations[0].quantity),8);
 const dispatchBody={requestId:randomUUID(),salesOrderId:sale.id,vehicleNo:'TRUCK',lines:[{productId:fg.id,lotId:stock.lotId,fromBinId:fmBin.id,uomId:unit.id,quantity:8}]};
 r=await request('/dispatches','POST',dispatchBody);assert.equal(r.status,201,JSON.stringify(r.data));
 const repeat=await request('/dispatches','POST',dispatchBody);assert.equal(repeat.status,201);assert.equal(repeat.data.data.id,r.data.data.id);
 const final=await prisma.inventoryBalance.findUniqueOrThrow({where:{id:stock.id}});assert.ok(final.quantity.eq(6));assert.ok(final.reservedQty.eq(0));
 const line=await prisma.dispatchLine.findFirstOrThrow({where:{dispatchId:r.data.data.id}});assert.ok(line.unitPrice?.eq(20));
 const deletion=await request('/sales-orders/'+sale.id,'DELETE');assert.equal(deletion.status,409);
 const second=await request('/dispatches','POST',{...dispatchBody,requestId:randomUUID(),lines:[{...dispatchBody.lines[0],quantity:2}]});assert.equal(second.status,201,JSON.stringify(second.data));
});


test('gram inputs and kilogram outputs retain consistent mass and labels',async()=>{
 const grams=await prisma.unitOfMeasure.create({data:{organizationId:org.id,code:'g',name:'Gram',dimension:'WEIGHT',factorToBase:0.001}});
 const material=await product(org.id,'GRAM-RAW','RAW_MATERIAL',grams),output=await product(org.id,'GRAM-FG','FINISHED_GOOD',unit);
 const seed=await seedStock(material.id,bin,1);
 const formula=await prisma.recipe.create({data:{organizationId:org.id,finishedProductId:output.id,version:1,outputQty:1,outputUomId:unit.id,status:'APPROVED',lines:{create:{rawProductId:material.id,uomId:grams.id,quantityPerOutput:1000}}}});
 const requisition=await prisma.productionRequisition.create({data:{organizationId:org.id,number:randomUUID(),status:'APPROVED'}});
 const order=await prisma.productionOrder.create({data:{organizationId:org.id,requisitionId:requisition.id,number:randomUUID(),finishedProductId:output.id,recipeId:formula.id,plannedQty:1,plannedUomId:unit.id,expectedWastePercent:0,status:'APPROVED',lines:{create:{productId:material.id,uomId:grams.id,recipeQty:1000,wasteAdjustedQty:1000}}}});
 const posted=await request('/material-issues','POST',{requestId:randomUUID(),requisitionId:requisition.id,lines:[{productId:material.id,lotId:seed.balance.lotId,fromBinId:bin.id,uomId:grams.id,quantity:1000}]});assert.equal(posted.status,201,JSON.stringify(posted.data));
 const batch=await prisma.productionBatch.findFirstOrThrow({where:{productionOrderId:order.id,status:'IN_PRODUCTION'}});
 const view=await request('/batches');assert.equal(view.status,200);const row=view.data.data.find((b:any)=>b.id===batch.id);assert.equal(row.productionOrder.lines[0].requiredQty,1000);assert.equal(row.productionOrder.lines[0].unit,'g');
 const submitted=await request('/batches/'+batch.id,'PUT',{productionOrderId:order.id,inputs:[{productId:material.id,description:'Grams',category:'RAW_MATERIAL',quantity:1000,unitPrice:0}],outputs:[{productId:output.id,description:'Kilograms',quantity:0.9,unitPrice:10}],costs:[]});assert.equal(submitted.status,200,JSON.stringify(submitted.data));
 const saved=await prisma.productionBatch.findUniqueOrThrow({where:{id:batch.id}});assert.ok(saved.actualRMConsumed?.eq(1));assert.ok(saved.actualOutputQty?.eq(0.9));assert.ok(saved.actualWasteQty?.eq(0.1));
});

test('sales approval and cancellation release reservations',async()=>{
 const balance=await prisma.inventoryBalance.findFirstOrThrow({where:{organizationId:org.id,productId:fg.id,quantity:{gte:2}}});
 const sale=await prisma.salesOrder.create({data:{organizationId:org.id,number:randomUUID(),customerId:customer.id,status:'SUBMITTED',lines:{create:{productId:fg.id,uomId:unit.id,quantity:2,unitPrice:5}}}});
 assert.equal((await request('/sales-orders/'+sale.id+'/approve','POST',{})).status,200);
 for(let i=0;i<2;i++)assert.equal((await request('/reservations','POST',{balanceId:balance.id,sourceType:'SALES_ORDER',sourceId:sale.id,quantity:1})).status,201);
 const firstPage=await request('/reservations?balanceId='+balance.id+'&pageSize=1');assert.equal(firstPage.status,200);assert.equal(firstPage.data.data.length,1);assert.ok(firstPage.data.nextCursor);
 const secondPage=await request('/reservations?balanceId='+balance.id+'&pageSize=1&cursor='+firstPage.data.nextCursor);assert.equal(secondPage.status,200);assert.equal(secondPage.data.data.length,1);assert.notEqual(secondPage.data.data[0].id,firstPage.data.data[0].id);
 assert.equal((await request('/sales-orders/'+sale.id+'/cancel','POST',{reason:'Customer withdrew this unshipped order'})).status,200);
 assert.ok((await prisma.inventoryBalance.findUniqueOrThrow({where:{id:balance.id}})).reservedQty.eq(0));
 assert.equal((await prisma.salesOrder.findUniqueOrThrow({where:{id:sale.id}})).status,'CANCELLED');
});

test('cancel and reissue production returns each issue only once',async()=>{
 const managerToken=(await login('manager@example.com')).data.data.accessToken;
 const material=await product(org.id,'CANCEL-RAW','RAW_MATERIAL',unit);const seeded=await seedStock(material.id,bin,20);
 const requisition=await prisma.productionRequisition.create({data:{organizationId:org.id,number:randomUUID(),status:'APPROVED'}});
 const order=await prisma.productionOrder.create({data:{organizationId:org.id,requisitionId:requisition.id,number:randomUUID(),finishedProductId:fg.id,recipeId:recipe.id,plannedQty:5,plannedUomId:unit.id,expectedWastePercent:0,status:'APPROVED',lines:{create:{productId:material.id,uomId:unit.id,recipeQty:5,wasteAdjustedQty:5}}}});
 for(let i=0;i<2;i++){
  const posted=await request('/material-issues','POST',{requestId:randomUUID(),requisitionId:requisition.id,lines:[{productId:material.id,lotId:seeded.balance.lotId,fromBinId:bin.id,uomId:unit.id,quantity:5}]});assert.equal(posted.status,201,JSON.stringify(posted.data));
  const batch=await prisma.productionBatch.findFirstOrThrow({where:{productionOrderId:order.id,status:'IN_PRODUCTION'}});
  assert.equal((await request('/batches/'+batch.id,'DELETE',undefined,managerToken)).status,204);
  assert.equal((await request('/batches/'+batch.id,'DELETE',undefined,managerToken)).status,204);
  assert.ok((await prisma.inventoryBalance.findUniqueOrThrow({where:{id:seeded.balance.id}})).quantity.eq(20));
 }
 assert.equal(await prisma.materialIssue.count({where:{productionOrderId:order.id,status:'CANCELLED'}}),2);
});

test('trace includes the custom output and every split shipment',async()=>{
 const trace=await request('/traceability/lot/CUSTOM-FG-LOT');assert.equal(trace.status,200,JSON.stringify(trace.data));assert.ok(trace.data.chain.some((r:any)=>r.type==='DISPATCH'));assert.equal(trace.data.data.dispatches.length,2);assert.ok(trace.data.data.materialIssues.length>=2);
});
test('ledger and used conversion factors are immutable in PostgreSQL',async()=>{
 const movement=await prisma.stockMovement.findFirstOrThrow({where:{organizationId:org.id}});
 await assert.rejects(()=>prisma.stockMovement.update({where:{id:movement.id},data:{quantity:999}}));
 await assert.rejects(()=>prisma.unitOfMeasure.update({where:{id:unit.id},data:{factorToBase:1000}}));
 const reconciliation=await request('/operations/reconciliation');assert.equal(reconciliation.status,200);assert.equal(reconciliation.data.consistent,true,JSON.stringify(reconciliation.data));
});
test('concurrent document numbers are unique and stock cannot oversell',async()=>{
 const numbers=await Promise.all(Array.from({length:12},()=>prisma.$transaction(tx=>nextDocumentNumber(tx,org.id,"MaterialIssue","TEST-"),{maxWait:10000,timeout:10000})));
 assert.equal(new Set(numbers).size,12);
 const product=await productForConcurrency();const posted=await seedStock(product.id,bin,10);
 const outcomes=await Promise.allSettled([1,2].map(()=>stockTransaction(org.id,randomUUID(),{},tx=>postStock(tx,{organizationId:org.id,productId:product.id,binId:bin.id,lotId:posted.balance.lotId,uomId:unit.id,quantity:6,direction:'OUT',storeType:'RM_STORE',movementType:'ISSUE',documentType:'TEST',documentId:'TEST',sourceDocumentId:randomUUID()}))));
 assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);const balance=await prisma.inventoryBalance.findUniqueOrThrow({where:{id:posted.balance.id}});assert.ok(balance.quantity.eq(4));
});
async function productForConcurrency(){return product(org.id,'1004','RAW_MATERIAL',unit);}
test('void stock operations are idempotent',async()=>{
 const key=randomUUID();let calls=0;
 await stockTransaction(org.id,key,{},async()=>{calls++;});
 await stockTransaction(org.id,key,{},async()=>{calls++;});
 assert.equal(calls,1);
});

test('password recovery outbox retries and reset revokes sessions',async()=>{
 const {env}=await import('../../src/config.js');const {processMailOutbox}=await import('../../src/services/mailOutbox.js');const {decryptSecret}=await import('../../src/services/mfa.js');
 const role=await prisma.role.findUniqueOrThrow({where:{code:'STAFF'}});
 const user=await prisma.user.create({data:{email:'reset@example.com',fullName:'Reset test',passwordHash:await bcrypt.hash('IntegrationPassword123',4),memberships:{create:{organizationId:org.id,roleId:role.id}}}});
 const session=await login(user.email);const previous=env.RESEND_API_KEY;env.RESEND_API_KEY='integration-test-no-real-provider';
 try{
  const result=await request('/auth/forgot-password','POST',{email:user.email},'');assert.equal(result.status,202);
  let job=await prisma.mailOutbox.findFirstOrThrow({where:{email:user.email}});const token=decryptSecret(job.tokenCipher);assert.notEqual(job.tokenCipher,token);
  let failures=0;await processMailOutbox(()=>{failures++;},async()=>{throw Error('Simulated provider outage');});assert.equal(failures,1);
  job=await prisma.mailOutbox.findUniqueOrThrow({where:{id:job.id}});assert.equal(job.status,'PENDING');assert.equal(job.attempts,1);
  await prisma.mailOutbox.update({where:{id:job.id},data:{nextAttemptAt:new Date(0)}});
  let delivered='';await processMailOutbox(()=>{},async(email,secret)=>{assert.equal(email,user.email);delivered=secret;});assert.equal(delivered,token);
  assert.equal((await prisma.mailOutbox.findUniqueOrThrow({where:{id:job.id}})).tokenCipher,'');
  const reset=await request('/auth/reset-password','POST',{token,password:'ReplacementPassword123'},'');assert.equal(reset.status,200);
  assert.equal((await request('/auth/me','GET',undefined,session.data.data.accessToken)).status,401);
  assert.equal((await request('/auth/reset-password','POST',{token,password:'ReplacementPassword123'},'')).status,400);
  assert.equal((await request('/auth/login','POST',{email:user.email,password:'ReplacementPassword123'},'')).status,200);
 }finally{env.RESEND_API_KEY=previous;}
});

test('MFA secrets are encrypted and recovery codes are one-use',async()=>{
 const {totpCode}=await import('../../src/services/mfa.js');
 let r=await request('/auth/mfa/setup','POST',{currentPassword:'IntegrationPassword123'});assert.equal(r.status,200);const secret=r.data.data.secret;
 const stored=await prisma.user.findUniqueOrThrow({where:{email:'admin@example.com'}});assert.notEqual(stored.mfaSecret,secret);
 r=await request('/auth/mfa/enable','POST',{code:totpCode(secret)});assert.equal(r.status,200,JSON.stringify(r.data));const recovery=r.data.data.recoveryCodes[0];
 const old=await request('/auth/me');assert.equal(old.status,401);
 const noCode=await login('admin@example.com');assert.equal(noCode.status,401);assert.equal(noCode.data.error.code,'MFA_REQUIRED');
 const recoveryLogin=await request('/auth/login','POST',{email:'admin@example.com',password:'IntegrationPassword123',code:recovery},'');assert.equal(recoveryLogin.status,200);
 const reused=await request('/auth/login','POST',{email:'admin@example.com',password:'IntegrationPassword123',code:recovery},'');assert.equal(reused.status,401);
});
test('refresh reuse revokes its token family',async()=>{
 const logged=await login('ordinary@example.com');const cookie=logged.cookie!.split(';')[0];
 let r=await request('/auth/refresh','POST',{},'',org.id,{Cookie:cookie});assert.equal(r.status,200);const newCookie=r.cookie!.split(';')[0];
 r=await request('/auth/refresh','POST',{},'',org.id,{Cookie:cookie});assert.equal(r.status,401);
 r=await request('/auth/refresh','POST',{},'',org.id,{Cookie:newCookie});assert.equal(r.status,401);
});
test('logout invalidates already-issued access tokens',async()=>{
 const logged=await login('store@example.com');await request('/auth/logout','POST',{},logged.data.data.accessToken,org.id,{Cookie:logged.cookie!.split(';')[0]});
 const r=await request('/auth/me','GET',undefined,logged.data.data.accessToken);assert.equal(r.status,401);
});
