import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = path.join(__dirname, "..", "..", "openapi.yaml");

export const API_CONVENTIONS = {
  currency: "PHP",
  money_format: "decimal string with 2 dp, e.g. \"175.00\"",
  quantity_format: "positive integer; ledger `quantity` is signed (in = +, out = -)",
  timestamp_format: "ISO-8601 with offset, e.g. \"2026-11-12T09:30:00+08:00\"",
  pagination: "page / per_page query params; meta carries page, per_page, total",
  idempotency: "POST /stock/movements/bulk requires an Idempotency-Key header",
};

export const API_SYSTEMS = [
  {
    key: "pos",
    name: "POS",
    purpose: "Sell items and deduct stock as the sale happens.",
    scopes: ["inventory:read", "inventory:write"],
    endpoints: [
      { method: "GET", path: "/products", scope: "inventory:read", summary: "Catalogue with selling and cost prices" },
      { method: "GET", path: "/products/{sku}", scope: "inventory:read", summary: "One product with its on-hand balance" },
      { method: "GET", path: "/stock/levels", scope: "inventory:read", summary: "On-hand quantity per SKU" },
      { method: "POST", path: "/stock/movements/bulk", scope: "inventory:write", summary: "Post a sale, all-or-nothing, idempotent" },
    ],
  },
  {
    key: "customers",
    name: "Customers Log",
    purpose: "Reference the customer on stock going out and read their history.",
    scopes: ["inventory:read", "ledger:read"],
    endpoints: [
      { method: "GET", path: "/stock/movements?customer_ref={ref}", scope: "ledger:read", summary: "Every movement tagged with that customer" },
      { method: "GET", path: "/products/{sku}", scope: "inventory:read", summary: "Product context for a ledger line" },
    ],
  },
  {
    key: "hr",
    name: "HR",
    purpose: "Attribute stock movements to employees; HR stays the employee master.",
    scopes: ["inventory:read", "ledger:read"],
    endpoints: [
      { method: "GET", path: "/stock/movements", scope: "ledger:read", summary: "Ledger rows carrying employee_ref" },
      { method: "GET", path: "/products", scope: "inventory:read", summary: "Catalogue reference data" },
    ],
  },
  {
    key: "accounting",
    name: "Accounting",
    purpose: "Reconcile inventory value against the movement ledger.",
    scopes: ["inventory:read", "ledger:read"],
    endpoints: [
      { method: "GET", path: "/stock/movements", scope: "ledger:read", summary: "Paged ledger with in/out/adjustment totals" },
      { method: "GET", path: "/stock/valuation", scope: "ledger:read", summary: "Valuation snapshot as of a date" },
    ],
  },
];

const PUBLIC_ENDPOINTS = [
  { method: "GET", path: "/health", scope: "public", summary: "Liveness and database check" },
  { method: "GET", path: "/", scope: "public", summary: "This catalogue" },
  { method: "GET", path: "/docs", scope: "public", summary: "Human-readable API guide" },
  { method: "GET", path: "/openapi.yaml", scope: "public", summary: "OpenAPI 3.0.3 specification" },
];

const AUTHENTICATED_ENDPOINTS = [
  { method: "GET", path: "/me", scope: "any", summary: "Token identity, scopes and actor account" },
  { method: "GET", path: "/products", scope: "inventory:read", summary: "Paged product catalogue" },
  { method: "GET", path: "/products/{sku}", scope: "inventory:read", summary: "Single product by SKU" },
  { method: "GET", path: "/categories", scope: "inventory:read", summary: "Product categories" },
  { method: "GET", path: "/suppliers", scope: "inventory:read", summary: "Suppliers" },
  { method: "GET", path: "/stock/levels", scope: "inventory:read", summary: "On-hand stock per SKU" },
  { method: "GET", path: "/stock/movements", scope: "ledger:read", summary: "Immutable stock ledger with totals" },
  { method: "POST", path: "/stock/movements/bulk", scope: "inventory:write", summary: "Batch stock movements (idempotent)" },
  { method: "GET", path: "/stock/valuation", scope: "ledger:read", summary: "Inventory valuation snapshot" },
];

export const apiIndex = (req, res) =>
  res.json({
    data: {
      name: "AquaPiol Inventory API",
      version: "1.0.0",
      base_url: `${req.protocol}://${req.get("host")}/api/v1`,
      authentication: {
        scheme: "Bearer service token",
        header: "Authorization: Bearer <token>",
        scopes: ["inventory:read", "inventory:write", "ledger:read"],
        note: "Tokens are per system: pos, customers, hr, accounting.",
      },
      conventions: API_CONVENTIONS,
      systems: API_SYSTEMS,
      endpoints: [...PUBLIC_ENDPOINTS, ...AUTHENTICATED_ENDPOINTS],
      documentation: { guide: "docs/API-GUIDE.md", html: "/api/v1/docs", openapi: "/api/v1/openapi.yaml", postman: "postman/" },
    },
    meta: { request_id: req.id ?? null, generated_at: new Date().toISOString() },
  });

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);

