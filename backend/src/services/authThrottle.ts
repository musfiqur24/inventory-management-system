import type { RequestHandler } from 'express';
import { createHash } from 'node:crypto';
import { prisma } from '../prisma.js';
/** Shared PostgreSQL-backed limits survive restarts and apply across replicas. */
export const authThrottle: RequestHandler = async(req,res,next)=>{
  if(req.method!=='POST')return next();
  const period=15*60*1000, window=Math.floor(Date.now()/period);
  const ip=req.ip??'unknown';
  const buckets=[{id:`ip:${ip}:${req.path}`,limit:req.path==='/login'?30:60}];
  if(req.path==='/login'&&typeof req.body?.email==='string')buckets.push({id:'account:'+req.body.email.trim().toLowerCase(),limit:60});
  for(const bucket of buckets){
    const key=createHash('sha256').update(bucket.id).digest('hex')+':'+window;
    const count=await prisma.authThrottle.upsert({where:{key},create:{key,expiresAt:new Date((window+1)*period)},update:{count:{increment:1}}});
    if(count.count>bucket.limit){res.setHeader('Retry-After',Math.ceil(((window+1)*period-Date.now())/1000));return res.status(429).json({error:{code:'RATE_LIMITED',message:'Too many attempts. Try again later.'}});}
  }
  next();
};
