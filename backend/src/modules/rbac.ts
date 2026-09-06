import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma.js";
import { env } from "../config.js";

export const PERMISSIONS = ["departments.read", "departments.write", "users.manage", "roles.manage", "organizations.manage"] as const;
type AppOrganization = { id:string; name:string; code:string; permissions:string[]; role:{id:string;code:string;name:string} };
export type AppUser = { id:string; email:string; fullName:string; avatarUrl:string|null; phone:string|null; presentAddress:string|null; permanentAddress:string|null; permissions:string[]; isSuperAdmin:boolean; organizations:AppOrganization[] };

declare global { namespace Express { interface Request { auth?:AppUser; tenantId?:string } } }

const rolePermissions:Record<string,string[]>={
  SUPER_ADMIN:[...PERMISSIONS],
  ADMIN:["departments.read","departments.write","users.manage"],
  MANAGER:["departments.read","departments.write"],
  STOREKEEPER:["departments.read","departments.write"],
  PRODUCTION_MANAGER:["departments.read","departments.write"],
  STAFF:["departments.read"],
};

export async function bootstrapRbac(){
  const permissions=await Promise.all(PERMISSIONS.map(key=>prisma.permission.upsert({where:{key},update:{},create:{key,name:key.replace("."," "),description:"System permission"}})));
  for(const [code,keys] of Object.entries(rolePermissions)){
    const role=await prisma.role.upsert({where:{code},update:{},create:{code,name:code.split("_").map(value=>value[0]+value.slice(1).toLowerCase()).join(" "),isSystem:true}});
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({where:{roleId:role.id}}),
      prisma.rolePermission.createMany({data:permissions.filter(permission=>keys.includes(permission.key)).map(permission=>({roleId:role.id,permissionId:permission.id})),skipDuplicates:true}),
    ]);
  }
  const email=process.env.INITIAL_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password=process.env.INITIAL_SUPER_ADMIN_PASSWORD;
  if(!email||!password||password.length<6)return;
  const user=await prisma.user.upsert({where:{email},update:{},create:{email,fullName:"System Super Admin",passwordHash:await bcrypt.hash(password,12)}});
  const role=await prisma.role.findUniqueOrThrow({where:{code:"SUPER_ADMIN"}});
  let organizations=await prisma.organization.findMany({where:{isActive:true}});
  if(!organizations.length)organizations=[await prisma.organization.create({data:{code:"DEFAULT",name:process.env.INITIAL_ORGANIZATION_NAME??"FeedTrack Workspace"}})];
  await prisma.organizationMember.createMany({data:organizations.map(organization=>({userId:user.id,organizationId:organization.id,roleId:role.id})),skipDuplicates:true});
}

export async function getAppUser(userId:string):Promise<AppUser|null>{
  const user=await prisma.user.findUnique({where:{id:userId},include:{memberships:{where:{isActive:true,organization:{isActive:true}},include:{organization:true,role:{include:{permissions:{include:{permission:true}}}},overrides:{include:{permission:true}}}}}});
  if(!user?.isActive)return null;
  let isSuperAdmin=false;
  const permissions=new Set<string>();
  const organizations=user.memberships.map(membership=>{
    const membershipPermissions=new Set(membership.role.permissions.map(item=>item.permission.key));
    for(const override of membership.overrides)override.granted?membershipPermissions.add(override.permission.key):membershipPermissions.delete(override.permission.key);
    membershipPermissions.forEach(permission=>permissions.add(permission));
    if(membership.role.code==="SUPER_ADMIN")isSuperAdmin=true;
    return {id:membership.organization.id,name:membership.organization.name,code:membership.organization.code,permissions:[...membershipPermissions],role:{id:membership.role.id,code:membership.role.code,name:membership.role.name}};
  });
  return {id:user.id,email:user.email,fullName:user.fullName,avatarUrl:user.avatarUrl,phone:user.phone,presentAddress:user.presentAddress,permanentAddress:user.permanentAddress,permissions:[...permissions],isSuperAdmin,organizations};
}

export function signAccessToken(user:AppUser){return jwt.sign({sub:user.id},env.JWT_SECRET,{expiresIn:env.ACCESS_TOKEN_TTL as jwt.SignOptions["expiresIn"]});}

export const authenticate:RequestHandler=async(req,res,next)=>{
  const token=req.header("authorization")?.replace(/^Bearer\s+/i,"");
  if(!token)return res.status(401).json({error:{code:"AUTHENTICATION_REQUIRED",message:"Authentication required"}});
  try{
    const payload=jwt.verify(token,env.JWT_SECRET) as jwt.JwtPayload;
    const user=payload.sub?await getAppUser(String(payload.sub)):null;
    if(!user)return res.status(401).json({error:{code:"INVALID_SESSION",message:"Session is no longer valid"}});
    req.auth=user;
    return next();
  }catch{return res.status(401).json({error:{code:"INVALID_TOKEN",message:"Invalid or expired token"}});}
};

export const tenant:RequestHandler=async(req,res,next)=>{
  const organizationId=req.header("x-organization-id");
  if(!organizationId)return res.status(400).json({error:{code:"ORGANIZATION_REQUIRED",message:"Select an organization first"}});
  const assigned=req.auth?.organizations.some(organization=>organization.id===organizationId);
  if(!assigned&&!req.auth?.isSuperAdmin)return res.status(403).json({error:{code:"ORGANIZATION_FORBIDDEN",message:"You are not assigned to this organization"}});
  if(!assigned){
    const organization=await prisma.organization.findFirst({where:{id:organizationId,isActive:true},select:{id:true}});
    if(!organization)return res.status(404).json({error:{code:"ORGANIZATION_NOT_FOUND",message:"Organization not found"}});
  }
  req.tenantId=organizationId;
  return next();
};

export const requirePermission=(permission:string):RequestHandler=>(req,res,next)=>{
  if(req.auth?.isSuperAdmin)return next();
  const allowed=req.tenantId?req.auth?.organizations.find(organization=>organization.id===req.tenantId)?.permissions.includes(permission):req.auth?.permissions.includes(permission);
  return allowed?next():res.status(403).json({error:{code:"FORBIDDEN",message:"You do not have permission for this action"}});
};
