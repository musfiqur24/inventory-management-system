import { hasPermission } from "../modules/rbac.js";
import { Router } from 'express';
import { prisma } from '../prisma.js';
export const dashboardRouter=Router();
dashboardRouter.get('/',async(req,res)=>{
 const organizationId=req.tenantId!;
 const reports=await prisma.moduleReport.findMany({where:{organizationId,module:{isActive:true},moduleCode:{in:req.auth!.isSuperAdmin?(await prisma.businessModule.findMany({where:{isActive:true}})).map(m=>m.code):req.auth!.organizations.find(o=>o.id===organizationId)?.modules.filter(m=>hasPermission(req.auth,organizationId,m.code+".reports.read")).map(m=>m.code)??[]}},orderBy:{reportingDate:"desc"},take:100});
 const can=(resource:string)=>hasPermission(req.auth,organizationId,'feed.'+resource+'.read')||hasPermission(req.auth,organizationId,'feed.reports.read');
 if(!['procurement','production','sales','rm_store','reports'].some(can))return res.json({data:{reports}});
 const [pendingRequisitions,pendingDeliveries,activeBatches,pendingDispatches,low,movements]=await Promise.all([
  can("procurement")?prisma.purchaseRequisition.count({where:{organizationId,deletedAt:null,status:{in:['PENDING','AWAITING_DELIVERY','INCOMPLETE','PARTIALLY_RECEIVED']}}}):Promise.resolve(null),
  can("procurement")?prisma.supplierDelivery.count({where:{organizationId,deletedAt:null,status:{in:['SUBMITTED','WEIGHED']}}}):Promise.resolve(null),
  can("production")?prisma.productionBatch.count({where:{organizationId,status:{in:['IN_PRODUCTION','SUBMITTED','READY']}}}):Promise.resolve(null),
  can("sales")?prisma.salesOrder.count({where:{organizationId,status:{in:['APPROVED','PARTIALLY_RECEIVED']}}}):Promise.resolve(null),
  can("rm_store")?prisma.$queryRaw<Array<{count:bigint}>>`SELECT count(DISTINCT x."productId") AS count FROM (SELECT b."productId",s.id FROM "InventoryBalance" b JOIN "Bin" bn ON bn.id=b."binId" JOIN "Store" s ON s.id=bn."storeId" JOIN "UnitOfMeasure" u ON u.id=b."uomId" WHERE b."organizationId"=${organizationId} AND s."storeType"='RM_STORE' AND u.dimension='WEIGHT' GROUP BY b."productId",s.id HAVING SUM(b.quantity*u."factorToBase")<20) x`:Promise.resolve(null),
  can('reports')?prisma.stockMovement.findMany({where:{organizationId},take:8,orderBy:{occurredAt:'desc'}}):Promise.resolve([]),
 ]);
 const [products,units]=await Promise.all([prisma.product.findMany({where:{organizationId,id:{in:movements.map(m=>m.productId)}},select:{id:true,name:true}}),prisma.unitOfMeasure.findMany({where:{organizationId,id:{in:movements.map(m=>m.uomId)}},select:{id:true,code:true}})]);
 res.json({data:{reports,pendingRequisitions,pendingDeliveries,activeBatches,pendingDispatches,lowStockCount:low===null?null:Number(low[0]?.count??0),movements:movements.map(m=>({...m,product:products.find(p=>p.id===m.productId),uom:units.find(u=>u.id===m.uomId)}))}});
});