const endpointRows = (endpoints) =>
  endpoints
    .map(
      (endpoint) => `<tr>
        <td><span class="method ${endpoint.method.toLowerCase()}">${escapeHtml(endpoint.method)}</span></td>
        <td><code>${escapeHtml(endpoint.path)}</code></td>
        <td>${escapeHtml(endpoint.scope)}</td>
        <td>${escapeHtml(endpoint.summary)}</td>
      </tr>`
    )
    .join("");

export const apiDocs = (req, res) => {
  const systems = API_SYSTEMS.map(
    (system) => `<section class="card">
      <h3>${escapeHtml(system.name)}</h3>
      <p>${escapeHtml(system.purpose)}</p>
      <p class="scopes">Scopes: ${system.scopes.map((scope) => `<code>${escapeHtml(scope)}</code>`).join(" ")}</p>
      <table><thead><tr><th>Method</th><th>Path</th><th>Scope</th><th>Purpose</th></tr></thead>
      <tbody>${endpointRows(system.endpoints)}</tbody></table>
    </section>`
  ).join("");

  res.type("html").send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AquaPiol Inventory API</title>
<style>
  :root{color-scheme:light dark}body{font:15px/1.55 system-ui,-apple-system,Segoe UI,sans-serif;margin:0;padding:32px;max-width:1080px;background:#f7fafc;color:#1a202c}
  h1{margin:0 0 4px;font-size:26px}h2{margin-top:36px;font-size:19px}h3{margin:0 0 6px;font-size:16px}
  .lede{color:#4a5568;margin:0 0 8px}.card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px 18px;margin:12px 0}
  table{width:100%;border-collapse:collapse;margin-top:10px;font-size:13.5px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #edf2f7}
  th{color:#4a5568;font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:.04em}
  code{background:#edf2f7;border-radius:4px;padding:1px 5px;font-size:12.5px}
  .method{font-weight:700;font-size:11px;padding:2px 7px;border-radius:999px;background:#e2e8f0}
  .method.get{background:#c6f6d5;color:#22543d}.method.post{background:#bee3f8;color:#2a4365}
  .scopes{margin:6px 0 0;color:#4a5568}.note{background:#fffaf0;border-color:#fbd38d}
  a{color:#2b6cb0}
</style></head>
<body>
  <h1>AquaPiol Inventory API</h1>
  <p class="lede">Service-to-service REST API at <code>/api/v1</code>. Authenticate with a per-system bearer token.</p>
  <p class="lede">Full guide: <code>docs/API-GUIDE.md</code> &middot; <a href="/api/v1/openapi.yaml">OpenAPI 3.0.3</a> &middot; <a href="/api/v1">JSON catalogue</a></p>

  <h2>Authentication</h2>
  <div class="card">
    <p><code>Authorization: Bearer &lt;token&gt;</code> &mdash; tokens live in <code>API_TOKENS</code> in the server <code>.env</code>.</p>
    <p>Scopes: <code>inventory:read</code>, <code>inventory:write</code>, <code>ledger:read</code>. Missing token &rarr; <code>401 UNAUTHORIZED</code>; missing scope &rarr; <code>403 FORBIDDEN</code>.</p>
    <p>Verify a token with <code>GET /api/v1/me</code>.</p>
  </div>

  <h2>Standard JSON format</h2>
  <div class="card">
    <p>Success: <code>{ "data": ..., "meta": { "request_id": "req_..." } }</code></p>
    <p>Failure: <code>{ "error": { "code": "...", "message": "...", "details": ..., "request_id": "req_..." } }</code></p>
    <p>Money is always a decimal string (<code>"175.00"</code>); quantities are integers; timestamps are ISO-8601 with offset (<code>+08:00</code>).</p>
  </div>

  <h2>Endpoints by system</h2>
  ${systems}

  <h2>Public endpoints</h2>
  <div class="card"><table><thead><tr><th>Method</th><th>Path</th><th>Scope</th><th>Purpose</th></tr></thead>
  <tbody>${endpointRows(PUBLIC_ENDPOINTS)}</tbody></table></div>

  <h2>Every authenticated endpoint</h2>
  <div class="card"><table><thead><tr><th>Method</th><th>Path</th><th>Scope</th><th>Purpose</th></tr></thead>
  <tbody>${endpointRows(AUTHENTICATED_ENDPOINTS)}</tbody></table></div>
</body></html>`);
};

export const apiSpec = (req, res) => res.type("text/yaml").sendFile(SPEC_PATH);

export const apiMe = (req, res) =>
  res.json({
    data: {
      service: req.service.name,
      scopes: req.service.scopes,
      actor: {
        id: req.serviceUser?.id ?? null,
        name: req.serviceUser?.name ?? null,
        email: req.serviceUser?.email ?? null,
      },
    },
    meta: { request_id: req.id ?? null },
  });
