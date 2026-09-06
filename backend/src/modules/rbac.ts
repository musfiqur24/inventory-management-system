import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma.js";
import { env } from "../config.js";

export const PERMISSIONS = ["departments.read","departments.write","users.manage","roles.manage","organizations.manage"] as const;
export type AppUser = { id: string; email: string; fullName: string; permissions: string[]; isSuperAdmin: boolean; organizations: Array<{ id:string; name:string; code:string; role:{id:string;code:string;name:string} }> };

declare global { namespace Express { interface Request { auth?: AppUser; } } }

const rolePermissions: Record<string,string[]> = {
  SUPER_ADMIN: [...PERMISSIONS],
  ADMIN: ["departments.read","departments.write","users.manage"],
  MANAGER: ["departments.read","departments.write"],
  STOREKEEPER: ["departments.read","departments.write"],
  PRODUCTION_MANAGER: ["departments.read","departments.write"],
  STAFF: ["departments.read"],
};

export async function bootstrapRbac() {
  const permissions = await Promise.all(PERMISSIONS.map((key) => prisma.permission.upsert({ where:{key}, update:{}, create:{key,name:key.replace("."," "),description:"System permission"} })));
  for (const [code, keys] of Object.entries(rolePermissions)) {
    const role = await prisma.role.upsert({ where:{code}, update:{}, create:{code,name:code.split("_").map(x=>x[0]+x.slice(1).toLowerCase()).join(" "),isSystem:true} });
    await prisma.rolePermission.deleteMany({where:{roleId:role.id}});
    await prisma.rolePermission.createMany({data:permissions.filter(p=>keys.includes(p.key)).map(p=>({roleId:role.id,permissionId:p.id})),skipDuplicates:true});
  }
  const email = process.env.INITIAL_SUPER_ADMIN_EMAIL;
  const password = process.env.INITIAL_SUPER_ADMIN_PASSWORD;
  if (email && password && password.length >= 8) {
    const user = await prisma.user.upsert({where:{email},update:{},create:{email,fullName:"System Super Admin",passwordHash:await bcrypt.hash(password,12)}});
    const role = await prisma.role.findUniqueOrThrow({where:{code:"SUPER_ADMIN"}});
    let organizations = await prisma.organization.findMany();
    if (!organizations.length) organizations = [await prisma.organization.create({data:{code:"DEFAULT",name:process.env.INITIAL_ORGANIZATION_NAME ?? "FeedTrack Workspace"}})];
    for(const organization of organizations) await prisma.organizationMember.upsert({where:{userId_organizationId:{userId:user.id,organizationId:organization.id}},update:{roleId:role.id,isActive:true},create:{userId:user.id,organizationId:organization.id,roleId:role.id}});
  }
}

export async function getAppUser(userId:string):Promise<AppUser|null> {
  const user=await prisma.user.findUnique({where:{id:userId},include:{memberships:{where:{isActive:true},include:{organization:true,role:{include:{permissions:{include:{permission:true}}}},overrides:{include:{permission:true}}}}}});
  if(!user||!user.isActive)return null;
  const permissions=new Set<string>();
  let isSuperAdmin=false;
  for(const m of user.memberships){ if(m.role.code==="SUPER_ADMIN")isSuperAdmin=true; m.role.permissions.forEach(x=>permissions.add(x.permission.key));m.overrides.forEach(x=>x.granted?permissions.add(x.permission.key):permissions.delete(x.permission.key));}
  return {id:user.id,email:user.email,fullName:user.fullName,permissions:[...permissions],isSuperAdmin,organizations:user.memberships.map(m=>({id:m.organization.id,name:m.organization.name,code:m.organization.code,role:{id:m.role.id,code:m.role.code,name:m.role.name}}))};
}
export function signAccessToken(user:AppUser){return jwt.sign({sub:user.id},env.JWT_SECRET,{expiresIn:"15m"});}
export const authenticate:RequestHandler=async(req,res,next)=>{const token=req.header("authorization")?.replace(/^Bearer\s+/i,"");if(!token)return res.status(401).json({error:{message:"Authentication required"}});try{const payload=jwt.verify(token,env.JWT_SECRET) as jwt.JwtPayload;const user=payload.sub?await getAppUser(String(payload.sub)):null;if(!user)return res.status(401).json({error:{message:"Session is no longer valid"}});req.auth=user;next();}catch{return res.status(401).json({error:{message:"Invalid or expired token"}});}};
export const requirePermission=(permission:string):RequestHandler=>(req,res,next)=>req.auth?.permissions.includes(permission)?next():res.status(403).json({error:{message:"You do not have permission for this action"}});
export const tenant:RequestHandler=(req,res,next)=>{const id=req.header("x-organization-id");if(!id)return res.status(400).json({error:{message:"x-organization-id header is required"}});if(!req.auth?.isSuperAdmin&&!req.auth?.organizations.some(o=>o.id===id))return res.status(403).json({error:{message:"You are not assigned to this organization"}});req.tenantId=id;next();};
