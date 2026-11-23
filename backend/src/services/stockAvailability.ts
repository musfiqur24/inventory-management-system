import {prisma} from '../prisma.js';
import {Prisma} from '../generated/prisma/client.js';
export async function addStockAvailability<T extends {id:string;quantity:Prisma.Decimal;reservedQty:Prisma.Decimal;lot:{qualityStatus:string;expiryDate:Date|null}}>(organizationId:string,balances:T[]){
 const reservations=balances.length?await prisma.reservation.findMany({where:{organizationId,balanceId:{in:balances.map(b=>b.id)},quantity:{gt:0}},select:{balanceId:true,sourceId:true,quantity:true}}):[];
 const grouped=new Map<string,Array<{sourceId:string;quantity:Prisma.Decimal}>>();
 for(const {balanceId,sourceId,quantity} of reservations){const rows=grouped.get(balanceId)??[];rows.push({sourceId,quantity});grouped.set(balanceId,rows);}
 return balances.map(balance=>({...balance,availableQty:balance.lot.qualityStatus==='RELEASED'&&(!balance.lot.expiryDate||balance.lot.expiryDate>=new Date())?balance.quantity.minus(balance.reservedQty):new Prisma.Decimal(0),reservations:grouped.get(balance.id)??[]}));
}
