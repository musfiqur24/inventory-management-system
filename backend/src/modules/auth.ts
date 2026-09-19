import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { env } from "../config.js";
import { authenticate, getAppUser, signAccessToken } from "./rbac.js";
import { sendPasswordResetEmail } from "../services/passwordResetEmail.js";

export const authRouter=Router();
const hash=(value:string)=>crypto.createHash("sha256").update(value).digest("hex");
const refreshExpiry=()=>new Date(Date.now()+86400000*env.REFRESH_TOKEN_DAYS);
const resetMessage="If an active account matches that email, a password reset link will be sent.";
const resetRequests=new Map<string,number>();

authRouter.post("/forgot-password",async(req,res)=>{
  const started=Date.now();
  const email=z.object({email:z.string().trim().email().max(254)}).parse(req.body).email.toLowerCase();
  const key=(req.ip??"unknown")+":"+hash(email);
  const last=resetRequests.get(key)??0;
  if(Date.now()-last>=60_000){
    resetRequests.set(key,Date.now());
    const user=await prisma.user.findUnique({where:{email},select:{id:true,email:true,isActive:true}});
    if(user?.isActive){
      const token=crypto.randomBytes(32).toString("base64url");
      await prisma.$transaction([
        prisma.passwordResetToken.deleteMany({where:{userId:user.id}}),
        prisma.passwordResetToken.create({data:{userId:user.id,tokenHash:hash(token),expiresAt:new Date(Date.now()+env.PASSWORD_RESET_TTL_MINUTES*60_000)}}),
      ]);
      void sendPasswordResetEmail(user.email,token).catch(error=>req.log.error({err:error,userId:user.id},"Password reset email failed"));
    }
  }
  const wait=250-(Date.now()-started);
  if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));
  return res.status(202).json({data:{message:resetMessage}});
});

authRouter.post("/reset-password",async(req,res)=>{
  const body=z.object({token:z.string().min(40).max(200),password:z.string().min(12).max(128).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/)}).parse(req.body);
  const token=await prisma.passwordResetToken.findUnique({where:{tokenHash:hash(body.token)}});
  if(!token||token.consumedAt||token.expiresAt<=new Date())return res.status(400).json({error:{code:"INVALID_RESET_TOKEN",message:"This password reset link is invalid or has expired"}});
  const passwordHash=await bcrypt.hash(body.password,12);
  let succeeded=true;
  await prisma.$transaction(async tx=>{
    const claim=await tx.passwordResetToken.updateMany({where:{id:token.id,consumedAt:null,expiresAt:{gt:new Date()}},data:{consumedAt:new Date()}});
    if(!claim.count)throw new ResetClaimError();
    await tx.user.update({where:{id:token.userId},data:{passwordHash}});
    await tx.refreshToken.deleteMany({where:{userId:token.userId}});
    await tx.passwordResetToken.deleteMany({where:{userId:token.userId,id:{not:token.id}}});
  }).catch(error=>{if(error instanceof ResetClaimError){succeeded=false;return;}throw error;});
  if(!succeeded)return res.status(400).json({error:{code:"INVALID_RESET_TOKEN",message:"This password reset link is invalid or has expired"}});
  return res.json({data:{message:"Password reset successfully. Please sign in with your new password."}});
});
class ResetClaimError extends Error{}

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
