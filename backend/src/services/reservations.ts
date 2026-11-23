import { Prisma } from '../generated/prisma/client.js';
export async function releaseOrderReservations(tx:Prisma.TransactionClient,organizationId:string,sourceId:string){
 const reservations=await tx.reservation.findMany({where:{organizationId,sourceId,quantity:{gt:0}},orderBy:{balanceId:'asc'}});
 for(const reservation of reservations){const balance=await tx.inventoryBalance.findUniqueOrThrow({where:{id:reservation.balanceId}});await tx.$queryRaw`SELECT id FROM "Bin" WHERE id=${balance.binId} FOR UPDATE`;await tx.inventoryBalance.update({where:{id:balance.id},data:{reservedQty:{decrement:reservation.quantity}}});await tx.reservation.update({where:{id:reservation.id},data:{quantity:0}});}
}
