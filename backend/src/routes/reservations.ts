import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { Prisma } from '../generated/prisma/client.js';
import { StockError } from '../services/stock.js';
export const reservationsRouter=Router();
reservationsRouter.get('/',async(req,res)=>{
 const query=z.object({balanceId:z.string().uuid().optional(),cursor:z.string().uuid().optional(),pageSize:z.coerce.number().int().min(1).max(100).default(100)}).parse(req.query);
 const rows=await prisma.reservation.findMany({where:{organizationId:req.tenantId!,quantity:{gt:0},...(query.balanceId?{balanceId:query.balanceId}:{})},orderBy:[{createdAt:'desc'},{id:'desc'}],take:query.pageSize+1,...(query.cursor?{cursor:{id:query.cursor},skip:1}:{})});
 res.json({data:rows.slice(0,query.pageSize),nextCursor:rows.length>query.pageSize?rows[query.pageSize-1].id:null});
});
reservationsRouter.post('/',async(req,res)=>{
  const body=z.object({balanceId:z.string().uuid(),sourceType:z.enum(['SALES_ORDER','PRODUCTION_REQUISITION']),sourceId:z.string().uuid(),quantity:z.coerce.number().positive()}).parse(req.body);
  const org=req.tenantId!;
  const data=await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${org} FOR UPDATE`;
    const balance=await tx.inventoryBalance.findFirst({where:{id:body.balanceId,organizationId:org},include:{lot:true,bin:{include:{store:true}},uom:true}});
    if(!balance)throw new StockError('NOT_FOUND','Stock balance not found',404);
    await tx.$queryRaw`SELECT id FROM "Bin" WHERE id=${balance.binId} FOR UPDATE`;
    if(balance.lot.qualityStatus!=='RELEASED'||(balance.lot.expiryDate&&balance.lot.expiryDate<new Date()))throw new StockError('LOT_UNAVAILABLE','Held or expired stock cannot be reserved');
    const quantity=new Prisma.Decimal(body.quantity).toDecimalPlaces(3);
    if(quantity.lte(0)||balance.quantity.minus(balance.reservedQty).lt(quantity))throw new StockError('INSUFFICIENT_STOCK','Insufficient unreserved stock');
    let required=new Prisma.Decimal(0);
    if(body.sourceType==='SALES_ORDER'){
      const order=await tx.salesOrder.findFirst({where:{id:body.sourceId,organizationId:org,status:{in:['APPROVED','PARTIALLY_RECEIVED']}},include:{lines:true}});
      if(!order||balance.bin.store.storeType!=='FM_STORE')throw new StockError('INVALID_ORDER','Select an approved sales order for FM stock',422);
      for(const line of order.lines.filter(l=>l.productId===balance.productId)){
        const unit=await tx.unitOfMeasure.findUniqueOrThrow({where:{id:line.uomId}});
        required=required.plus(line.quantity.minus(line.dispatchedQty).mul(unit.factorToBase));
      }
    }else{
      const requisition=await tx.productionRequisition.findFirst({where:{id:body.sourceId,organizationId:org,status:'APPROVED'},include:{orders:{include:{lines:true}}}});
      if(!requisition||balance.bin.store.storeType!=='RM_STORE')throw new StockError('INVALID_ORDER','Select an approved production requisition for RM stock',422);
      for(const line of requisition.orders.flatMap(o=>o.lines).filter(l=>l.productId===balance.productId)){
        const unit=await tx.unitOfMeasure.findUniqueOrThrow({where:{id:line.uomId}});
        required=required.plus(line.wasteAdjustedQty.minus(line.issuedQty).mul(unit.factorToBase));
      }
    }
    const active=await tx.reservation.findMany({where:{organizationId:org,sourceType:body.sourceType,sourceId:body.sourceId,quantity:{gt:0}}});
    for(const item of active){const b=await tx.inventoryBalance.findUniqueOrThrow({where:{id:item.balanceId},include:{uom:true}});if(b.productId===balance.productId)required=required.minus(item.quantity.mul(b.uom.factorToBase));}
    if(required.lt(quantity.mul(balance.uom.factorToBase)))throw new StockError('ORDER_QUANTITY','Reservation exceeds the outstanding order requirement');
    await tx.inventoryBalance.update({where:{id:balance.id},data:{reservedQty:{increment:quantity}}});
    return tx.reservation.create({data:{organizationId:org,balanceId:balance.id,sourceType:body.sourceType,sourceId:body.sourceId,quantity,createdById:req.auth!.id}});
  });res.status(201).json({data});
});
reservationsRouter.delete('/:id',async(req,res)=>{
  await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${req.tenantId!} FOR UPDATE`;
    const reservation=await tx.reservation.findFirst({where:{id:String(req.params.id),organizationId:req.tenantId!}});
    if(!reservation)throw new StockError('NOT_FOUND','Reservation not found',404);
    const balance=await tx.inventoryBalance.findUniqueOrThrow({where:{id:reservation.balanceId}});
    await tx.$queryRaw`SELECT id FROM "Bin" WHERE id=${balance.binId} FOR UPDATE`;
    await tx.inventoryBalance.update({where:{id:balance.id},data:{reservedQty:{decrement:reservation.quantity}}});
    await tx.reservation.update({where:{id:reservation.id},data:{quantity:0}});
  });res.status(204).end();
});
