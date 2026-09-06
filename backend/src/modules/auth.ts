import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { env } from "../config.js";
import { authenticate, getAppUser, signAccessToken } from "./rbac.js";

export const authRouter=Router();
const hash=(value:string)=>crypto.createHash("sha256").update(value).digest("hex");
const refreshExpiry=()=>new Date(Date.now()+86400000*env.REFRESH_TOKEN_DAYS);

authRouter.post("/login",async(req,res)=>{
  const body=z.object({email:z.string().trim().email(),password:z.string().min(1)}).parse(req.body);
  const user=await prisma.user.findUnique({where:{email:body.email.toLowerCase()}});
  if(!user?.isActive||!await bcrypt.compare(body.password,user.passwordHash))return res.status(401).json({error:{code:"INVALID_CREDENTIALS",message:"Invalid email or password"}});
  const appUser=await getAppUser(user.id);
  if(!appUser?.organizations.length)return res.status(403).json({error:{code:"NO_ORGANIZATION_ACCESS",message:"No organization access is assigned to this user"}});
  const refreshToken=crypto.randomBytes(48).toString("base64url");
  await prisma.$transaction([
    prisma.refreshToken.deleteMany({where:{userId:user.id,expiresAt:{lt:new Date()}}}),
    prisma.refreshToken.create({data:{userId:user.id,tokenHash:hash(refreshToken),expiresAt:refreshExpiry()}}),
  ]);
  return res.json({data:{accessToken:signAccessToken(appUser),refreshToken,user:appUser}});
});

authRouter.post("/refresh",async(req,res)=>{
  const body=z.object({refreshToken:z.string().min(1)}).parse(req.body);
  const token=await prisma.refreshToken.findUnique({where:{tokenHash:hash(body.refreshToken)}});
  if(!token||token.expiresAt<new Date()){if(token)await prisma.refreshToken.delete({where:{id:token.id}});return res.status(401).json({error:{code:"REFRESH_TOKEN_EXPIRED",message:"Refresh token expired"}});}
  const user=await getAppUser(token.userId);
  if(!user){await prisma.refreshToken.delete({where:{id:token.id}});return res.status(401).json({error:{code:"INVALID_SESSION",message:"Session is no longer valid"}});}
  const refreshToken=crypto.randomBytes(48).toString("base64url");
  await prisma.$transaction([
    prisma.refreshToken.delete({where:{id:token.id}}),
    prisma.refreshToken.create({data:{userId:user.id,tokenHash:hash(refreshToken),expiresAt:refreshExpiry()}}),
  ]);
  return res.json({data:{accessToken:signAccessToken(user),refreshToken,user}});
});

authRouter.post("/logout",async(req,res)=>{
  const token=z.object({refreshToken:z.string().optional()}).parse(req.body).refreshToken;
  if(token)await prisma.refreshToken.deleteMany({where:{tokenHash:hash(token)}});
  return res.status(204).end();
});
authRouter.get("/me",authenticate,(req,res)=>res.json({data:req.auth}));
authRouter.patch("/profile",authenticate,async(req,res)=>{
  const body=z.object({fullName:z.string().trim().min(2).max(100),avatarUrl:z.string().url().nullable().optional(),phone:z.string().trim().max(30).nullable().optional(),presentAddress:z.string().trim().max(500).nullable().optional(),permanentAddress:z.string().trim().max(500).nullable().optional()}).parse(req.body);
  await prisma.user.update({where:{id:req.auth!.id},data:{fullName:body.fullName,avatarUrl:body.avatarUrl??null,phone:body.phone||null,presentAddress:body.presentAddress||null,permanentAddress:body.permanentAddress||null}});
  return res.json({data:await getAppUser(req.auth!.id)});
});
