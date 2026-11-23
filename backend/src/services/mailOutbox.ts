import { prisma } from '../prisma.js';
import { decryptSecret } from './mfa.js';
import { sendPasswordResetEmail } from './passwordResetEmail.js';
export async function processMailOutbox(onError:(error:unknown,id:string)=>void=()=>{},send=sendPasswordResetEmail){
 const now=new Date();
 await prisma.mailOutbox.updateMany({where:{status:'SENDING',updatedAt:{lt:new Date(Date.now()-300000)}},data:{status:'PENDING'}});
 await prisma.mailOutbox.updateMany({where:{status:{in:['PENDING','SENDING','FAILED','CANCELLED']},expiresAt:{lte:now}},data:{status:'EXPIRED',tokenCipher:''}});
 const jobs=await prisma.mailOutbox.findMany({where:{status:'PENDING',nextAttemptAt:{lte:now},expiresAt:{gt:now}},orderBy:{createdAt:'asc'},take:10});
 for(const job of jobs){
  const claim=await prisma.mailOutbox.updateMany({where:{id:job.id,status:'PENDING'},data:{status:'SENDING',attempts:{increment:1}}});if(!claim.count)continue;
  try{await send(job.email,decryptSecret(job.tokenCipher));await prisma.mailOutbox.update({where:{id:job.id},data:{status:'SENT',tokenCipher:''}});}
  catch(error){onError(error,job.id);const terminal=job.attempts>=4;await prisma.mailOutbox.update({where:{id:job.id},data:{status:terminal?'FAILED':'PENDING',nextAttemptAt:new Date(Date.now()+Math.min(300000,30000*2**job.attempts))}});}
 }
}
