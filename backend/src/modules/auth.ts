import { auditMutation } from "../services/audit.js";
import { createTotpSecret,encryptSecret,decryptSecret,verifyTotp,newRecoveryCodes,recoveryHash } from "../services/mfa.js";
import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { env } from '../config.js';
import { authenticate, getAppUser, signAccessToken } from './rbac.js';
import { passwordSchema } from '../services/passwordPolicy.js';
import { authThrottle } from '../services/authThrottle.js';

export const authRouter=Router();
const hash=(value:string)=>crypto.createHash('sha256').update(value).digest('hex');
const refreshExpiry=()=>new Date(Date.now()+86400000*env.REFRESH_TOKEN_DAYS);
const cookieName='inventory_refresh';
const cookieOptions={httpOnly:true,secure:env.SESSION_COOKIE_SECURE,sameSite:'strict' as const,path:'/api/v1/auth'};
function readRefresh(req:Request){return req.headers.cookie?.split(';').map(p=>p.trim()).find(p=>p.startsWith(cookieName+'='))?.slice(cookieName.length+1);}
function setRefresh(res:Response,token:string){res.cookie(cookieName,token,{...cookieOptions,maxAge:86400000*env.REFRESH_TOKEN_DAYS});}
function clearRefresh(res:Response){res.clearCookie(cookieName,cookieOptions);}
authRouter.use((req,res,next)=>{
  res.setHeader('Cache-Control','no-store');
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin&&!env.WEB_ORIGIN.split(',').map(s=>s.trim()).includes(req.headers.origin))return res.status(403).json({error:{code:'INVALID_ORIGIN',message:'Request origin is not allowed'}});
  // Browser cookie operations require an allowed Origin to prevent CSRF.
  if(readRefresh(req)&&!['GET','HEAD','OPTIONS'].includes(req.method)&&!req.headers.origin)return res.status(403).json({error:{code:'ORIGIN_REQUIRED',message:'Cookie requests require an allowed Origin'}});
  next();
});
authRouter.use(authThrottle);
authRouter.get('/capabilities',(_req,res)=>res.json({data:{passwordReset:Boolean(env.RESEND_API_KEY)}}));
authRouter.post('/forgot-password',async(req,res)=>{
  if(!env.RESEND_API_KEY)return res.status(503).json({error:{code:'MAIL_UNAVAILABLE',message:'Password recovery is not configured. Contact your administrator.'}});
  const email=z.object({email:z.string().trim().email().max(254)}).parse(req.body).email.toLowerCase();
  const user=await prisma.user.findUnique({where:{email},select:{id:true,email:true,isActive:true}});
  if(user?.isActive){
    const token=crypto.randomBytes(32).toString('base64url');
    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({where:{userId:user.id}}),
      prisma.passwordResetToken.create({data:{userId:user.id,tokenHash:hash(token),expiresAt:new Date(Date.now()+env.PASSWORD_RESET_TTL_MINUTES*60000)}}),
      prisma.mailOutbox.updateMany({where:{email:user.email,status:'PENDING'},data:{status:'CANCELLED'}}),
      prisma.mailOutbox.create({data:{email:user.email,tokenCipher:encryptSecret(token),expiresAt:new Date(Date.now()+env.PASSWORD_RESET_TTL_MINUTES*60000)}}),
    ]);

  }
  return res.status(202).json({data:{message:'If an active account matches this email, a reset link will be sent.'}});
});
authRouter.post('/reset-password',async(req,res)=>{
  const body=z.object({token:z.string().min(40).max(200),password:passwordSchema}).parse(req.body);
  const token=await prisma.passwordResetToken.findUnique({where:{tokenHash:hash(body.token)}});
  if(!token||token.consumedAt||token.expiresAt<=new Date())return res.status(400).json({error:{code:'INVALID_RESET_TOKEN',message:'This link is invalid or expired'}});
  const passwordHash=await bcrypt.hash(body.password,12);
  const claimed=await prisma.$transaction(async tx=>{
    const claim=await tx.passwordResetToken.updateMany({where:{id:token.id,consumedAt:null,expiresAt:{gt:new Date()}},data:{consumedAt:new Date()}});
    if(!claim.count)return false;
    await tx.user.update({where:{id:token.userId},data:{passwordHash,sessionVersion:{increment:1}}});
    await tx.refreshToken.deleteMany({where:{userId:token.userId}});
    return true;
  });
  if(!claimed)return res.status(400).json({error:{code:'INVALID_RESET_TOKEN',message:'This link has already been used'}});
  clearRefresh(res);return res.json({data:{message:'Password reset. Sign in with your new password.'}});
});
authRouter.post('/login',async(req,res)=>{
  const body=z.object({email:z.string().trim().email().max(254),password:z.string().min(1).max(128),code:z.string().trim().max(100).optional()}).parse(req.body);
  const user=await prisma.user.findUnique({where:{email:body.email.toLowerCase()}});
  if(!user?.isActive||!await bcrypt.compare(body.password,user.passwordHash))return res.status(401).json({error:{code:'INVALID_CREDENTIALS',message:'Invalid email or password'}});
  if(user.mfaEnabled){
    const code=body.code??'';let valid=user.mfaSecret?verifyTotp(decryptSecret(user.mfaSecret),code):false;
    if(!valid&&code){valid=await prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`;const current=await tx.user.findUniqueOrThrow({where:{id:user.id}});const hashes=Array.isArray(current.mfaRecoveryHashes)?current.mfaRecoveryHashes.filter((v):v is string=>typeof v==='string'):[];const hashed=recoveryHash(code);if(!hashes.includes(hashed))return false;await tx.user.update({where:{id:user.id},data:{mfaRecoveryHashes:hashes.filter(h=>h!==hashed)}});return true;});}
    if(!valid)return res.status(401).json({error:{code:'MFA_REQUIRED',message:'Enter a valid authenticator or recovery code'}});
  }
  const appUser=await getAppUser(user.id);
  if(!appUser?.organizations.length)return res.status(403).json({error:{code:'NO_ORGANIZATION_ACCESS',message:'No organization access assigned'}});
  const refreshToken=crypto.randomBytes(48).toString('base64url');
  await prisma.refreshToken.create({data:{userId:user.id,tokenHash:hash(refreshToken),expiresAt:refreshExpiry()}});
  setRefresh(res,refreshToken);return res.json({data:{accessToken:signAccessToken(appUser),user:appUser}});
});
authRouter.post('/refresh',async(req,res)=>{
  const value=readRefresh(req);
  if(!value)return res.status(401).json({error:{code:'INVALID_SESSION',message:'Sign in again'}});
  const replacement=crypto.randomBytes(48).toString('base64url');
  const userId=await prisma.$transaction(async tx=>{
    const token=await tx.refreshToken.findUnique({where:{tokenHash:hash(value)}});
    if(!token||token.expiresAt<=new Date())return null;
    const claim=await tx.refreshToken.updateMany({where:{id:token.id,consumedAt:null},data:{consumedAt:new Date()}});
    if(!claim.count){
      await tx.refreshToken.deleteMany({where:{familyId:token.familyId}});
      await tx.user.update({where:{id:token.userId},data:{sessionVersion:{increment:1}}});
      return null;
    }
    await tx.refreshToken.create({data:{userId:token.userId,familyId:token.familyId,tokenHash:hash(replacement),expiresAt:refreshExpiry()}});
    return token.userId;
  });
  const user=userId?await getAppUser(userId):null;
  if(!user){clearRefresh(res);return res.status(401).json({error:{code:'INVALID_SESSION',message:'Session expired or reused. Sign in again'}});}
  setRefresh(res,replacement);return res.json({data:{accessToken:signAccessToken(user),user}});
});
authRouter.post('/logout',async(req,res)=>{
  const value=readRefresh(req);
  const token=value?await prisma.refreshToken.findUnique({where:{tokenHash:hash(value)}}):null;
  if(token)await prisma.$transaction([prisma.refreshToken.deleteMany({where:{userId:token.userId}}),prisma.user.update({where:{id:token.userId},data:{sessionVersion:{increment:1}}})]);
  clearRefresh(res);return res.status(204).end();
});
authRouter.post('/change-password',authenticate,auditMutation,async(req,res)=>{
  const body=z.object({currentPassword:z.string().min(1).max(128),password:passwordSchema}).parse(req.body);
  const user=await prisma.user.findUniqueOrThrow({where:{id:req.auth!.id}});
  if(!await bcrypt.compare(body.currentPassword,user.passwordHash))return res.status(403).json({error:{message:'Current password is incorrect'}});
  await prisma.$transaction([prisma.user.update({where:{id:user.id},data:{passwordHash:await bcrypt.hash(body.password,12),sessionVersion:{increment:1}}}),prisma.refreshToken.deleteMany({where:{userId:user.id}})]);
  clearRefresh(res);return res.status(204).end();
});
authRouter.get('/me',authenticate,(req,res)=>res.json({data:req.auth}));

authRouter.patch("/profile",authenticate,auditMutation,async(req,res)=>{
  const body=z.object({fullName:z.string().trim().min(2).max(100),avatarUrl:z.string().url().nullable().optional(),phone:z.string().trim().max(30).nullable().optional(),presentAddress:z.string().trim().max(500).nullable().optional(),permanentAddress:z.string().trim().max(500).nullable().optional()}).parse(req.body);
  await prisma.user.update({where:{id:req.auth!.id},data:{fullName:body.fullName,avatarUrl:body.avatarUrl??null,phone:body.phone||null,presentAddress:body.presentAddress||null,permanentAddress:body.permanentAddress||null}});
  return res.json({data:await getAppUser(req.auth!.id)});
});

authRouter.post('/mfa/setup',authenticate,auditMutation,async(req,res)=>{
 const body=z.object({currentPassword:z.string().min(1).max(128)}).parse(req.body);
 const user=await prisma.user.findUniqueOrThrow({where:{id:req.auth!.id}});
 if(user.mfaEnabled)return res.status(409).json({error:{message:'Two-factor authentication is already enabled'}});
 if(!await bcrypt.compare(body.currentPassword,user.passwordHash))return res.status(403).json({error:{message:'Current password is incorrect'}});
 const secret=createTotpSecret();await prisma.user.update({where:{id:user.id},data:{mfaSecret:encryptSecret(secret)}});
 res.json({data:{secret,uri:'otpauth://totp/'+encodeURIComponent('Inventory:'+user.email)+'?secret='+secret+'&issuer=Inventory'}});
});
authRouter.post('/mfa/enable',authenticate,auditMutation,async(req,res)=>{
 const {code}=z.object({code:z.string().regex(/^\d{6}$/)}).parse(req.body);const codes=newRecoveryCodes();
 const enabled=await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${req.auth!.id} FOR UPDATE`;
  const user=await tx.user.findUniqueOrThrow({where:{id:req.auth!.id}});
  if(user.mfaEnabled||!user.mfaSecret||!verifyTotp(decryptSecret(user.mfaSecret),code))return false;
  await tx.user.update({where:{id:user.id},data:{mfaEnabled:true,mfaRecoveryHashes:codes.map(recoveryHash),sessionVersion:{increment:1}}});
  await tx.refreshToken.deleteMany({where:{userId:user.id}});return true;
 });
 if(!enabled)return res.status(422).json({error:{message:'Invalid code or MFA already enabled'}});
 const refreshToken=crypto.randomBytes(48).toString('base64url');
 await prisma.refreshToken.create({data:{userId:req.auth!.id,tokenHash:hash(refreshToken),expiresAt:refreshExpiry()}});
 const user=await getAppUser(req.auth!.id);if(!user)throw new Error('User no longer active');
 setRefresh(res,refreshToken);res.json({data:{recoveryCodes:codes,accessToken:signAccessToken(user),user}});
});
authRouter.post('/mfa/disable',authenticate,auditMutation,async(req,res)=>{
 const {currentPassword,code}=z.object({currentPassword:z.string(),code:z.string()}).parse(req.body);
 const user=await prisma.user.findUniqueOrThrow({where:{id:req.auth!.id}});
 if(!await bcrypt.compare(currentPassword,user.passwordHash)||!user.mfaSecret||!verifyTotp(decryptSecret(user.mfaSecret),code))return res.status(403).json({error:{message:'Password or authenticator code is incorrect'}});
 await prisma.$transaction([prisma.user.update({where:{id:user.id},data:{mfaEnabled:false,mfaSecret:null,mfaRecoveryHashes:[],sessionVersion:{increment:1}}}),prisma.refreshToken.deleteMany({where:{userId:user.id}})]);
 clearRefresh(res);res.status(204).end();
});
