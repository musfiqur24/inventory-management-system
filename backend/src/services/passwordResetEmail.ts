import { env } from "../config.js";

export async function sendPasswordResetEmail(email:string,token:string){
  const url=new URL(env.PASSWORD_RESET_URL);
  url.searchParams.set("token",token);
  if(!env.RESEND_API_KEY){
    if(env.NODE_ENV==="production")throw new Error("Password reset email is not configured");
    console.info("[development] Password reset for "+email+": "+url.toString());
    return;
  }
  const response=await fetch("https://api.resend.com/emails",{
    method:"POST",
    headers:{Authorization:"Bearer "+env.RESEND_API_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({from:env.MAIL_FROM,to:[email],subject:"Reset your Inventory System password",text:"Reset your password within "+env.PASSWORD_RESET_TTL_MINUTES+" minutes: "+url.toString()}),
  });
  if(!response.ok)throw new Error("Email provider returned "+response.status);
}
