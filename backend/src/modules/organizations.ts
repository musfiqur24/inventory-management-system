import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { authenticate, requirePermission } from "./rbac.js";

export const organizationsRouter=Router();
organizationsRouter.use(authenticate,requirePermission("organizations.manage"));
organizationsRouter.get("/",async(_req,res)=>res.json({data:await prisma.organization.findMany({orderBy:{name:"asc"}})}));
organizationsRouter.post("/",async(req,res)=>{
  const body=z.object({code:z.string().trim().min(2).max(30),name:z.string().trim().min(2).max(120),adminUserId:z.string().uuid().optional()}).parse(req.body);
  const code=body.code.toUpperCase();
  if(await prisma.organization.findUnique({where:{code}}))return res.status(409).json({error:{code:"ORGANIZATION_CODE_IN_USE",message:"An organization with this code already exists"}});
  if(body.adminUserId&&!await prisma.user.findUnique({where:{id:body.adminUserId}}))return res.status(400).json({error:{code:"ADMIN_NOT_FOUND",message:"Admin user not found"}});
  const [superRole,adminRole]=await Promise.all([prisma.role.findUniqueOrThrow({where:{code:"SUPER_ADMIN"}}),body.adminUserId?prisma.role.findUniqueOrThrow({where:{code:"ADMIN"}}):null]);
  const organization=await prisma.$transaction(async tx=>{
    const created=await tx.organization.create({data:{code,name:body.name}});
    await tx.organizationMember.create({data:{userId:req.auth!.id,organizationId:created.id,roleId:superRole.id}});
    if(body.adminUserId&&body.adminUserId!==req.auth!.id)await tx.organizationMember.create({data:{userId:body.adminUserId,organizationId:created.id,roleId:adminRole!.id}});
    return created;
  });
  return res.status(201).json({data:organization});
});
