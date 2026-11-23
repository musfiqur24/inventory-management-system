import { processMailOutbox } from "./services/mailOutbox.js";
import { createApp,logger } from "./app.js";
import { env } from "./config.js";
import { prisma } from "./prisma.js";
import { bootstrapRbac } from "./modules/rbac.js";

async function start(){
  await bootstrapRbac();
  const server=createApp().listen(env.PORT,()=>logger.info({port:env.PORT},"Inventory API started"));
  server.on("error",error=>{logger.error({err:error},"Server listen error");process.exitCode=1;});
  let sending=false;
  const mailTimer=setInterval(()=>{if(sending)return;sending=true;void processMailOutbox((error,id)=>logger.error({err:error,mailJobId:id},"Password recovery delivery failed; retry scheduled")).catch(error=>logger.error({err:error},"Mail outbox unavailable")).finally(()=>{sending=false;});},15000);
  mailTimer.unref();
  const maintenance=setInterval(()=>{void Promise.all([
    prisma.authThrottle.deleteMany({where:{expiresAt:{lt:new Date()}}}),
    prisma.refreshToken.deleteMany({where:{expiresAt:{lt:new Date()}}}),
    prisma.passwordResetToken.deleteMany({where:{expiresAt:{lt:new Date()}}}),
    prisma.mailOutbox.deleteMany({where:{expiresAt:{lt:new Date(Date.now()-30*86400000)}}}),
  ]).catch(error=>logger.error({err:error},"Session cleanup failed"));},3600000);
  maintenance.unref();
  const stop=(signal:string)=>{clearInterval(maintenance);clearInterval(mailTimer);logger.info({signal},"Shutting down");server.close(async()=>{await prisma.$disconnect();process.exit(0);});};
  process.once("SIGINT",()=>stop("SIGINT"));
  process.once("SIGTERM",()=>stop("SIGTERM"));
}
start().catch(async error=>{logger.fatal({err:error},"API startup failed");await prisma.$disconnect();process.exit(1);});
