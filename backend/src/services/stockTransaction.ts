import { createHash } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../prisma.js';
import { StockError } from './stock.js';
/** Result caching and postings commit together; tenant lock sets a common lock order. */
export async function stockTransaction<T>(organizationId:string,key:string,payload:unknown,work:(tx:Prisma.TransactionClient)=>Promise<T>, options={timeout:20000}):Promise<T>{
  const payloadHash=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  return prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${organizationId} FOR UPDATE`;
    const where={organizationId_key:{organizationId,key}};
    const existing=await tx.idempotencyRequest.findUnique({where});
    if(existing){
      if(existing.payloadHash!==payloadHash)throw new StockError('IDEMPOTENCY_CONFLICT','This request key was already used with different values. Start a new operation.');
      if(existing.result!==null){
        const cached=existing.result as {completed?:boolean;value?:unknown};
        return (cached.completed ? cached.value : existing.result) as T;
      }
    }else await tx.idempotencyRequest.create({data:{organizationId,key,payloadHash}});
    const result=await work(tx);
    await tx.idempotencyRequest.update({where,data:{result:JSON.parse(JSON.stringify({completed:true,value:result??null})) as Prisma.InputJsonValue}});
    return result;
  },options);
}
