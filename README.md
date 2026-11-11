# AquaPiol Water Refilling Station — Inventory Management System

A complete inventory module for **AquaPiol Water Refilling Station**, built with the
**XianFire Framework** (Express + Sequelize + MySQL + `.xian` Handlebars views).

The system tracks bottles, caps, seals, labels, water-treatment parts, cleaning supplies
and office consumables. Every balance change is written to an auditable stock ledger.

---

## Features

| Area | What it does |
|---|---|
| **Authentication** | Session login, bcrypt password hashing, CSRF protection, admin/staff roles |
| **Dashboard** | Total stocks, low stocks, out-of-stock products, inventory value, recent activity, category breakdown |
| **Low stock alerts** | Dedicated alerts page with supplier contacts and shortfall per product; notification badge in the sidebar and top bar |
| **Products** | Search, category/status filters, pagination, SKU uniqueness, cost/selling prices, reorder points, opening stock, delete (when there is no history), archive/restore |
| **Stock ledger** | Stock in, stock out and physical-count adjustments; previous/new balances, references, supplier, user, notes |
| **Stock safety** | Transactional row locking, no negative stock, required adjustment reasons, archived products locked from movements |
| **Categories** | Create/edit/delete; deletion blocked while products use the category |
| **Suppliers** | Contact directory, linked product counts, deletion blocked when linked to products or history |
| **Reports** | Daily, weekly and monthly inventory reports with a custom range, valuation by category, retail value, low-stock watchlist, per-day movement breakdown |
| **CSV exports** | Product valuation and stock-movement reports, Excel-friendly UTF-8 BOM |
| **User management** | Admin-only account creation, role changes, password resets, activation/deactivation, last-admin safeguard |
| **UI** | Responsive local design system, mobile sidebar, live stock preview, no CDN dependency |

---

## Quick Start

### 1. Start MySQL

Use XAMPP, Laragon, or any local MySQL/MariaDB server. The defaults expect:

```text
host: 127.0.0.1
port: 3306
user: root
password: (empty)
```

If your credentials differ, copy `.env.example` to `.env` and edit it.

### 2. Install and set up

```bash
cd aquapiol
npm install
npm run setup
npm run migrate:sql
```

`npm run setup` runs the migration (creates the database and tables) and seeds demo data.
It is safe to run again: existing tables are verified and existing seed rows are skipped.

`npm run migrate:sql` applies the SQL migrations in `migrations/` and **is required**: it creates
the `roles` table used by RBAC (005) and the read-only reporting views (004), plus the API
indexes. Without it the user pages fail and the shared views in `SHARED-DB-ACCESS.txt` will not exist.
It is idempotent, so run it again after every pull that changes `migrations/`.

### 3. Run

```bash
npm start
```

Open **http://localhost:3000**.

For hot reload:

```bash
npm run dev
```

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@aquapiol.local` | `Admin@12345` |
| Staff | `staff@aquapiol.local` | `Staff@12345` |

> Change these credentials before using the system with real station data.

---

## Environment Variables

Copy `.env.example` to `.env`. The app loads `.env` automatically through Node's
`process.loadEnvFile()`.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `SESSION_SECRET` | development fallback | Session signing secret — set this in production |
| `DB_HOST` | `127.0.0.1` | MySQL host |
| `DB_PORT` | `3306` | MySQL port |
| `DB_NAME` | `aquapiol_inventory` | Database name |
| `DB_USER` | `root` | Database user |
| `DB_PASSWORD` | empty | Database password |
| `DB_TIMEZONE` | `+08:00` | Database timezone offset (Philippines) |

---

## Commands

```bash
npm start                 # start the app
npm run dev               # start with nodemon
npm run migrate           # create/verify database and tables
npm run seed              # load demo categories, suppliers, products and users
npm run setup             # migrate + seed
npm test                  # end-to-end tests against a disposable test database
npm run route:list        # print registered Express routes
npm run create:model X    # XianFire model generator
npm run create:controller X
```

The generated `xian` CLI is also available:

```bash
node bin/xian.js migrate
node bin/xian.js dev
node bin/xian.js route:list
```

---

## Inventory Rules

- **Stock changes only through the ledger.** Product edit forms cannot silently overwrite balances.
- **Stock in** adds units, optionally updates the product cost price, and can record a supplier and reference.
- **Stock out** cannot exceed the current balance.
- **Adjustments** record the counted quantity, calculate the difference, and require a reason.
- Every movement stores the previous balance, new balance, timestamp, reference, notes and the user who recorded it.
- Products with no stock history can be **deleted**. Once a product has movements it must be **archived**, so historical movements remain readable.
- Categories cannot be deleted while products use them; suppliers cannot be deleted while linked to products or movements.
- Only administrators can archive products, delete categories/suppliers and manage user accounts.
- The last active administrator cannot be demoted or deactivated.

---

## Data Model

```text
User ──< StockMovement >── Product >── Category
                         └── Supplier
