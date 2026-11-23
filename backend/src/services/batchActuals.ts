import { Prisma } from '../generated/prisma/client.js';
import { StockError } from './stock.js';
/** Inputs are reported in each product's base UOM; outputs in the order UOM. */
export async function validateBatchActuals(tx:Prisma.TransactionClient, organizationId:string, anchorOrderId:string, inputs:Array<{productId?:string|null;category:string;quantity:number}>, outputs:Array<{productId?:string|null;quantity:number}>) {
  const anchor=await tx.productionOrder.findFirstOrThrow({where:{id:anchorOrderId,organizationId}});
  const orders=await tx.productionOrder.findMany({where:anchor.requisitionId?{organizationId,requisitionId:anchor.requisitionId,status:{notIn:["REJECTED","CANCELLED"]}}:{organizationId,id:anchor.id},include:{lines:true},orderBy:{id:'asc'}});
  for(const order of orders){
    await tx.$queryRaw`SELECT id FROM "ProductionOrder" WHERE id=${order.id} FOR UPDATE`;
    const current=await tx.productionOrder.findUniqueOrThrow({where:{id:order.id}});
    if(current.status!=='IN_PRODUCTION')throw new StockError('INVALID_STATUS','Materials must be issued before production can be submitted.');
  }
  const products=await tx.product.findMany({where:{organizationId,isActive:true},include:{baseUom:true}});
  const units=await tx.unitOfMeasure.findMany({where:{organizationId}});
  const issued=new Map<string,Prisma.Decimal>();
  for(const line of orders.flatMap(o=>o.lines)){
    const product=products.find(p=>p.id===line.productId),unit=units.find(u=>u.id===line.uomId);
    if(!product||!unit||unit.dimension!==product.baseUom.dimension)throw new StockError('INVALID_REFERENCE','Production references an unavailable product or unit.',422);
    const qty=line.issuedQty.mul(unit.factorToBase).div(product.baseUom.factorToBase);
    issued.set(line.productId,(issued.get(line.productId)??new Prisma.Decimal(0)).plus(qty));
    if(line.issuedQty.lt(line.wasteAdjustedQty))throw new StockError('MATERIALS_INCOMPLETE','Issue all required materials before submitting production actuals.');
  }
  const reported=new Map<string,Prisma.Decimal>();let inputWeight=new Prisma.Decimal(0), outputWeight=new Prisma.Decimal(0);
  for(const line of inputs){
    if(!line.productId){if(line.category==='RAW_MATERIAL'||line.category==='PACKAGING')throw new StockError('INPUT_REQUIRED','Stock inputs must reference products.',422);continue;}
    const product=products.find(p=>p.id===line.productId);
    if(!product||!issued.has(product.id))throw new StockError('UNISSUED_INPUT','Every stock input must have been issued to this production requisition.',422);
    if((line.category==='RAW_MATERIAL')!==(product.type==='RAW_MATERIAL'))throw new StockError('INPUT_CATEGORY','Input category does not match the product.',422);
    reported.set(product.id,(reported.get(product.id)??new Prisma.Decimal(0)).plus(line.quantity));
    if(product.type==='RAW_MATERIAL'){
      if(product.baseUom.dimension!=='WEIGHT')throw new StockError('MASS_UNIT_REQUIRED','Raw-material production actuals require weight units.',422);
      inputWeight=inputWeight.plus(new Prisma.Decimal(line.quantity).mul(product.baseUom.factorToBase));
    }
  }
  for(const [id,qty]of issued)if(!qty.toDecimalPlaces(3).eq((reported.get(id)??new Prisma.Decimal(0)).toDecimalPlaces(3)))throw new StockError('CONSUMPTION_MISMATCH','Reported stock inputs must match issued quantities. Record material returns before reducing consumption.',422);
  const seen=new Set<string>();
  for(const line of outputs){
    if(!line.productId||seen.has(line.productId)||line.quantity<=0)throw new StockError('INVALID_OUTPUT','Each output must have a unique product and positive quantity.',422);seen.add(line.productId);
    const product=products.find(p=>p.id===line.productId),order=orders.find(o=>o.finishedProductId===line.productId);
    if(!product||(!order&&product.type!=='BY_PRODUCT'))throw new StockError('INVALID_OUTPUT','Outputs must match the ordered finished goods or a registered by-product.',422);
    const unit=order?units.find(u=>u.id===order.plannedUomId):product.baseUom;
    if(!unit||unit.dimension!=='WEIGHT')throw new StockError('MASS_UNIT_REQUIRED','Production output requires weight units.',422);
    outputWeight=outputWeight.plus(new Prisma.Decimal(line.quantity).mul(unit.factorToBase));
  }
  if(orders.some(order=>!seen.has(order.finishedProductId)))throw new StockError('OUTPUT_MISSING','Report every ordered finished product.',422);
  if(inputWeight.lte(0)||outputWeight.gt(inputWeight))throw new StockError('MASS_BALANCE','Output cannot exceed issued raw-material weight. Use an approved correction for exceptional gains.',422);
  return {rawQty:inputWeight.toNumber(),outputQty:outputWeight.toNumber()};
}
