import winston from "winston";
import { STATUS_CODES } from "node:http";
import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { env } from "./config.js";

declare global {
  namespace Express {
    interface Request {
      id: string;
      log: winston.Logger;
    }
  }
}

// Sanitize metadata before either formatter sees it. Request bodies, headers and
// query strings are deliberately excluded from automatic HTTP logs.
const sensitive = /^(password|currentPassword|newPassword|token|accessToken|refreshToken|authorization|cookie|set-cookie|code|secret|database_url)$/i;
function sanitize(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return value.replace(/\u001b\[[0-9;]*m/g, "").replace(/[\r\n]/g, " ");
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (value instanceof Error) return { name: value.name, message: sanitize(value.message), stack: sanitize(value.stack) };
  if (Array.isArray(value)) return value.map(item => sanitize(item, seen));
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sensitive.test(key) ? "[REDACTED]" : sanitize(item, seen)]));
}
const redact = winston.format(info => {
  for (const key of Object.keys(info)) info[key] = sensitive.test(key) ? "[REDACTED]" : sanitize(info[key]);
  return info;
});

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  defaultMeta: { service: "inventory-api" },
  format: winston.format.combine(
    redact(),
    winston.format.timestamp({ format: () => new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).format(new Date()) }),
    env.LOG_FORMAT === "json" ? winston.format.json() : winston.format.printf(({ timestamp, level, message, service, requestId, method, path, status, durationMs, ...meta }) => {
      const prefix = `[${timestamp}] ${level.toUpperCase().padEnd(5)} | `;
      if (method) return `${prefix}${method} ${path} -> ${status} (${durationMs}ms) | ${message}`;
      const details = Object.entries(meta).map(([key, value]) => `${key}=${typeof value === "object" ? JSON.stringify(value) : String(value)}`).join(" ");
      return `${prefix}${message}${details ? " | " + details : ""}`;
    }),
  ),
  transports: [new winston.transports.Console()],
});

export const requestLogger: RequestHandler = (req, res, next) => {
  req.id = randomUUID();
  req.log = logger.child({ requestId: req.id });
  res.setHeader("X-Request-ID", req.id);
  const started = process.hrtime.bigint();
  let logged = false;
  let responseMessage: string | undefined;
  const json = res.json;
  res.json = function (body: unknown) {
    if (res.statusCode >= 400 && body && typeof body === "object" && "error" in body) {
      const error = (body as { error?: { message?: unknown } }).error;
      if (typeof error?.message === "string") responseMessage = error.message.slice(0, 500);
    }
    return json.call(this, body);
  };
  const complete = (aborted: boolean) => {
    if (logged) return;
    logged = true;
    const status = aborted ? 499 : res.statusCode;
    const level = status >= 400 ? "error" : "info";
    req.log.log(level, aborted ? "request aborted" : responseMessage ?? (status >= 400 ? STATUS_CODES[status] ?? "request failed" : "request completed"), {
      method: req.method,
      path: req.originalUrl.split("?")[0],
      status,
      durationMs: Math.round(Number(process.hrtime.bigint() - started) / 1e6),
    });
  };
  res.once("finish", () => complete(false));
  res.once("close", () => complete(!res.writableFinished));
  next();
};
