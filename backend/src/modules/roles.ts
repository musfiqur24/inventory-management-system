import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { prisma } from '../prisma.js';
import { requirePermission } from './rbac.js';

export const rolesRouter=Router();
rolesRouter.use(requirePermission('roles.manage'));
const roleBody=z.object({name:z.string().trim().min(2).max(100),description:z.string().trim().max(500).default(''),permissionIds:z.array(z.string().uuid()).max(300)});
const include={permissions:{include:{permission:true}}} as const;
async function validatePermissions(req:Express.Request,ids:string[]){
 const permissions=await prisma.permission.findMany({where:{id:{in:ids}}});
 if(permissions.length!==new Set(ids).size)return 'Unknown permissions';
 const keys=new Set(permissions.map(p=>p.key));
 if(permissions.some(p=>p.action==='write'&&!keys.has(p.moduleCode+'.'+p.resource+'.read')))return 'Write permission requires read permission for the same area';
 if(!req.auth!.isSuperAdmin){
  const own=req.auth!.organizations.find(o=>o.id===req.tenantId)?.permissions??[];
  if(permissions.some(p=>!own.includes(p.key)||p.key==='organizations.manage'))return 'You cannot grant permissions you do not have';
 }
 return null;
}
rolesRouter.get('/',async(req,res)=>res.json({data:await prisma.role.findMany({where:req.auth!.isSuperAdmin?{}:{OR:[{organizationId:null},{organizationId:req.tenantId}]},include,orderBy:{name:'asc'}})}));
rolesRouter.get('/permissions',async(_req,res)=>res.json({data:await prisma.permission.findMany({where:{OR:[{moduleCode:{not:null}},{key:{in:['users.manage','roles.manage','organizations.manage']}}]},orderBy:[{moduleCode:'asc'},{resource:'asc'},{action:'asc'}]})}));
rolesRouter.post('/permissions',async(req,res)=>{
 if(!req.auth!.isSuperAdmin)return res.status(403).json({error:{message:'Only Super Admin can extend the permission catalog'}});
 const body=z.object({moduleCode:z.string().min(1),resource:z.string().regex(/^[a-z][a-z0-9_]*$/).max(50),name:z.string().trim().min(2).max(100)}).parse(req.body);
 if(!await prisma.businessModule.findFirst({where:{code:body.moduleCode,isActive:true}}))return res.status(422).json({error:{message:'Unknown module'}});
 const data=await prisma.$transaction(['read','write'].map(action=>prisma.permission.create({data:{...body,action,key:body.moduleCode+'.'+body.resource+'.'+action}})));
 res.status(201).json({data});
});
rolesRouter.post('/',async(req,res)=>{
 const body=roleBody.parse(req.body);const error=await validatePermissions(req,body.permissionIds);if(error)return res.status(422).json({error:{message:error}});
 const data=await prisma.role.create({data:{code:'CUSTOM_'+randomUUID().replaceAll('-',''),name:body.name,description:body.description,organizationId:req.tenantId!,permissions:{create:[...new Set(body.permissionIds)].map(permissionId=>({permissionId}))}},include});res.status(201).json({data});
});
rolesRouter.put('/:id',async(req,res)=>{
 const body=roleBody.parse(req.body);const role=await prisma.role.findUnique({where:{id:String(req.params.id)}});
 if(!role)return res.status(404).json({error:{message:'Role not found'}});
 if(role.code==='SUPER_ADMIN')return res.status(403).json({error:{message:'The Super Admin role is protected'}});
 if(!req.auth!.isSuperAdmin&&(role.isSystem||role.organizationId!==req.tenantId))return res.status(403).json({error:{message:'You may only edit custom roles in this organization'}});
 if(req.auth!.organizations.some(o=>o.role.id===role.id))return res.status(409).json({error:{message:'You cannot change permissions on your own role'}});
 const error=await validatePermissions(req,body.permissionIds);if(error)return res.status(422).json({error:{message:error}});
 const data=await prisma.$transaction(async tx=>{await tx.rolePermission.deleteMany({where:{roleId:role.id}});return tx.role.update({where:{id:role.id},data:{name:body.name,description:body.description,permissions:{create:[...new Set(body.permissionIds)].map(permissionId=>({permissionId}))}},include});});res.json({data});
});
export async function canAssignRole(req:Express.Request,roleId:string,organizationIds:string[]){
 const role=await prisma.role.findUnique({where:{id:roleId},include});
 if(!role)return 'Role not found';
 if(role.organizationId&&organizationIds.some(id=>id!==role.organizationId))return 'This role belongs to another organization';
 if(!req.auth!.isSuperAdmin){
  if(['SUPER_ADMIN','ADMIN'].includes(role.code))return 'Only Super Admin can assign Admin roles';
  if(organizationIds.some(id=>role.permissions.some(p=>!req.auth!.organizations.find(o=>o.id===id)?.permissions.includes(p.permission.key))))return 'You cannot assign permissions you do not have';
 }
 return null;
}
