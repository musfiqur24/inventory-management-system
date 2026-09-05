import express, {
  type ErrorRequestHandler,
  type RequestHandler,
} from "express";
import cors from "cors";
import helmet from "helmet";
import pino from "pino";
import { pinoHttp } from "pino-http";
import swaggerUi from "swagger-ui-express";
import { ZodError, z } from "zod";
import { env } from "./config.js";
import { prisma } from "./prisma.js";
import { spec } from "./swagger.js";
declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
    }
  }
}
export const logger = pino({
  level: env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
    },
  },
  redact: ["req.headers.authorization", "password", "*.password"],
});

const tenant: RequestHandler = (req, res, next) => {
  const id = req.header("x-organization-id");
  if (!id)
    return res
      .status(400)
      .json({
        error: {
          code: "TENANT_REQUIRED",
          message: "x-organization-id header is required",
        },
      });
  req.tenantId = id;
  next();
};

const app = express();
app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(
  cors({
    origin: true, // Allow all origins in dev (localhost:5173, 127.0.0.1:5173, etc.)
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-organization-id"],
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(
  pinoHttp({
    logger,
    customLogLevel: (_req, res, err) => {
      if (res.statusCode >= 500 || err) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    customSuccessMessage: (req, res) =>
      `[HTTP] ${req.method} ${req.url} -> ${res.statusCode}`,
    customErrorMessage: (req, res, err) =>
      `[HTTP] ${req.method} ${req.url} -> ${res.statusCode} (Error: ${err.message})`,
  }),
);
app.use("/docs", swaggerUi.serve, swaggerUi.setup(spec));
app.get("/api/v1/health", (_req, res) =>
  res.json({
    status: "ok",
    service: "inventory-api",
    timestamp: new Date().toISOString(),
  }),
);
// Tenant onboarding is intentionally available before tenant middleware.
app.get("/api/v1/organizations", async (_req, res) =>
  res.json({ data: await prisma.organization.findMany({ orderBy: { name: "asc" } }) }),
);
app.post("/api/v1/organizations", async (req, res) => {
  const data = z.object({ code: z.string().min(2), name: z.string().min(2) }).parse(req.body);
  res.status(201).json({ data: await prisma.organization.create({ data }) });
});
app.use("/api/v1", tenant);
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

// Specific workflow routers
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
      .json({ error: { code: "VALIDATION_ERROR", details: error.flatten() } });
  logger.error({ err: error }, "Unhandled request error");
  const isDevelopment = env.NODE_ENV !== "production";
  const message = error instanceof Error ? error.message : "An unknown server error occurred";
  return res.status(500).json({
    error: {
      code: error instanceof Error ? error.name : "INTERNAL_ERROR",
      message: isDevelopment ? message : "Unexpected server error",
    },
  });
};
app.use(errors);
const server = app.listen(env.PORT, () =>
  logger.info({ port: env.PORT }, "Inventory API started"),
);

server.on("error", (err: any) => {
  if (err.code === "EADDRINUSE") {
    logger.error(`Port ${env.PORT} is already in use by another process. Kill the process on port ${env.PORT} or change PORT in .env.`);
  } else {
    logger.error({ err }, "Server listen error");
  }
  process.exit(1);
});

const stop = () =>
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
