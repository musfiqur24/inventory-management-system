import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
export const traceabilityRouter=Router();
traceabilityRouter.get('/',async(req,res)=>{
 const {q,page,pageSize}=z.object({q:z.string().trim().max(128).default(''),page:z.coerce.number().int().min(1).default(1),pageSize:z.coerce.number().int().min(1).max(100).default(50)}).parse(req.query);
 const org=req.tenantId!,pattern='%'+q.toLowerCase().replace(/[\\%_]/g,'\\$&')+'%';
 const data=await prisma.$queryRaw<Array<{id:string;code:string;type:string;title:string}>>`
 SELECT * FROM (
 SELECT l.id,l.code,'LOT' AS type,COALESCE(p.name,'')||' / '||l.code AS title FROM "Lot" l JOIN "Product" p ON p.id=l."productId" WHERE l."organizationId"=${org}
 UNION ALL SELECT id,number,'BATCH',number FROM "ProductionBatch" WHERE "organizationId"=${org}
 UNION ALL SELECT id,number,'DISPATCH',number FROM "Dispatch" WHERE "organizationId"=${org}
 UNION ALL SELECT id,number,'REQUISITION',number FROM "PurchaseRequisition" WHERE "organizationId"=${org}
 UNION ALL SELECT id,number,'PRODUCTION_REQUISITION',number FROM "ProductionRequisition" WHERE "organizationId"=${org}
 UNION ALL SELECT id,number,'DELIVERY',number FROM "SupplierDelivery" WHERE "organizationId"=${org}
 ) records WHERE lower(title) LIKE ${pattern} ORDER BY type,code LIMIT ${pageSize+1} OFFSET ${(page-1)*pageSize}`;
 res.json({data:data.slice(0,pageSize).map(r=>({...r,targetId:r.code})),pagination:{page,pageSize,hasMore:data.length>pageSize}});
});
const handleTrace=async(req:import('express').Request,res:import('express').Response)=>{
 const identifier=z.string().trim().min(1).max(128).parse(req.params.identifier),org=req.tenantId!;
 const nodes=await prisma.$queryRaw<Array<{node:string}>>`
 WITH RECURSIVE roots(node) AS (
 SELECT 'lot:'||id FROM "Lot" WHERE "organizationId"=${org} AND (id=${identifier} OR code=${identifier})
 UNION SELECT 'batch:'||id FROM "ProductionBatch" WHERE "organizationId"=${org} AND (id=${identifier} OR number=${identifier})
 UNION SELECT 'dispatch:'||id FROM "Dispatch" WHERE "organizationId"=${org} AND (id=${identifier} OR number=${identifier})
 UNION SELECT 'purchase:'||id FROM "PurchaseRequisition" WHERE "organizationId"=${org} AND (id=${identifier} OR number=${identifier})
 UNION SELECT 'production:'||id FROM "ProductionRequisition" WHERE "organizationId"=${org} AND (id=${identifier} OR number=${identifier})
 UNION SELECT 'order:'||id FROM "ProductionOrder" WHERE "organizationId"=${org} AND (id=${identifier} OR number=${identifier})
 UNION SELECT 'delivery:'||id FROM "SupplierDelivery" WHERE "organizationId"=${org} AND (id=${identifier} OR number=${identifier})
 ), edges(a,b) AS (
 SELECT 'lot:'||id,'batch:'||"productionBatchId" FROM "Lot" WHERE "organizationId"=${org} AND "productionBatchId" IS NOT NULL
 UNION ALL SELECT 'lot:'||id,'delivery:'||"supplierDeliveryId" FROM "Lot" WHERE "organizationId"=${org} AND "supplierDeliveryId" IS NOT NULL
 UNION ALL SELECT 'batch:'||id,'order:'||"productionOrderId" FROM "ProductionBatch" WHERE "organizationId"=${org}
 UNION ALL SELECT 'order:'||id,'production:'||"requisitionId" FROM "ProductionOrder" WHERE "organizationId"=${org} AND "requisitionId" IS NOT NULL
 UNION ALL SELECT 'issue:'||i.id,'order:'||i."productionOrderId" FROM "MaterialIssue" i WHERE i."organizationId"=${org}
 UNION ALL SELECT 'issue:'||i.id,'lot:'||l."lotId" FROM "MaterialIssue" i JOIN "MaterialIssueLine" l ON l."issueId"=i.id WHERE i."organizationId"=${org} AND l."lotId" IS NOT NULL
 UNION ALL SELECT 'dispatch:'||d.id,'lot:'||l."lotId" FROM "Dispatch" d JOIN "DispatchLine" l ON l."dispatchId"=d.id WHERE d."organizationId"=${org} AND l."lotId" IS NOT NULL
 UNION ALL SELECT 'dispatch:'||id,'sale:'||"salesOrderId" FROM "Dispatch" WHERE "organizationId"=${org}
 UNION ALL SELECT 'delivery:'||id,'purchase:'||"requisitionId" FROM "SupplierDelivery" WHERE "organizationId"=${org} AND "requisitionId" IS NOT NULL
 ), reach(node) AS (SELECT node FROM roots UNION SELECT CASE WHEN e.a=r.node THEN e.b ELSE e.a END FROM reach r JOIN edges e ON e.a=r.node OR e.b=r.node)
 SELECT node FROM reach LIMIT 10001`;
 if(!nodes.length)return res.status(404).json({error:{code:'NOT_FOUND',message:'No matching record in this organization'}});
 if(nodes.length>10000)return res.status(422).json({error:{code:'TRACE_TOO_LARGE',message:'This connected trace exceeds 10,000 records. Export a scoped recall report with your administrator.'}});
 const ids=(type:string)=>nodes.filter(n=>n.node.startsWith(type+':')).map(n=>n.node.slice(type.length+1));
 const [lots,batches,orders,issues,dispatches,deliveries,purchases,sales]=await Promise.all([
 prisma.lot.findMany({where:{organizationId:org,id:{in:ids('lot')}},include:{balances:{include:{bin:true}}}}),
 prisma.productionBatch.findMany({where:{organizationId:org,id:{in:ids('batch')}}}),
 prisma.productionOrder.findMany({where:{organizationId:org,id:{in:ids('order')}},include:{lines:true}}),
 prisma.materialIssue.findMany({where:{organizationId:org,id:{in:ids('issue')}},include:{lines:true}}),
 prisma.dispatch.findMany({where:{organizationId:org,id:{in:ids('dispatch')}},include:{lines:true}}),
 prisma.supplierDelivery.findMany({where:{organizationId:org,id:{in:ids('delivery')}},select:{id:true,number:true,status:true,requisitionId:true,supplierId:true,deliveredAt:true,lines:true}}),
 prisma.purchaseRequisition.findMany({where:{organizationId:org,id:{in:ids('purchase')}},include:{lines:true}}),
 prisma.salesOrder.findMany({where:{organizationId:org,id:{in:ids('sale')}},include:{lines:true,assignedPerson:{select:{id:true,fullName:true}}}}),
 ]);
 const customers=await prisma.partner.findMany({where:{organizationId:org,id:{in:sales.map(s=>s.customerId)}},select:{id:true,name:true}});
 const chain:Array<{type:string;label:string;id:string;date?:string;status:string;details:Record<string,string|number|null>}>=[];
 for(const r of purchases)chain.push({type:'REQUISITION',label:r.number,id:r.id,status:r.status,date:r.requestedOn.toISOString(),details:{kind:'Raw material requisition'}});
 for(const r of deliveries)chain.push({type:'DELIVERY',label:r.number,id:r.id,status:r.status,date:r.deliveredAt?.toISOString(),details:{lines:r.lines.length}});
 for(const r of issues)chain.push({type:'PRODUCTION_ORDER',label:r.number,id:r.id,status:r.status,date:r.issuedAt?.toISOString(),details:{kind:'Material issue',lines:r.lines.length}});
 for(const r of batches)chain.push({type:'BATCH',label:r.number,id:r.id,status:r.status,details:{outputKg:Number(r.actualOutputQty??0)}});
 for(const r of lots)chain.push({type:'LOT',label:r.code,id:r.id,status:r.qualityStatus,details:{positions:r.balances.length}});
 for(const r of dispatches){const sale=sales.find(s=>s.id===r.salesOrderId);chain.push({type:'DISPATCH',label:r.number,id:r.id,status:r.status,date:r.dispatchedAt?.toISOString(),details:{customer:customers.find(c=>c.id===sale?.customerId)?.name??null,lines:r.lines.length}});}
 res.json({traceId:identifier,traceType:String(req.params.type??'record'),chain,data:{lots,batches,productionOrders:orders,materialIssues:issues,dispatches,supplierDeliveries:deliveries,rmRequisitions:purchases,salesOrders:sales,customers},scope:'Connected genealogy including sibling lots and split shipments'});
};
traceabilityRouter.get('/:identifier',handleTrace);
traceabilityRouter.get('/:type/:identifier',handleTrace);
