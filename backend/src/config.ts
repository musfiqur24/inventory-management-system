import dotenv from "dotenv";
import { dirname,resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const currentDir=dirname(fileURLToPath(import.meta.url));
dotenv.config({path:resolve(currentDir,"../.env")});
const nodeEnv=process.env.NODE_ENV??"development";
if(nodeEnv==="production"&&(!process.env.DATABASE_URL||!process.env.JWT_SECRET))throw new Error("DATABASE_URL and JWT_SECRET must be set in production.");

export const env=z.object({
  NODE_ENV:z.enum(["development","test","production"]).default("development"),
  SESSION_COOKIE_SECURE:z.enum(["true","false"]).default(nodeEnv==="production"?"true":"false").transform(v=>v==="true"),
  MFA_ENCRYPTION_KEY:z.string().min(32).optional(),
  REQUIRE_ADMIN_MFA:z.enum(["true","false"]).default(nodeEnv==="production"?"true":"false").transform(v=>v==="true"),
  TRUST_PROXY:z.string().default("loopback,linklocal,uniquelocal"),
  PORT:z.coerce.number().int().positive().default(4000),
  DATABASE_URL:z.string().min(1).default("postgresql://inventory:inventory@localhost:5432/inventory?schema=public"),
  WEB_ORIGIN:z.string().min(1).default("http://localhost:5173"),
  LOG_LEVEL:z.enum(["error","warn","info","http","verbose","debug","silly"]).default("info"),
  LOG_FORMAT:z.enum(["pretty","json"]).default("pretty"),
  JWT_SECRET:z.string().min(32).default("development-only-secret-change-before-production"),
  ACCESS_TOKEN_TTL:z.string().default("15m"),
  REFRESH_TOKEN_DAYS:z.coerce.number().int().positive().default(7),
  PASSWORD_RESET_TTL_MINUTES:z.coerce.number().int().min(5).max(60).default(15),
  PASSWORD_RESET_URL:z.string().url().default("http://localhost:5173/reset-password"),
  RESEND_API_KEY:z.preprocess(v=>v===""?undefined:v,z.string().min(1).optional()),
  MAIL_FROM:z.string().min(1).default("Inventory System <noreply@example.com>"),
}).parse(process.env);
