import { createHmac, randomBytes, createHash, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto';
import { env } from '../config.js';
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function createTotpSecret(){let bits=0,value=0,result='';for(const byte of randomBytes(20)){value=(value<<8)|byte;bits+=8;while(bits>=5){result+=alphabet[(value>>>(bits-5))&31];bits-=5;}}return result;}
function decode(secret:string){let bits=0,value=0;const bytes:number[]=[];for(const char of secret){const n=alphabet.indexOf(char);if(n<0)throw new Error('Invalid secret');value=(value<<5)|n;bits+=5;if(bits>=8){bytes.push((value>>>(bits-8))&255);bits-=8;}}return Buffer.from(bytes);}
export function totpCode(secret:string,time=Date.now()){const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(time/30000)));const hmac=createHmac('sha1',decode(secret)).update(counter).digest();const offset=hmac[19]&15;return String((hmac.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');}
export function verifyTotp(secret:string,code:string){return /^\d{6}$/.test(code)&&[-1,0,1].some(offset=>timingSafeEqual(Buffer.from(totpCode(secret,Date.now()+offset*30000)),Buffer.from(code)));}
const key=()=>createHash('sha256').update(env.MFA_ENCRYPTION_KEY??env.JWT_SECRET).digest();
export function encryptSecret(secret:string){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);const encrypted=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);return [iv,cipher.getAuthTag(),encrypted].map(b=>b.toString('base64url')).join('.');}
export function decryptSecret(payload:string){const [iv,tag,data]=payload.split('.').map(v=>Buffer.from(v,'base64url'));const decipher=createDecipheriv('aes-256-gcm',key(),iv);decipher.setAuthTag(tag);return Buffer.concat([decipher.update(data),decipher.final()]).toString('utf8');}
export const recoveryHash=(code:string)=>createHash('sha256').update(code.trim().toLowerCase()).digest('hex');
export function newRecoveryCodes(){return Array.from({length:10},()=>randomBytes(8).toString('hex'));}
