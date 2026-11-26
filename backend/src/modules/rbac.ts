import { AREA_PERMISSIONS } from "./permissionCatalog.js";
import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma.js";
import { env } from "../config.js";

export const PERMISSIONS = ["departments.read", "departments.write", "weighbridge.submit", "users.manage", "roles.manage", "organizations.manage"] as const;
export type ModuleAccess = { code:string; name:string; canRead:boolean; canWrite:boolean };
type AppOrganization = { modules:ModuleAccess[]; id:string; name:string; code:string; permissions:string[]; role:{id:string;code:string;name:string} };
export type AppUser = { mfaEnabled:boolean; sessionVersion:number; id:string; email:string; fullName:string; avatarUrl:string|null; phone:string|null; presentAddress:string|null; permanentAddress:string|null; permissions:string[]; isSuperAdmin:boolean; organizations:AppOrganization[] };

declare global { namespace Express { interface Request { auth?:AppUser; tenantId?:string } } }

const rolePermissions:Record<string,string[]>={
  SUPER_ADMIN:[...PERMISSIONS],
  ADMIN:["departments.read","departments.write","weighbridge.submit","users.manage","roles.manage"],
  MANAGER:["departments.read","departments.write","weighbridge.submit"],
  STOREKEEPER:["departments.read","departments.write","weighbridge.submit"],
  PRODUCTION_MANAGER:["departments.read","departments.write","weighbridge.submit"],
  STAFF:["departments.read","weighbridge.submit"],
};

