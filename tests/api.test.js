process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "aquapiol-api-test-secret";
process.env.DB_NAME = process.env.TEST_DB_NAME || "aquapiol_api_test";
process.env.RATE_LIMIT_PER_MIN = "100000";
process.env.IDEMPOTENCY_TTL_DAYS = "7";
process.env.API_TOKENS = JSON.stringify({
  pos: "test-pos-token-000000000000",
  accounting: "test-accounting-token-0000000",
});

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import mysql from "mysql2/promise";

const DB_NAME = process.env.DB_NAME;
const DB_HOST = process.env.DB_HOST || "127.0.0.1";
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || "";

const TOKENS = JSON.parse(process.env.API_TOKENS);

let server;
let baseUrl;
let models;
let product;

const adminDbConnection = () =>
  mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
  });

const api = async (path, { method = "GET", token = TOKENS.pos, body, headers = {} } = {}) => {
  const requestHeaders = { ...headers };
  if (token) requestHeaders.authorization = `Bearer ${token}`;
  if (body !== undefined) requestHeaders["content-type"] = "application/json";

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { response, status: response.status, json, text };
};

const bulkBody = (overrides = {}) => ({
  source_system: "pos",
  reference: "INV-2026-0001",
  lines: [{ sku: "API-001", type: "out", quantity: 2 }],
  ...overrides,
});

before(async () => {
  assert.match(DB_NAME, /^aquapiol_[a-z0-9_]*_test$/, "Refusing to use an unsafe test database name");

  const root = await adminDbConnection();
  await root.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\``);
  await root.query(`CREATE DATABASE \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await root.end();

  models = await import("../models/index.js");
  await models.sequelize.sync({ force: true });

  const category = await models.Category.create({
    name: "Integration Category",
    description: "API tests",
  });

  product = await models.Product.create({
    sku: "API-001",
    name: "API Test Bottle",
    categoryId: category.id,
    unit: "piece",
    quantity: 10,
    reorderLevel: 2,
    costPrice: 12.5,
    sellingPrice: 30,
  });

  const appModule = await import("../index.js");
  server = await appModule.startServer(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (models) await models.sequelize.close();

  const root = await adminDbConnection();
  await root.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\``);
  await root.end();
});

test("health endpoint is public and reports the database", async () => {
  const { status, json } = await api("/api/v1/health", { token: null });
  assert.equal(status, 200);
  assert.equal(json.data.status, "ok");
  assert.equal(json.data.database, "up");
});

test("missing service token returns a JSON 401", async () => {
  const { status, json } = await api("/api/v1/products", { token: null });
  assert.equal(status, 401);
  assert.equal(json.error.code, "UNAUTHORIZED");
  assert.ok(json.error.request_id);
});

test("a valid token reads the product catalogue with stable types", async () => {
  const { status, json } = await api("/api/v1/products?sku=API-001");
  assert.equal(status, 200);
  assert.equal(json.data.length, 1);
  assert.equal(json.data[0].sku, "API-001");
  assert.equal(json.data[0].quantity, 10);
  assert.equal(json.data[0].cost_price, "12.50");
  assert.equal(json.data[0].selling_price, "30.00");
});

test("a token without inventory:write cannot post stock", async () => {
  const { status, json } = await api("/api/v1/stock/movements/bulk", {
    method: "POST",
    token: TOKENS.accounting,
    headers: { "idempotency-key": "scope-check-0001" },
    body: bulkBody(),
  });

  assert.equal(status, 403);
  assert.equal(json.error.code, "FORBIDDEN");
});

test("bulk stock-out works without a session cookie (CSRF bypassed)", async () => {
  const { status, json } = await api("/api/v1/stock/movements/bulk", {
    method: "POST",
    headers: { "idempotency-key": "pos-sale-0001" },
    body: bulkBody({ reference: "INV-1" }),
  });

  assert.equal(status, 201);
  assert.equal(json.data.idempotent_replay, false);
  assert.equal(json.data.lines[0].previous_stock, 10);
  assert.equal(json.data.lines[0].new_stock, 8);
});

