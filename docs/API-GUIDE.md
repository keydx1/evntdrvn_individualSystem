# AquaPiol Inventory API — Integration Guide

Guide for the five systems that talk to AquaPiol: **POS**, **Customers Log**, **HR**, **Accounting**, and the **Inventory admin UI**.

- Base URL (local): `http://localhost:3000/api/v1`
- Base URL (LAN): `http://192.168.8.38:3000/api/v1`
- Contract: [`openapi.yaml`](../openapi.yaml)
- Browser guide: `GET /api/v1/docs`
- JSON catalogue: `GET /api/v1`
- Postman: [`postman/`](../postman/)

---

## 1. Authentication

Every call except `/health`, `/`, `/docs` and `/openapi.yaml` needs a bearer token.

```http
Authorization: Bearer <service-token>
```

Tokens live in the server `.env` under `API_TOKENS` (one 64-character token per system):

| System | Token key | Default scopes |
|---|---|---|
| POS | `pos` | `inventory:read`, `inventory:write` |
| Customers Log | `customers` | `inventory:read`, `ledger:read` |
| HR | `hr` | `inventory:read`, `ledger:read` |
| Accounting | `accounting` | `inventory:read`, `ledger:read` |

Scopes:

| Scope | Allows |
|---|---|
| `inventory:read` | products, categories, suppliers, stock levels |
| `inventory:write` | `POST /stock/movements/bulk` |
| `ledger:read` | `GET /stock/movements`, `GET /stock/valuation` |

Verify a token before building against it:

```bash
curl -s http://localhost:3000/api/v1/me -H "Authorization: Bearer $POS_TOKEN"
```

```json
{
  "data": {
    "service": "pos",
    "scopes": ["inventory:read", "inventory:write"],
    "actor": { "id": 5, "name": "pos integration", "email": "pos-system@integration.local" }
  },
  "meta": { "request_id": "req_..." }
}
```

Responses: **401 `UNAUTHORIZED`** when the token is missing/invalid, **403 `FORBIDDEN`** when the scope is missing.

> Tokens are secrets. Keep them in the consumer app's environment, never in the browser bundle or git.

---

## 2. Standard JSON format

**Success**

```json
{
  "data": { },
  "meta": { "request_id": "req_2f1c...", "page": 1, "per_page": 50, "total": 18 }
}
```

**Failure**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more lines are invalid.",
    "details": { "missing_skus": ["NO-SUCH-SKU"] },
    "request_id": "req_2f1c..."
  }
}
```

Field rules (same everywhere):

| Type | Format | Example |
|---|---|---|
| Money | decimal **string**, 2 dp | `"175.00"` |
| Quantity | integer | `12` |
| Ledger `quantity` | signed integer (in `+`, out `-`) | `-3` |
| Timestamps | ISO-8601 with offset | `2026-11-12T09:30:00+08:00` |
| IDs | integer | `7` |
| SKU | uppercase string | `"BTL-5G-SLIM"` |
| Pagination | `page`, `per_page` query → `meta` | `?page=2&per_page=50` |

Always read `error.code` — never parse the message text.

---

## 3. Endpoints by system

### 3.1 POS — sell and deduct

| Method | Path | Scope |
|---|---|---|
| GET | `/products` | `inventory:read` |
| GET | `/products/{sku}` | `inventory:read` |
| GET | `/stock/levels` | `inventory:read` |
| POST | `/stock/movements/bulk` | `inventory:write` |

```bash
curl -s "http://localhost:3000/api/v1/products?per_page=50" \
  -H "Authorization: Bearer $POS_TOKEN"
```

Post a sale (one call per receipt, **all-or-nothing**):

```bash
curl -s -X POST http://localhost:3000/api/v1/stock/movements/bulk \
  -H "Authorization: Bearer $POS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: POS-2026-000451" \
  -d '{
    "source_system": "pos",
    "reference": "POS-2026-000451",
    "customer_ref": "CUST-0001",
    "occurred_at": "2026-11-12T09:30:00+08:00",
    "lines": [
      { "sku": "BW-500-24", "type": "out", "quantity": 2 },
      { "sku": "BTL-5G-SLIM", "type": "out", "quantity": 1 }
    ]
  }'
