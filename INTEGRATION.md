# AquaPiol Integration Guide

This is the contract the POS, Customers Log, HR, and Accounting systems code against.
The machine-readable version is [`openapi.yaml`](./openapi.yaml).

## Base URL

```
http://localhost:3000/api/v1        # local development
https://<host>/api/v1               # production, behind TLS
```

## Authentication

Every endpoint except `GET /health` requires a bearer service token:

```
Authorization: Bearer <token>
```

Tokens live in `.env` as a JSON map and are never stored in the database:

```env
API_TOKENS={"pos":"...","customers":"...","hr":"...","accounting":"..."}
```

| Service | Default scopes |
|---|---|
| `pos` | `inventory:read`, `inventory:write` |
| `customers` | `inventory:read`, `ledger:read` |
| `hr` | `inventory:read`, `ledger:read` |
| `accounting` | `inventory:read`, `ledger:read` |

Missing/invalid token → `401 UNAUTHORIZED`. Valid token without the scope → `403 FORBIDDEN`.
Both are JSON — API clients are never redirected to `/login`.

## Conventions

| Topic | Rule |
|---|---|
| Money | Decimal **string** with 2 places: `"12.50"`. Never a float. |
| Stock quantity | **Integer** whole units. Fractional quantities are rejected with `VALIDATION_ERROR`. |
| Timestamps | ISO-8601 with `+08:00`, e.g. `2026-11-09T15:04:05+08:00`. `Z` is accepted on input. |
| Business key | `sku` (never the numeric `id`). |
| Pagination | `page` (default 1), `per_page` (default 50, max 200 / 500 for the ledger). |
| Request id | Send `X-Request-Id` if you have one; otherwise AquaPiol generates `req_...` and echoes it. |

## Response envelope

Success:

```json
{ "data": {}, "meta": { "request_id": "req_...", "page": 1, "per_page": 50, "total": 123 } }
```

Error:

```json
{ "error": { "code": "INSUFFICIENT_STOCK", "message": "...", "details": null, "request_id": "req_..." } }
```

## Endpoints

| Method | Path | Scope | Used by |
|---|---|---|---|
| GET | `/health` | none | all |
| GET | `/products` | `inventory:read` | POS, Customers Log |
| GET | `/products/{sku}` | `inventory:read` | POS |
| GET | `/categories` | `inventory:read` | POS |
| GET | `/suppliers` | `inventory:read` | POS |
| GET | `/stock/levels` | `inventory:read` | POS |
| POST | `/stock/movements/bulk` | `inventory:write` | POS |
| GET | `/stock/movements` | `ledger:read` | Accounting, Customers Log, HR |
| GET | `/stock/valuation` | `ledger:read` | Accounting |

## Idempotency (read this before writing code)

`POST /stock/movements/bulk` **requires** an `Idempotency-Key` header (8–128 chars).
Use the receipt, order, or document number — one stable key per business event.

- Same key + same body → the stored response is replayed with `idempotent_replay: true` and **no stock change**.
- Same key + different body → `409 DUPLICATE_REQUEST`.
- Keys are retained for `IDEMPOTENCY_TTL_DAYS` (default 7 days).

A retry after a timeout must reuse the same key. Do not generate a new key per attempt.

## Per-system flows

### POS
1. Refresh the catalogue with `GET /products?updated_since=<last sync>`.
2. On a completed sale, send one `out` line per item:

```bash
curl -X POST http://localhost:3000/api/v1/stock/movements/bulk \
  -H "Authorization: Bearer $POS_TOKEN" \
  -H "Idempotency-Key: INV-2026-000123" \
  -H "Content-Type: application/json" \
  -d '{
    "source_system": "pos",
    "reference": "INV-2026-000123",
    "occurred_at": "2026-11-09T15:04:05+08:00",
    "customer_ref": "CUST-000987",
    "lines": [
      { "sku": "BTL-5G-SLIM", "type": "out", "quantity": 2, "reason": "sale" }
    ]
  }'
```

3. On `409 INSUFFICIENT_STOCK`, block the sale or offer a partial sale. Never continue silently.
4. Batch responses are all-or-nothing: one failing line rolls back the whole request.

### Customers Log
- AquaPiol stores only `customer_ref`. There is no customer table.
- To build purchase history, call `GET /stock/movements?customer_ref=CUST-000987&from=...&to=...`.

### HR
- Map the employee once: set `users.external_employee_id` to the HR employee ID.
- Read movements and use `actor.external_employee_id` to attribute withdrawals.
- AquaPiol does not create employees through the API; HR remains the source of truth.

### Accounting
- Pull the period with `GET /stock/movements?from=2026-11-01&to=2026-11-30&per_page=500`.
- Filter by `occurred_at` (business time), not `created_at` (recorded time).
- Every `out` and `adjustment` carries a `unit_cost` snapshot, so COGS is available.
- Ending value: `GET /stock/valuation?as_of=2026-11-30T23:59:59+08:00`.
- `totals` returns `in_total`, `out_total`, and `adjustment_total` (integers).

## Error codes

| Code | HTTP | Meaning |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing or invalid service token |
| `FORBIDDEN` | 403 | Token lacks the required scope |
| `NOT_FOUND` | 404 | Unknown route, SKU, or resource |
| `VALIDATION_ERROR` | 422 | Bad input (fractional quantity, unknown SKU, bad date) |
| `INSUFFICIENT_STOCK` | 409 | Not enough on hand for an `out` line |
| `DUPLICATE_REQUEST` | 409 | Idempotency key reused with a different body |
| `CONFLICT` | 409 | Duplicate reference for the same product/type, or archived product |
| `RATE_LIMITED` | 429 | More than `RATE_LIMIT_PER_MIN` requests; honour `Retry-After` |
| `SERVICE_UNAVAILABLE` | 503 | Database not reachable |

## Operations

- **Rate limit:** `RATE_LIMIT_PER_MIN` (default 120) per service token.
- **Timeouts:** callers should time out at 10s and retry with the same idempotency key.
- **TLS:** production traffic must terminate at a TLS proxy; never send tokens over plain HTTP.
- **Migrations:** `npm run migrate:sql` applies `migrations/*.sql` in order and records them in `schema_migrations`.
  `migrate.js` (which uses `sequelize.sync`) is for local bootstrap only — never run `--alter` against shared data.
- **Backup:** `npm run backup` writes a consistent dump to `backups/`. Test the restore once.
- **Logs:** one JSON line per API call with `request_id`, service, status, and duration.