test("repeating the same idempotency key does not deduct twice", async () => {
  const before = await models.StockMovement.count({ where: { reference: "INV-1" } });

  const { status, json } = await api("/api/v1/stock/movements/bulk", {
    method: "POST",
    headers: { "idempotency-key": "pos-sale-0001" },
    body: bulkBody({ reference: "INV-1" }),
  });

  assert.equal(status, 200);
  assert.equal(json.data.idempotent_replay, true);

  const afterCount = await models.StockMovement.count({ where: { reference: "INV-1" } });
  assert.equal(afterCount, before);

  const fresh = await models.Product.findByPk(product.id);
  assert.equal(Number(fresh.quantity), 8);
});

test("reusing a key with a different body is rejected", async () => {
  const { status, json } = await api("/api/v1/stock/movements/bulk", {
    method: "POST",
    headers: { "idempotency-key": "pos-sale-0001" },
    body: bulkBody({ reference: "INV-1", lines: [{ sku: "API-001", type: "out", quantity: 3 }] }),
  });

  assert.equal(status, 409);
  assert.equal(json.error.code, "DUPLICATE_REQUEST");
});

test("insufficient stock returns 409 and leaves the balance untouched", async () => {
  const { status, json } = await api("/api/v1/stock/movements/bulk", {
    method: "POST",
    headers: { "idempotency-key": "pos-sale-0002" },
    body: bulkBody({ reference: "INV-2", lines: [{ sku: "API-001", type: "out", quantity: 999 }] }),
  });

  assert.equal(status, 409);
  assert.equal(json.error.code, "INSUFFICIENT_STOCK");

  const fresh = await models.Product.findByPk(product.id);
  assert.equal(Number(fresh.quantity), 8);
});

test("fractional quantities are rejected", async () => {
  const { status, json } = await api("/api/v1/stock/movements/bulk", {
    method: "POST",
    headers: { "idempotency-key": "pos-sale-fraction" },
    body: bulkBody({ reference: "INV-F", lines: [{ sku: "API-001", type: "out", quantity: 1.5 }] }),
  });

  assert.equal(status, 422);
  assert.equal(json.error.code, "VALIDATION_ERROR");
});

test("customer_ref and occurred_at are stored and filterable", async () => {
  const { status } = await api("/api/v1/stock/movements/bulk", {
    method: "POST",
    headers: { "idempotency-key": "pos-sale-0003" },
    body: bulkBody({
      reference: "INV-3",
      customer_ref: "CUST-000987",
      occurred_at: "2026-11-01T10:00:00+08:00",
      lines: [{ sku: "API-001", type: "out", quantity: 1 }],
    }),
  });
  assert.equal(status, 201);

  const { status: listStatus, json } = await api(
    "/api/v1/stock/movements?customer_ref=CUST-000987",
    { token: TOKENS.accounting }
  );

  assert.equal(listStatus, 200);
  assert.equal(json.data.length, 1);
  assert.equal(json.data[0].customer_ref, "CUST-000987");
  assert.equal(json.data[0].source_system, "pos");
  assert.ok(json.data[0].occurred_at.startsWith("2026-11-01T10:00:00"));
});

test("accounting can read the ledger and the valuation", async () => {
  const ledger = await api("/api/v1/stock/movements", { token: TOKENS.accounting });
  assert.equal(ledger.status, 200);
  assert.equal(ledger.json.totals.out_total, 3);

  const valuation = await api("/api/v1/stock/valuation", { token: TOKENS.accounting });
  assert.equal(valuation.status, 200);
  assert.equal(valuation.json.data.lines[0].quantity, 7);
  assert.equal(valuation.json.data.total_value, "87.50");
});

test("concurrent deductions cannot drive stock negative", async () => {
  const requests = ["C1", "C2"].map((suffix) =>
    api("/api/v1/stock/movements/bulk", {
      method: "POST",
      headers: { "idempotency-key": `concurrent-key-${suffix}` },
      body: bulkBody({ reference: `INV-${suffix}`, lines: [{ sku: "API-001", type: "out", quantity: 5 }] }),
    })
  );

  const results = await Promise.all(requests);
  const statuses = results.map((result) => result.status).sort();
  assert.deepEqual(statuses, [201, 409]);

  const fresh = await models.Product.findByPk(product.id);
  assert.equal(Number(fresh.quantity), 2);
});

test("the HTML app still redirects anonymous users to login", async () => {
  const products = await fetch(`${baseUrl}/products`, { redirect: "manual" });
  assert.equal(products.status, 302);
  assert.equal(products.headers.get("location"), "/login");

  const login = await fetch(`${baseUrl}/login`);
  assert.equal(login.status, 200);
});