Supplier ──< Product
```

| Table | Key fields |
|---|---|
| `users` | name, email (unique), password hash, role (`admin`/`staff`), isActive |
| `categories` | name (unique), description |
| `suppliers` | name (unique), contact person, phone, email, address, notes |
| `products` | sku (unique), name, category, supplier, unit, quantity, reorder level, cost/selling price, location |
| `stock_movements` | product, user, supplier, type (`in`/`out`/`adjustment`), signed change, previous/new stock, unit cost, reference, notes |

### Important routes

| Method | Path | Purpose |
|---|---|---|
| `GET/POST` | `/login` | Sign in |
| `POST` | `/logout` | End session |
| `GET` | `/` | Dashboard |
| `GET` | `/alerts` | Low stock and out-of-stock alerts |
| `GET` | `/products` | Product catalogue with filters |
| `GET/POST` | `/products/new`, `/products` | Create product |
| `GET/POST` | `/products/:id`, `/products/:id/edit` | Detail / update |
| `POST` | `/products/:id/archive` | Archive or restore (admin) |
| `GET` | `/stock` | Movement ledger |
| `GET/POST` | `/stock/in`, `/stock/out`, `/stock/adjust` | Record a movement |
| `GET/POST` | `/categories`, `/suppliers` | Directory management |
| `GET` | `/reports` | Valuation, low stock and movement reports |
| `GET` | `/reports/export/products`, `/reports/export/movements` | CSV downloads |
| `GET/POST` | `/users`, `/users/:id/edit` | Account management (admin) |

---

## Project Structure

```text
aquapiol/
├── bin/xian.js             # XianFire CLI wrapper
├── controllers/            # auth, dashboard, product, category, supplier, stock, report, user
├── middleware/             # auth/role guards, CSRF, 404 + error handler
├── models/                 # Sequelize models and associations
├── public/                 # local CSS, JS, favicon
├── routes/index.js         # route registration
├── services/stockService.js# transactional stock ledger
├── tests/inventory.test.js # end-to-end HTTP tests
├── utils/                  # validation, formatting, Handlebars helpers
├── views/                  # .xian pages and partials
├── index.js                # Express app entry
├── migrate.js              # database/table creation
├── seed.js                 # idempotent demo data
└── create.js, list-routes.js
```

---

## Testing

```bash
npm test
```

The suite creates a disposable `aquapiol_inventory_test` database, runs the real Express
app on an ephemeral port and verifies:

- anonymous redirects and login rejection
- CSRF enforcement
- admin login and dashboard rendering
- product creation with an opening ledger row
- duplicate SKU validation
- stock in, over-release prevention and adjustments
- required adjustment reasons
- category/supplier creation and safe deletion
- CSV exports
- staff restrictions and admin-only archiving

The test database is dropped when the suite finishes. Do not point `TEST_DB_NAME` at a
production database.

---

## Operational Notes

- The app uses `express-session`'s in-memory store, which is fine for a single local
  deployment. For multiple instances or production, use a shared session store (Redis,
  MySQL, etc.) and set a strong `SESSION_SECRET`.
- `sequelize.sync()` is used for simplicity. For a production rollout, replace it with
  versioned migrations and scheduled database backups.
- Start MySQL before the app. If the app cannot connect, run `npm run setup` after
  checking the values in `.env`.
- CSV files are UTF-8 with a BOM so they open correctly in Excel.

---

Built with the **XianFire Framework** — Mindoro State University, Philippines.
