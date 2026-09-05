import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// Always resolve .env from the backend folder, no matter which directory starts Node.
const currentDir = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(currentDir, "../.env") });

const nodeEnv = process.env.NODE_ENV ?? "development";
if (nodeEnv === "production" && (!process.env.DATABASE_URL || !process.env.JWT_SECRET)) {
  throw new Error("DATABASE_URL and JWT_SECRET must be set in production.");
}

export const env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  // These defaults make first-time local development work with docker-compose.yml.
  DATABASE_URL: z.string().min(1).default("postgresql://inventory:inventory@localhost:5432/inventory?schema=public"),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  LOG_LEVEL: z.string().default("info"),
  JWT_SECRET: z.string().min(32).default("development-only-secret-change-before-production"),
}).parse(process.env);
