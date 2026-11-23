import type { RequestHandler } from 'express';
import { prisma } from '../prisma.js';
/** Write an intent before mutation; never record credentials, tokens, attachments. */
export const auditMutation:RequestHandler=async(req,res,next)=>{
  if(!['POST','PUT','PATCH','DELETE'].includes(req.method)||!req.auth)return next();
  const details={requestId:String(req.id??''),roleId:typeof req.body?.roleId==='string'?req.body.roleId:null,isActive:typeof req.body?.isActive==='boolean'?req.body.isActive:null,status:'attempted'};
  const event=await prisma.auditEvent.create({data:{organizationId:req.tenantId,actorId:req.auth.id,action:req.method+' '+req.originalUrl.split('?')[0],resourceId:typeof req.params.id==='string'?req.params.id:null,details}});
  res.once('finish',()=>{void prisma.auditEvent.update({where:{id:event.id},data:{details:{...details,status:res.statusCode}}}).catch(error=>req.log.error({err:error,auditEventId:event.id},'Audit completion failed'));});
  next();
};