```

Rules:
- `Idempotency-Key` is **required**; retry with the same key + same body and you get the original result (`idempotent_replay: true`) instead of a double deduction.
- Max 100 lines per request; duplicate `sku`+`type` in one request is rejected.
- `409 INSUFFICIENT_STOCK` → nothing was written; show the shortage and re-order the basket.
- `422 VALIDATION_ERROR` → `details.missing_skus` lists unknown or archived SKUs.

### 3.2 Customers Log — reference and history

| Method | Path | Scope |
|---|---|---|
| GET | `/stock/movements?customer_ref={ref}` | `ledger:read` |
| GET | `/products/{sku}` | `inventory:read` |

AquaPiol stores only `customer_ref` (max 64 chars) on a movement — the customer master stays in Customers Log.

```bash
curl -s "http://localhost:3000/api/v1/stock/movements?customer_ref=CUST-0001&from=2026-11-01&to=2026-11-30&per_page=100" \
  -H "Authorization: Bearer $CUSTOMERS_TOKEN"
```

### 3.3 HR — employee attribution

| Method | Path | Scope |
|---|---|---|
| GET | `/stock/movements` | `ledger:read` |

Every ledger row carries `recorded_by` and `employee_ref` (from `users.external_employee_id`). HR remains the employee master; link an employee once with:

```bash
npm run employee:map -- --email staff@aquapiol.local --employee-id EMP-0042
```

### 3.4 Accounting — reconcile value

| Method | Path | Scope |
|---|---|---|
| GET | `/stock/movements` | `ledger:read` |
| GET | `/stock/valuation` | `ledger:read` |

```bash
curl -s "http://localhost:3000/api/v1/stock/movements?from=2026-11-01&to=2026-11-30&per_page=500" \
  -H "Authorization: Bearer $ACCOUNTING_TOKEN"

curl -s "http://localhost:3000/api/v1/stock/valuation?as_of=2026-11-30T23:59:59%2B08:00" \
  -H "Authorization: Bearer $ACCOUNTING_TOKEN"
```

`/stock/movements` returns `meta.totals` with `in_total`, `out_total`, `adjustment_total`. `per_page` is capped at 500; page through with `meta.total`.

### 3.5 Inventory admin UI (humans)

Served by the same server at `/` (session + CSRF), not by the API. Roles and permissions are managed in **Administration → Roles & permissions**.

---

## 4. Errors, limits, retries

| Code | HTTP | Meaning | Consumer action |
|---|---|---|---|
| `UNAUTHORIZED` | 401 | Missing/invalid token | Fix configuration |
| `FORBIDDEN` | 403 | Token lacks the scope | Use the right system token |
| `NOT_FOUND` | 404 | No such route/product | Stop retrying |
| `VALIDATION_ERROR` | 422 | Bad payload | Fix payload, do not retry as-is |
| `INSUFFICIENT_STOCK` | 409 | Not enough stock | Nothing written; adjust and resend |
| `DUPLICATE_REQUEST` | 409 | Same idempotency key, different body | Use a new key |
| `RATE_LIMITED` | 429 | Over `RATE_LIMIT_PER_MIN` (default 120/min per service) | Wait for `Retry-After` seconds |
| `INTERNAL_ERROR` | 500 | Server fault | Retry with backoff, include `request_id` |
| `SERVICE_UNAVAILABLE` | 503 | Database down | Retry with backoff |

Include the `request_id` from the response when reporting a problem — the server logs the same id.

---

## 5. Postman

1. Import `postman/AquaPiol-Integration.postman_collection.json`.
2. Import `postman/AquaPiol-Local.postman_environment.json` and select it.
3. Paste the tokens from the server `.env` (`API_TOKENS`) into `posToken`, `customersToken`, `hrToken`, `accountingToken`.
4. Run **00 · Health & identity** first, then the folder for your system.
5. Collection Runner can run every folder; POS writes use a fresh `Idempotency-Key` per run.

---

## 6. Five-developer checklist

| Developer | First call | Definition of done |
|---|---|---|
| POS | `GET /products` | A sale posts, retry produces no double deduction, `409` is handled |
| Customers Log | `GET /stock/movements?customer_ref=` | Customer history matches a known receipt |
| HR | `GET /stock/movements` | Movements show the right `employee_ref` |
| Accounting | `GET /stock/valuation` | Totals reconcile with the ledger for the same range |
| Inventory admin | `/roles` | Roles, permissions and users behave as configured |
