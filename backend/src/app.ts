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
import { partnersRouter } from "./routes/partners.js";
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
  app.use(express.json({ limit: "1mb" }));
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

  app.use("/api/v1", authenticate, tenant, (req, res, next) =>
    requirePermission(
      req.method === "GET" ? "departments.read" : "departments.write",
    )(req, res, next),
  );
  app.use("/api/v1/uoms", uomsRouter);
  app.use("/api/v1/categories", categoriesRouter);
  app.use("/api/v1/products", productsRouter);
  app.use("/api/v1/partners", partnersRouter);
  app.use("/api/v1/bins", binsRouter);
  app.use("/api/v1/purchase-requisitions", purchaseRequisitionsRouter);
  app.use("/api/v1/deliveries", deliveriesRouter);
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
    if (error instanceof ZodError)
      return res
        .status(422)
        .json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Please check the submitted values",
            details: error.flatten(),
          },
        });
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
            message: "A record with the same unique value already exists",
          },
        });
    if (prismaCode === "P2025")
      return res
        .status(404)
        .json({
          error: {
            code: "NOT_FOUND",
            message: "The requested record was not found",
          },
        });
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
