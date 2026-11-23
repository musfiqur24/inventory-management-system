import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { requestMetrics } from '../services/metrics.js';
export const operationsRouter=Router();
operationsRouter.use((req,res,next)=>{const allowed=req.auth?.isSuperAdmin||req.auth?.organizations.find(o=>o.id===req.tenantId)?.permissions.includes('users.manage');if(!allowed)return res.status(403).json({error:{message:'Administrator access required'}});next();});
operationsRouter.get('/metrics',(_req,res)=>res.json({data:{requests:requestMetrics(),uptimeSeconds:process.uptime(),memory:process.memoryUsage()}}));
operationsRouter.get('/audit',async(req,res)=>{
 const q=z.object({cursor:z.string().uuid().optional(),pageSize:z.coerce.number().int().min(1).max(100).default(50)}).parse(req.query);
 const rows=await prisma.auditEvent.findMany({where:{organizationId:req.tenantId!},orderBy:[{createdAt:'desc'},{id:'desc'}],take:q.pageSize+1,...(q.cursor?{cursor:{id:q.cursor},skip:1}:{})});
 res.json({data:rows.slice(0,q.pageSize),nextCursor:rows.length>q.pageSize?rows[q.pageSize-1].id:null});
});
operationsRouter.get('/reconciliation',async(req,res)=>{
 const rows=await prisma.$queryRaw<Array<{productId:string;lotId:string;binId:string;ledger:string;balance:string}>>`
 WITH entries AS (
 SELECT m."productId",m."lotId",m."toBinId" AS "binId",m.quantity*u."factorToBase" AS qty FROM "StockMovement" m JOIN "UnitOfMeasure" u ON u.id=m."uomId" WHERE m."organizationId"=${req.tenantId!} AND m."toBinId" IS NOT NULL
 UNION ALL SELECT m."productId",m."lotId",m."fromBinId",-m.quantity*u."factorToBase" FROM "StockMovement" m JOIN "UnitOfMeasure" u ON u.id=m."uomId" WHERE m."organizationId"=${req.tenantId!} AND m."fromBinId" IS NOT NULL
 ), ledger AS (SELECT "productId","lotId","binId",sum(qty) AS qty FROM entries GROUP BY "productId","lotId","binId"), balance AS (
 SELECT b."productId",b."lotId",b."binId",b.quantity*u."factorToBase" AS qty FROM "InventoryBalance" b JOIN "UnitOfMeasure" u ON u.id=b."uomId" WHERE b."organizationId"=${req.tenantId!}
 ) SELECT coalesce(l."productId",b."productId") AS "productId",coalesce(l."lotId",b."lotId") AS "lotId",coalesce(l."binId",b."binId") AS "binId",coalesce(l.qty,0)::text AS ledger,coalesce(b.qty,0)::text AS balance FROM ledger l FULL JOIN balance b USING("productId","lotId","binId") WHERE abs(coalesce(l.qty,0)-coalesce(b.qty,0))>0.0005 LIMIT 101`;
 res.json({data:rows.slice(0,100),consistent:rows.length===0,truncated:rows.length>100});
});
