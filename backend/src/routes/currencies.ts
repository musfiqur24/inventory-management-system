import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
export const currenciesRouter=Router();
const schema=z.object({code:z.string().trim().min(3).max(3),name:z.string().trim().min(2),symbol:z.string().trim().min(1).max(8),decimalPlaces:z.coerce.number().int().min(0).max(4).default(2)});
currenciesRouter.get("/",async(req,res)=>res.json({data:await prisma.currency.findMany({where:{organizationId:req.tenantId!,isActive:true},orderBy:{code:"asc"}})}));
currenciesRouter.post("/",async(req,res)=>{const x=schema.parse(req.body);const data=await prisma.currency.create({data:{...x,code:x.code.toUpperCase(),organizationId:req.tenantId!}});res.status(201).json({data})});
currenciesRouter.put("/:id",async(req,res)=>{const x=schema.parse(req.body),old=await prisma.currency.findFirst({where:{id:String(req.params.id),organizationId:req.tenantId!,isActive:true}});if(!old)return res.status(404).json({error:{code:"NOT_FOUND",message:"Currency not found."}});const data=await prisma.currency.update({where:{id:old.id},data:{...x,code:x.code.toUpperCase()}});res.json({data})});
currenciesRouter.delete("/:id",async(req,res)=>{const id=String(req.params.id),organizationId=req.tenantId!,old=await prisma.currency.findFirst({where:{id,organizationId,isActive:true}});if(!old)return res.status(404).json({error:{code:"NOT_FOUND",message:"Currency not found."}});if(await prisma.product.count({where:{organizationId,currencyId:id,isActive:true}}))return res.status(409).json({error:{code:"IN_USE",message:"Currency is assigned to active products and cannot be deleted."}});await prisma.currency.update({where:{id},data:{isActive:false}});res.status(204).send()});
