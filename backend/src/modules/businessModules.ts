import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requirePermission } from "./rbac.js";

export const modulesRouter=Router();
modulesRouter.get("/",async(_req,res)=>res.json({data:await prisma.businessModule.findMany({where:{isActive:true},orderBy:{sortOrder:"asc"}})}));
export const moduleReportsRouter=Router({mergeParams:true});
moduleReportsRouter.use(async(req,res,next)=>{
  const code=String((req.params as Record<string,string>).moduleCode);
  if(!await prisma.businessModule.findFirst({where:{code,isActive:true}}))return res.status(404).json({error:{message:"Module not found"}});
  return requirePermission(code+'.reports.'+(['GET','HEAD','OPTIONS'].includes(req.method)?'read':'write'))(req,res,next);
});
moduleReportsRouter.get("/",async(req,res)=>res.json({data:await prisma.moduleReport.findMany({where:{organizationId:req.tenantId!,moduleCode:String((req.params as Record<string,string>).moduleCode)},orderBy:{reportingDate:"desc"},take:100})}));
moduleReportsRouter.post("/",async(req,res)=>{
  const body=z.object({title:z.string().trim().min(1).max(200),reportingDate:z.iso.datetime(),metrics:z.record(z.string().min(1).max(100),z.number().finite()).refine(m=>Object.keys(m).length<=100,"Maximum 100 metrics")}).parse(req.body);
  const report=await prisma.moduleReport.create({data:{...body,reportingDate:new Date(body.reportingDate),organizationId:req.tenantId!,moduleCode:String((req.params as Record<string,string>).moduleCode)}});
  res.status(201).json({data:report});
});
