import { processMailOutbox } from "./services/mailOutbox.js";
import { createApp,logger } from "./app.js";
import { env } from "./config.js";
import { prisma } from "./prisma.js";
import { bootstrapRbac } from "./modules/rbac.js";

async function start(){
  await bootstrapRbac();
  const server=createApp().listen(env.PORT,()=>logger.info("Inventory API started",{port:env.PORT}));
  server.on("error",error=>{logger.error("Server listen error",{err:error});process.exitCode=1;});
  let sending=false;
  const mailTimer=setInterval(()=>{if(sending)return;sending=true;void processMailOutbox((error,id)=>logger.error("Password recovery delivery failed; retry scheduled",{err:error,mailJobId:id})).catch(error=>logger.error("Mail outbox unavailable",{err:error})).finally(()=>{sending=false;});},15000);
  mailTimer.unref();
  const maintenance=setInterval(()=>{void Promise.all([
    prisma.authThrottle.deleteMany({where:{expiresAt:{lt:new Date()}}}),
    prisma.refreshToken.deleteMany({where:{expiresAt:{lt:new Date()}}}),
    prisma.passwordResetToken.deleteMany({where:{expiresAt:{lt:new Date()}}}),
    prisma.mailOutbox.deleteMany({where:{expiresAt:{lt:new Date(Date.now()-30*86400000)}}}),
  ]).catch(error=>logger.error("Session cleanup failed",{err:error}));},3600000);
  maintenance.unref();
  const stop=(signal:string)=>{clearInterval(maintenance);clearInterval(mailTimer);logger.info("Shutting down",{signal});server.close(async()=>{await prisma.$disconnect();process.exit(0);});};
  process.once("SIGINT",()=>stop("SIGINT"));
  process.once("SIGTERM",()=>stop("SIGTERM"));
}
start().catch(async error=>{logger.error("API startup failed",{err:error});await prisma.$disconnect();process.exit(1);});
