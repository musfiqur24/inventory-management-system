import { env } from "../config.js";

export function passwordResetLink(token:string,base=env.PASSWORD_RESET_URL){
  const url=new URL(base);
  url.searchParams.delete('token');
  url.hash=new URLSearchParams({token}).toString();
  return url.toString();
}
export async function sendPasswordResetEmail(email:string,token:string){
  const url=passwordResetLink(token);
  if(!env.RESEND_API_KEY){
    if(env.NODE_ENV==="production")throw new Error("Password reset email is not configured");
    console.info("[development] Password reset for "+email+": "+url.toString());
    return;
  }
  const response=await fetch("https://api.resend.com/emails",{
    method:"POST",
    signal:AbortSignal.timeout(10000),
    headers:{Authorization:"Bearer "+env.RESEND_API_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({from:env.MAIL_FROM,to:[email],subject:"Reset your Inventory System password",text:"Reset your password within "+env.PASSWORD_RESET_TTL_MINUTES+" minutes: "+url.toString()}),
  });
  if(!response.ok)throw new Error("Email provider returned "+response.status);
}
