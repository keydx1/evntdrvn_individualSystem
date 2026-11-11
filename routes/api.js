import express from "express";
import { apiAuth, requireScope } from "../middleware/apiAuth.js";
import { apiRateLimit } from "../middleware/apiRateLimit.js";
import { sendApiError } from "../utils/apiErrors.js";
import { health } from "../controllers/api/healthController.js";
import { apiDocs, apiIndex, apiMe, apiSpec } from "../controllers/api/docsController.js";
import {
  getProductBySku,
  listCategories,
  listProducts,
  listStockLevels,
  listSuppliers,
} from "../controllers/api/productController.js";
import {
  createBulkMovements,
  listMovements,
  stockValuation,
} from "../controllers/api/movementController.js";

const router = express.Router();

const cors = (req, res, next) => {
  const origins = String(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const origin = req.get("origin");
  if (origin && origins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type, Idempotency-Key, X-Request-Id"
    );
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  }

  if (req.method === "OPTIONS") return res.status(204).end();
  return next();
};

const requestLog = (req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    console.log(
      JSON.stringify({
        level: "info",
        type: "api_request",
        ts: new Date().toISOString(),
        request_id: req.id ?? null,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        duration_ms: Number(durationMs.toFixed(1)),
        service: req.service?.name ?? null,
      })
    );
  });
  next();
};

router.use(cors);
router.use(requestLog);

// Public liveness probe so the other systems can check reachability.
router.get("/health", health);

// Public developer surface: catalogue, HTML guide and the OpenAPI contract.
router.get("/", apiIndex);
router.get("/docs", apiDocs);
router.get("/openapi.yaml", apiSpec);

router.use(apiAuth);
router.use(apiRateLimit);

// Handy for the five consumer systems: prove which token/scopes are in use.
router.get("/me", apiMe);

router.get("/products", requireScope("inventory:read"), listProducts);
router.get("/products/:sku", requireScope("inventory:read"), getProductBySku);
router.get("/categories", requireScope("inventory:read"), listCategories);
router.get("/suppliers", requireScope("inventory:read"), listSuppliers);
router.get("/stock/levels", requireScope("inventory:read"), listStockLevels);

router.get("/stock/movements", requireScope("ledger:read"), listMovements);
router.post("/stock/movements/bulk", requireScope("inventory:write"), createBulkMovements);
router.get("/stock/valuation", requireScope("ledger:read"), stockValuation);

router.use((req, res) =>
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `No API route matches ${req.method} ${req.originalUrl}.`,
      details: null,
      request_id: req.id ?? null,
    },
  })
);

// eslint-disable-next-line no-unused-vars
router.use((error, req, res, next) => sendApiError(res, req, error));

export default router;
