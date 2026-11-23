import { Router } from 'express';
import { prisma } from '../prisma.js';
export const dashboardRouter=Router();
dashboardRouter.get('/',async(req,res)=>{
 const organizationId=req.tenantId!;
 const [pendingRequisitions,pendingDeliveries,activeBatches,pendingDispatches,low,movements]=await Promise.all([
  prisma.purchaseRequisition.count({where:{organizationId,deletedAt:null,status:{in:['PENDING','AWAITING_DELIVERY','INCOMPLETE','PARTIALLY_RECEIVED']}}}),
  prisma.supplierDelivery.count({where:{organizationId,deletedAt:null,status:{in:['SUBMITTED','WEIGHED']}}}),
  prisma.productionBatch.count({where:{organizationId,status:{in:['IN_PRODUCTION','SUBMITTED','READY']}}}),
  prisma.salesOrder.count({where:{organizationId,status:{in:['APPROVED','PARTIALLY_RECEIVED']}}}),
  prisma.$queryRaw<Array<{count:bigint}>>`SELECT count(DISTINCT x."productId") AS count FROM (SELECT b."productId",s.id FROM "InventoryBalance" b JOIN "Bin" bn ON bn.id=b."binId" JOIN "Store" s ON s.id=bn."storeId" JOIN "UnitOfMeasure" u ON u.id=b."uomId" WHERE b."organizationId"=${organizationId} AND s."storeType"='RM_STORE' AND u.dimension='WEIGHT' GROUP BY b."productId",s.id HAVING SUM(b.quantity*u."factorToBase")<20) x`,
  prisma.stockMovement.findMany({where:{organizationId},take:8,orderBy:{occurredAt:'desc'}}),
 ]);
 const [products,units]=await Promise.all([prisma.product.findMany({where:{organizationId,id:{in:movements.map(m=>m.productId)}},select:{id:true,name:true}}),prisma.unitOfMeasure.findMany({where:{organizationId,id:{in:movements.map(m=>m.uomId)}},select:{id:true,code:true}})]);
 res.json({data:{pendingRequisitions,pendingDeliveries,activeBatches,pendingDispatches,lowStockCount:Number(low[0]?.count??0),movements:movements.map(m=>({...m,product:products.find(p=>p.id===m.productId),uom:units.find(u=>u.id===m.uomId)}))}});
});