export async function bootstrapRbac(){
  for (const [code,name,sortOrder] of [["feed","Feed",0],["agro","Agro",1]] as const)
    await prisma.businessModule.upsert({where:{code},update:{},create:{code,name,sortOrder}});

  for(const permission of AREA_PERMISSIONS)await prisma.permission.upsert({where:{key:permission.key},update:{},create:permission});
  const permissions=await Promise.all(PERMISSIONS.map(key=>prisma.permission.upsert({where:{key},update:{},create:{key,name:key.replace("."," "),description:"System permission"}})));
  const existingRoles=new Set((await prisma.role.findMany({select:{code:true}})).map(r=>r.code));
  for(const [code,keys] of Object.entries(rolePermissions)){
    await prisma.role.upsert({where:{code},update:{},create:{code,name:code.split("_").map(value=>value[0]+value.slice(1).toLowerCase()).join(" "),isSystem:true,permissions:{create:permissions.filter(permission=>keys.includes(permission.key)).map(permission=>({permissionId:permission.id}))}}});
  }
  // Populate defaults only for newly bootstrapped roles; edits to existing roles are never reset.
  for(const [code,keys] of Object.entries(rolePermissions)){
    const role=await prisma.role.findUniqueOrThrow({where:{code}});
    if(!existingRoles.has(code)){
      const defaults=AREA_PERMISSIONS.filter(p=>code==='SUPER_ADMIN'||(p.moduleCode==='feed'&&(p.action==='read'||(p.action==='write'&&(p.resource==='sales_approval'?['ADMIN','MANAGER'].includes(code):['recipes','partners'].includes(p.resource)?code==='MANAGER':keys.includes('departments.write')||(['procurement','weighbridge'].includes(p.resource)&&code==='STAFF'))))));
      await prisma.rolePermission.createMany({data:(await prisma.permission.findMany({where:{key:{in:defaults.map(p=>p.key)}}})).map(p=>({roleId:role.id,permissionId:p.id})),skipDuplicates:true});
    }
  }
  if(await prisma.user.count())return;
  const email=process.env.INITIAL_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password=process.env.INITIAL_SUPER_ADMIN_PASSWORD;
  if(!email||!password||password.length<6)throw new Error("Initial administrator credentials are required on an empty database");
  if(env.SESSION_COOKIE_SECURE&&(password.length<12||password.length>72||Buffer.byteLength(password,'utf8')>72))throw new Error("Initial production administrator password must contain 12 to 72 characters and at most 72 UTF-8 bytes");
  const passwordHash=await bcrypt.hash(password,12);
  await prisma.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(831142,2)`;
    if(await tx.user.count())return;
    const user=await tx.user.create({data:{email,fullName:"System Super Admin",passwordHash}});
    const role=await tx.role.findUniqueOrThrow({where:{code:"SUPER_ADMIN"}});
    let organizations=await tx.organization.findMany({where:{isActive:true}});
    if(!organizations.length)organizations=[await tx.organization.create({data:{code:"DEFAULT",name:process.env.INITIAL_ORGANIZATION_NAME??"FeedTrack Workspace"}})];
    await tx.organizationMember.createMany({data:organizations.map(organization=>({userId:user.id,organizationId:organization.id,roleId:role.id})),skipDuplicates:true});
    await tx.auditEvent.create({data:{actorId:user.id,action:'INITIAL_ADMIN_ENROLLMENT',details:{status:'completed'}}});
  });
}

export async function getAppUser(userId:string):Promise<AppUser|null>{
  const user=await prisma.user.findUnique({where:{id:userId},include:{memberships:{where:{isActive:true,organization:{isActive:true}},include:{organization:true,role:{include:{permissions:{include:{permission:true}}}}}}}});
  if(!user?.isActive)return null;
  let isSuperAdmin=false;
  const permissions=new Set<string>();
  const catalog=await prisma.businessModule.findMany({where:{isActive:true},orderBy:{sortOrder:"asc"}});
  const organizations=user.memberships.map(membership=>{
    const membershipPermissions=new Set(membership.role.permissions.map(item=>item.permission.key));
    // Effective access comes exclusively from the assigned role.
    membershipPermissions.forEach(permission=>permissions.add(permission));
    if(membership.role.code==="SUPER_ADMIN")isSuperAdmin=true;
    return {modules:membership.role.code==="SUPER_ADMIN"?catalog.map(m=>({code:m.code,name:m.name,canRead:true,canWrite:true})):catalog.map(m=>({code:m.code,name:m.name,canRead:[...membershipPermissions].some(p=>p.startsWith(m.code+".")&&p.endsWith(".read")),canWrite:[...membershipPermissions].some(p=>p.startsWith(m.code+".")&&p.endsWith(".write"))})).filter(m=>m.canRead),id:membership.organization.id,name:membership.organization.name,code:membership.organization.code,permissions:[...membershipPermissions],role:{id:membership.role.id,code:membership.role.code,name:membership.role.name}};
  });
  return {mfaEnabled:user.mfaEnabled,sessionVersion:user.sessionVersion,id:user.id,email:user.email,fullName:user.fullName,avatarUrl:user.avatarUrl,phone:user.phone,presentAddress:user.presentAddress,permanentAddress:user.permanentAddress,permissions:[...permissions],isSuperAdmin,organizations};
}

export function signAccessToken(user:AppUser){return jwt.sign({sub:user.id,ver:user.sessionVersion},env.JWT_SECRET,{expiresIn:env.ACCESS_TOKEN_TTL as jwt.SignOptions["expiresIn"]});}

export const authenticate:RequestHandler=async(req,res,next)=>{
  const token=req.header("authorization")?.replace(/^Bearer\s+/i,"");
  if(!token)return res.status(401).json({error:{code:"AUTHENTICATION_REQUIRED",message:"Authentication required"}});
  try{
    const payload=jwt.verify(token,env.JWT_SECRET) as jwt.JwtPayload;
    const user=payload.sub?await getAppUser(String(payload.sub)):null;
    if(!user||payload.ver!==user.sessionVersion)return res.status(401).json({error:{code:"INVALID_SESSION",message:"Session is no longer valid"}});
    if(env.REQUIRE_ADMIN_MFA&&!user.mfaEnabled&&!req.originalUrl.startsWith("/api/v1/auth/")&&!["GET","HEAD","OPTIONS"].includes(req.method)&&(user.isSuperAdmin||user.organizations.some(o=>o.permissions.some(p=>p.endsWith(".write")||p.endsWith(".manage")))))return res.status(403).json({error:{code:"MFA_SETUP_REQUIRED",message:"Enable two-factor authentication in My Profile before making privileged changes."}});
    req.auth=user;
    return next();
  }catch(error){if(error instanceof jwt.JsonWebTokenError)return res.status(401).json({error:{code:"INVALID_TOKEN",message:"Invalid or expired token"}});return next(error);}
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

export function hasModuleAccess(user:AppUser|undefined, organizationId:string|undefined, code:string, write=false){
  if(user?.isSuperAdmin)return true;
  const access=user?.organizations.find(o=>o.id===organizationId)?.modules.find(m=>m.code===code);
  return Boolean(access?.canRead && (!write || access.canWrite));
}
export const requireModule=(code:string):RequestHandler=>(req,res,next)=>
  hasModuleAccess(req.auth,req.tenantId,code,!["GET","HEAD","OPTIONS"].includes(req.method))
    ?next():res.status(403).json({error:{code:"MODULE_FORBIDDEN",message:"You do not have access to this module action"}});

export function hasPermission(user:AppUser|undefined,organizationId:string|undefined,key:string){
 return Boolean(user&&(user.isSuperAdmin||user.organizations.find(o=>o.id===organizationId)?.permissions.includes(key)));
}
const feedResources:Record<string,string>={
 'purchase-requisitions':'procurement',deliveries:'procurement',weighments:'weighbridge',
 'rm-store':'rm_store','fm-store':'fm_store',recipes:'recipes','production-orders':'production',
 'material-issues':'production',batches:'production','sales-orders':'sales',dispatches:'sales',
 uoms:'setup',currencies:'setup',categories:'setup',products:'setup',partners:'partners',stores:'setup',bins:'setup',
 operations:'reports',inventory:'reports',traceability:'reports',reservations:'sales',notifications:'procurement',
};
export function feedPermissionFor(path:string,method:string){
 const resource=feedResources[path.split('/').filter(Boolean)[0]];
 if(!resource)return null;
 return 'feed.'+resource+'.'+(['GET','HEAD','OPTIONS'].includes(method)?'read':'write');
}
export const authorizeFeed:RequestHandler=(req,res,next)=>{
 const permission=feedPermissionFor(req.path,req.method);
 return permission?requirePermission(permission)(req,res,next):res.status(404).json({error:{message:'Route not found'}});
};
