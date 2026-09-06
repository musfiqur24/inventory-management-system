import { createApp,logger } from "./app.js";
import { env } from "./config.js";
import { prisma } from "./prisma.js";
import { bootstrapRbac } from "./modules/rbac.js";

async function start(){
  await bootstrapRbac();
  const server=createApp().listen(env.PORT,()=>logger.info({port:env.PORT},"Inventory API started"));
  server.on("error",error=>{logger.error({err:error},"Server listen error");process.exitCode=1;});
  const stop=(signal:string)=>{logger.info({signal},"Shutting down");server.close(async()=>{await prisma.$disconnect();process.exit(0);});};
  process.once("SIGINT",()=>stop("SIGINT"));
  process.once("SIGTERM",()=>stop("SIGTERM"));
}
start().catch(async error=>{logger.fatal({err:error},"API startup failed");await prisma.$disconnect();process.exit(1);});
