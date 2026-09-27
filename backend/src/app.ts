import { notificationsRouter } from "./routes/notifications.js";
import { StockError } from "./services/stock.js";
import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import pino from "pino";
import { pinoHttp } from "pino-http";
import swaggerUi from "swagger-ui-express";
import { ZodError } from "zod";
import { env } from "./config.js";
import { spec } from "./swagger.js";
import { authRouter } from "./modules/auth.js";
import { usersRouter } from "./modules/users.js";
import { organizationsRouter } from "./modules/organizations.js";
import { authenticate, requirePermission, tenant } from "./modules/rbac.js";
import { uomsRouter } from "./routes/uoms.js";
import { categoriesRouter } from "./routes/categories.js";
import { productsRouter } from "./routes/products.js";
import { currenciesRouter } from "./routes/currencies.js";
import { partnersRouter } from "./routes/partners.js";
import { storesRouter } from "./routes/stores.js";
import { binsRouter } from "./routes/bins.js";
import { purchaseRequisitionsRouter } from "./routes/purchaseRequisitions.js";
import { deliveriesRouter } from "./routes/deliveries.js";
import { weighmentsRouter } from "./routes/weighments.js";
import { rmStoreRouter } from "./routes/rmStore.js";
import { recipesRouter } from "./routes/recipes.js";
import { productionOrdersRouter } from "./routes/productionOrders.js";
import { materialIssuesRouter } from "./routes/materialIssues.js";
import { batchesRouter } from "./routes/batches.js";
import { fmStoreRouter } from "./routes/fmStore.js";
import { salesOrdersRouter } from "./routes/salesOrders.js";
import { dispatchesRouter } from "./routes/dispatches.js";
import { inventoryRouter } from "./routes/inventory.js";
import { traceabilityRouter } from "./routes/traceability.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  ...(env.NODE_ENV === "development"
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        },
      }
    : {}),
  redact: [
    "req.headers.authorization",
    "req.body.password",
    "password",
    "*.password",
    "req.body.token",
    "token",
    "*.token",
  ],
});

export function createApp() {
  const app = express();
  const allowedOrigins = new Set(
    env.WEB_ORIGIN.split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  app.disable("x-powered-by");
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(
    cors({
      origin: (origin, callback) =>
        callback(null, !origin || allowedOrigins.has(origin)),
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "x-organization-id"],
    }),
  );
  app.use(express.json({ limit: "12mb" }));
  app.use(
    pinoHttp({
      logger,
      customLogLevel: (_req, res, error) =>
        res.statusCode >= 500 || error
          ? "error"
          : res.statusCode >= 400
            ? "warn"
            : "info",
    }),
  );

  app.get("/api/v1/health", (_req, res) =>
    res.json({
      status: "ok",
      service: "inventory-api",
      timestamp: new Date().toISOString(),
    }),
  );
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(spec));
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/organizations", organizationsRouter);
  app.get("/api/v1/my-organizations", authenticate, (req, res) =>
    res.json({ data: req.auth!.organizations }),
  );
  app.use("/api/v1/users", authenticate, usersRouter);

  app.use("/api/v1/notifications", authenticate, tenant, notificationsRouter);

  app.use("/api/v1/deliveries", authenticate, tenant, (req,res,next)=>{
    const role=req.auth?.organizations.find(o=>o.id===req.tenantId)?.role.code;
    if(role==="STAFF" && ((req.method==="POST" && req.path==="/") || req.method==="PUT"))return next();
    return requirePermission(req.method==="GET"?"departments.read":"departments.write")(req,res,next);
  }, deliveriesRouter);

  app.use("/api/v1/purchase-requisitions", authenticate, tenant, (req,res,next)=>{
    const role=req.auth?.organizations.find(o=>o.id===req.tenantId)?.role.code;
    if(role==='STAFF' && ((req.method==='POST' && req.path==='/') || req.method==='PUT'))return next();
    return requirePermission(req.method==='GET'?'departments.read':'departments.write')(req,res,next);
  }, purchaseRequisitionsRouter);

  app.use("/api/v1", authenticate, tenant, (req, res, next) =>
    requirePermission(
      req.method === "POST" && req.path === "/weighments/reports"
        ? "weighbridge.submit"
        : req.method === "GET"
          ? "departments.read"
          : "departments.write",
    )(req, res, next),
  );
  app.use("/api/v1/uoms", uomsRouter);
  app.use("/api/v1/categories", categoriesRouter);
  app.use("/api/v1/products", productsRouter);
  app.use("/api/v1/currencies", currenciesRouter);
  app.use("/api/v1/partners", partnersRouter);
  app.use("/api/v1/bins", binsRouter);
  app.use("/api/v1/stores", storesRouter);


  app.use("/api/v1/weighments", weighmentsRouter);
  app.use("/api/v1/rm-store", rmStoreRouter);
  app.use("/api/v1/recipes", recipesRouter);
  app.use("/api/v1/production-orders", productionOrdersRouter);
  app.use("/api/v1/material-issues", materialIssuesRouter);
  app.use("/api/v1/batches", batchesRouter);
  app.use("/api/v1/fm-store", fmStoreRouter);
  app.use("/api/v1/sales-orders", salesOrdersRouter);
  app.use("/api/v1/dispatches", dispatchesRouter);
  app.use("/api/v1/inventory", inventoryRouter);
  app.use("/api/v1/traceability", traceabilityRouter);

  app.use((_req, res) =>
    res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Route not found" } }),
  );
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof StockError) return res.status(error.status).json({ error: { code: error.code, message: error.message } });
    if (error instanceof ZodError) {
      const issues = error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        message: issue.message,
      }));
      const first = issues[0];
      return res.status(422).json({
        error: {
          code: "VALIDATION_ERROR",
          message: first ? (first.path ? first.path + ": " : "") + first.message : "Please check the submitted values.",
          details: { issues, ...error.flatten() },
        },
      });
    }
    const prismaCode =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    if (prismaCode === "P2002")
      return res
        .status(409)
        .json({
          error: {
            code: "CONFLICT",
            message: (() => {
              const target = typeof error === "object" && error !== null && "meta" in error
                ? (error as { meta?: { target?: unknown } }).meta?.target
                : undefined;
              const fields = Array.isArray(target) ? target.join(", ") : typeof target === "string" ? target : "";
              return fields ? "A record with the same " + fields + " already exists." : "A record with the same unique value already exists.";
            })(),
          },
        });
    if (prismaCode === "P2025")
      return res
        .status(404)
        .json({
          error: {
            code: "NOT_FOUND",
            message: typeof error === "object" && error !== null && "meta" in error && (error as { meta?: { cause?: unknown } }).meta?.cause
              ? String((error as { meta?: { cause?: unknown } }).meta?.cause)
              : "The requested record was not found.",
          },
        });
    if (prismaCode === "P2003")
      return res.status(409).json({ error: { code: "RELATION_CONFLICT", message: "This record is linked to another record and cannot be changed or deleted." } });
    if (prismaCode === "P2014")
      return res.status(409).json({ error: { code: "REQUIRED_RELATION", message: "This change would break a required linked record." } });
    logger.error({ err: error }, "Unhandled request error");
    return res
      .status(500)
      .json({
        error: {
          code: "INTERNAL_ERROR",
          message:
            env.NODE_ENV === "production"
              ? "Unexpected server error"
              : error instanceof Error
                ? error.message
                : "Unknown server error",
        },
      });
  };
  app.use(errors);
  return app;
}
