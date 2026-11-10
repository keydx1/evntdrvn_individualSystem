process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "aquapiol-test-secret";
process.env.DB_NAME = process.env.TEST_DB_NAME || "aquapiol_inventory_test";

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

const DB_NAME = process.env.DB_NAME;
const DB_HOST = process.env.DB_HOST || "127.0.0.1";
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || "";

let server;
let baseUrl;
let models;
let appModule;
let seeded;

const assertSafeTestDatabase = () => {
  if (!/^aquapiol_[a-z0-9_]*_test$/.test(DB_NAME)) {
    throw new Error(`Refusing to use unsafe test database name: ${DB_NAME}`);
  }
};

const adminDbConnection = () =>
  mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
  });

const createClient = () => {
  const cookies = new Map();

  return async (path, { method = "GET", form = null } = {}) => {
    const headers = {};
    if (cookies.size) {
      headers.cookie = [...cookies.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
    }

    let body;
    if (form) {
      body = new URLSearchParams(form).toString();
      headers["content-type"] = "application/x-www-form-urlencoded";
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body,
      redirect: "manual",
    });

    const setCookies = response.headers.getSetCookie?.() || [];
    for (const cookie of setCookies) {
      const [pair] = cookie.split(";");
      const separator = pair.indexOf("=");
      cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }

    return response;
  };
};

const csrfFrom = async (client, path = "/products/new") => {
  const response = await client(path);
  assert.equal(response.status, 200, `Expected ${path} to render`);
  const html = await response.text();
  const match = html.match(/name="_csrf" value="([^"]+)"/);
  assert.ok(match, "Expected a CSRF token in the rendered form");
  return { token: match[1], html };
};

const login = async (client, email, password) => {
  const page = await client("/login");
  const html = await page.text();
  const match = html.match(/name="_csrf" value="([^"]+)"/);
  assert.ok(match, "Login form should include a CSRF token");

  const response = await client("/login", {
    method: "POST",
    form: { _csrf: match[1], email, password },
  });

  return response;
};

before(async () => {
  assertSafeTestDatabase();

  const root = await adminDbConnection();
  await root.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\``);
  await root.query(
    `CREATE DATABASE \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await root.end();

  models = await import("../models/index.js");
  await models.sequelize.sync({ force: true });

  const { User, Category, Supplier, Product } = models;

  const admin = await User.create({
    name: "Test Admin",
    email: "admin@aquapiol.test",
    password: await bcrypt.hash("Admin@12345", 4),
    role: "admin",
  });

  await User.create({
    name: "Test Staff",
    email: "staff@aquapiol.test",
    password: await bcrypt.hash("Staff@12345", 4),
    role: "staff",
  });

  const category = await Category.create({
    name: "Test Bottles",
    description: "Automated test category",
  });

  const supplier = await Supplier.create({
    name: "Test Supplier Co",
    contactPerson: "Test Contact",
    email: "supplier@example.com",
  });

  const product = await Product.create({
    sku: "TEST-BASE",
    name: "Test Base Bottle",
    categoryId: category.id,
    supplierId: supplier.id,
    unit: "piece",
    quantity: 10,
    reorderLevel: 3,
    costPrice: 50,
    sellingPrice: 80,
    location: "Test shelf",
  });

  seeded = { admin, category, supplier, product };

  appModule = await import("../index.js");
  server = await appModule.startServer(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  if (models) await models.sequelize.close();

  const root = await adminDbConnection();
  await root.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\``);
  await root.end();
});

test("anonymous users are redirected to the login page", async () => {
  const client = createClient();
  const response = await client("/products");

  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/login");
});

test("invalid credentials are rejected with a friendly message", async () => {
  const client = createClient();
  const response = await login(client, "admin@aquapiol.test", "wrong-password");
  const html = await response.text();

  assert.equal(response.status, 422);
  assert.match(html, /Invalid email or password/);
});

test("a POST without a CSRF token is rejected", async () => {
  const client = createClient();
  await login(client, "admin@aquapiol.test", "Admin@12345");

  const response = await client("/stock/out", {
    method: "POST",
    form: { productId: String(seeded.product.id), quantity: "1" },
  });

  assert.equal(response.status, 403);
  assert.match(await response.text(), /Session expired/);
});

test("admin signs in and sees the seeded inventory dashboard", async () => {
  const client = createClient();
  const response = await login(client, "admin@aquapiol.test", "Admin@12345");

  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/");

  const dashboard = await client("/");
  const html = await dashboard.text();

  assert.equal(dashboard.status, 200);
  assert.match(html, /Test Bottles/);
  assert.match(html, /Active products/);
  assert.match(html, /Units on hand/);
});

test("product creation records an opening balance and ledger row", async () => {
  const client = createClient();
  await login(client, "admin@aquapiol.test", "Admin@12345");
  const { token } = await csrfFrom(client);

  const response = await client("/products", {
    method: "POST",
    form: {
      _csrf: token,
      sku: "TEST-NEW",
      name: "Test New Product",
      categoryId: String(seeded.category.id),
      supplierId: String(seeded.supplier.id),
      unit: "piece",
      reorderLevel: "4",
      costPrice: "25.50",
      sellingPrice: "40.00",
      location: "Test shelf 2",
      description: "Created by automated test",
      openingQuantity: "20",
      openingUnitCost: "25.50",
    },
  });

  assert.equal(response.status, 302);
  assert.match(response.headers.get("location"), /^\/products\/\d+$/);

  const product = await models.Product.findOne({ where: { sku: "TEST-NEW" } });
  assert.ok(product);
  assert.equal(Number(product.quantity), 20);

  const movement = await models.StockMovement.findOne({
    where: { productId: product.id, type: "in" },
  });
  assert.ok(movement);
  assert.equal(movement.quantity, 20);
  assert.equal(Number(movement.unitCost), 25.5);
});

test("duplicate SKUs are rejected", async () => {
  const client = createClient();
  await login(client, "admin@aquapiol.test", "Admin@12345");
  const { token } = await csrfFrom(client);

  const response = await client("/products", {
    method: "POST",
    form: {
      _csrf: token,
      sku: "TEST-NEW",
      name: "Duplicate Product",
      categoryId: String(seeded.category.id),
      unit: "piece",
      reorderLevel: "1",
      costPrice: "1",
      sellingPrice: "2",
      openingQuantity: "0",
    },
  });

  assert.equal(response.status, 422);
  assert.match(await response.text(), /SKU already exists/);
});

test("stock in updates the balance, cost and audited movement", async () => {
  const client = createClient();
  await login(client, "admin@aquapiol.test", "Admin@12345");
  const { token } = await csrfFrom(client, "/stock/in");
  const product = await models.Product.findOne({ where: { sku: "TEST-NEW" } });

  const response = await client("/stock/in", {
    method: "POST",
    form: {
      _csrf: token,
      productId: String(product.id),
      quantity: "5",
      unitCost: "26.00",
      supplierId: String(seeded.supplier.id),
      reference: "TEST-IN",
      notes: "Automated delivery",
    },
  });

  assert.equal(response.status, 302);

  await product.reload();
  assert.equal(Number(product.quantity), 25);
  assert.equal(Number(product.costPrice), 26);

  const movement = await models.StockMovement.findOne({
    where: { productId: product.id, reference: "TEST-IN" },
  });
  assert.ok(movement);
  assert.equal(movement.quantity, 5);
  assert.equal(movement.previousStock, 20);
  assert.equal(movement.newStock, 25);
  assert.equal(movement.userId, seeded.admin.id);
});

test("stock out prevents releasing more than is on hand", async () => {
  const client = createClient();
  await login(client, "admin@aquapiol.test", "Admin@12345");
  const { token } = await csrfFrom(client, "/stock/out");
  const product = await models.Product.findOne({ where: { sku: "TEST-NEW" } });

  const response = await client("/stock/out", {
    method: "POST",
    form: {
      _csrf: token,
      productId: String(product.id),
      quantity: "999",
      reference: "TOO-MUCH",
    },
  });

  assert.equal(response.status, 422);
  assert.match(await response.text(), /currently on hand/);

  await product.reload();
  assert.equal(Number(product.quantity), 25);
});

test("stock out and adjustment keep the ledger and balance consistent", async () => {
  const client = createClient();
  await login(client, "admin@aquapiol.test", "Admin@12345");
  const { token } = await csrfFrom(client, "/stock/out");
  const product = await models.Product.findOne({ where: { sku: "TEST-NEW" } });

  const outResponse = await client("/stock/out", {
    method: "POST",
    form: {
      _csrf: token,
      productId: String(product.id),
      quantity: "7",
      reference: "TEST-OUT",
      notes: "Automated release",
    },
  });
  assert.equal(outResponse.status, 302);

  await product.reload();
  assert.equal(Number(product.quantity), 18);

  const adjustResponse = await client("/stock/adjust", {
    method: "POST",
    form: {
      _csrf: token,
      productId: String(product.id),
      newQuantity: "15",
      reference: "TEST-ADJ",
      notes: "Physical count after automated test",
    },
  });
  assert.equal(adjustResponse.status, 302);

  await product.reload();
  assert.equal(Number(product.quantity), 15);

  const adjustment = await models.StockMovement.findOne({
    where: { productId: product.id, reference: "TEST-ADJ" },
  });
  assert.ok(adjustment);
  assert.equal(adjustment.quantity, -3);
  assert.equal(adjustment.previousStock, 18);
  assert.equal(adjustment.newStock, 15);

  const noChange = await client("/stock/adjust", {
    method: "POST",
    form: {
      _csrf: token,
      productId: String(product.id),
      newQuantity: "15",
      notes: "No-op count",
    },
  });
  assert.equal(noChange.status, 422);
  assert.match(await noChange.text(), /matches the current stock/);
});

test("every stock form posts to the route that exists", async () => {
  const client = createClient();
  await login(client, "admin@aquapiol.test", "Admin@12345");

  for (const page of ["/stock/in", "/stock/out", "/stock/adjust"]) {
    const response = await client(page);
    const html = await response.text();
    assert.match(html, new RegExp(`<form[^>]*action="${page}"`), `${page} should post back to itself`);
  }
});

test("adjustments require a reason", async () => {
  const client = createClient();
  await login(client, "admin@aquapiol.test", "Admin@12345");
  const { token } = await csrfFrom(client, "/stock/adjust");
  const product = await models.Product.findOne({ where: { sku: "TEST-NEW" } });

  const response = await client("/stock/adjust", {
    method: "POST",
    form: {
      _csrf: token,
      productId: String(product.id),
      newQuantity: "12",
      notes: "",
    },
  });

  assert.equal(response.status, 422);
  assert.match(await response.text(), /Reason for adjustment is required/);
  await product.reload();
  assert.equal(Number(product.quantity), 15);
});

test("category and supplier records can be created and safely deleted", async () => {
  const client = createClient();
  await login(client, "admin@aquapiol.test", "Admin@12345");
  const { token } = await csrfFrom(client);

  const categoryResponse = await client("/categories", {
    method: "POST",
    form: { _csrf: token, name: "Temporary Category", description: "Delete me" },
  });
  assert.equal(categoryResponse.status, 302);

  const supplierResponse = await client("/suppliers", {
    method: "POST",
    form: {
      _csrf: token,
      name: "Temporary Supplier",
      contactPerson: "Temp",
      email: "temp@example.com",
    },
  });
  assert.equal(supplierResponse.status, 302);

  const category = await models.Category.findOne({ where: { name: "Temporary Category" } });
  const supplier = await models.Supplier.findOne({ where: { name: "Temporary Supplier" } });
  assert.ok(category);
  assert.ok(supplier);

  const deleteCategory = await client(`/categories/${category.id}/delete`, {
    method: "POST",
    form: { _csrf: token },
  });
  assert.equal(deleteCategory.status, 302);

  const deleteSupplier = await client(`/suppliers/${supplier.id}/delete`, {
    method: "POST",
    form: { _csrf: token },
  });
  assert.equal(deleteSupplier.status, 302);

  assert.equal(await models.Category.count({ where: { name: "Temporary Category" } }), 0);
  assert.equal(await models.Supplier.count({ where: { name: "Temporary Supplier" } }), 0);
});

test("CSV exports return downloadable inventory data", async () => {
  const client = createClient();
  await login(client, "admin@aquapiol.test", "Admin@12345");

  const products = await client("/reports/export/products");
  assert.equal(products.status, 200);
  assert.match(products.headers.get("content-type"), /text\/csv/);
  assert.match(products.headers.get("content-disposition"), /attachment/);
  const productsCsv = await products.text();
  assert.match(productsCsv, /TEST-NEW/);
  assert.match(productsCsv, /Test Base Bottle/);

  const movements = await client("/reports/export/movements");
  assert.equal(movements.status, 200);
  assert.match(movements.headers.get("content-type"), /text\/csv/);
  const movementsCsv = await movements.text();
  assert.match(movementsCsv, /TEST-IN/);
  assert.match(movementsCsv, /TEST-OUT/);
});

test("logout destroys the session and clears the station cookie", async () => {
  const client = createClient();
  await login(client, "admin@aquapiol.test", "Admin@12345");
  const { token } = await csrfFrom(client);

  const response = await client("/logout", {
    method: "POST",
    form: { _csrf: token },
  });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/login");
  assert.ok(
    (response.headers.getSetCookie?.() || []).some((cookie) => cookie.startsWith("aquapiol.sid=;")),
    "Expected the session cookie to be cleared"
  );

  const products = await client("/products");
  assert.equal(products.status, 302);
  assert.equal(products.headers.get("location"), "/login");
});

test("staff can work with inventory but cannot open user administration", async () => {
  const client = createClient();
  const response = await login(client, "staff@aquapiol.test", "Staff@12345");
  assert.equal(response.status, 302);

  const products = await client("/products");
  assert.equal(products.status, 200);

  const productsHtml = await products.text();
  assert.doesNotMatch(
    productsHtml,
    /Add product/,
    "Staff must not be offered product management buttons"
  );
  assert.doesNotMatch(productsHtml, /href="\/users"/, "Staff must not see the administration nav");

  const users = await client("/users");
  assert.equal(users.status, 403);
  assert.match(await users.text(), /Access denied/);
});

test("only administrators can archive products", async () => {
  const staffClient = createClient();
  await login(staffClient, "staff@aquapiol.test", "Staff@12345");
  // Staff may not open /products/new, so take the token from a staff page.
  const { token: staffToken } = await csrfFrom(staffClient, "/stock/in");
  const product = await models.Product.findOne({ where: { sku: "TEST-NEW" } });

  const forbidden = await staffClient(`/products/${product.id}/archive`, {
    method: "POST",
    form: { _csrf: staffToken },
  });
  assert.equal(forbidden.status, 403);

  const adminClient = createClient();
  await login(adminClient, "admin@aquapiol.test", "Admin@12345");
  const { token: adminToken } = await csrfFrom(adminClient);

  const archived = await adminClient(`/products/${product.id}/archive`, {
    method: "POST",
    form: { _csrf: adminToken },
  });
  assert.equal(archived.status, 302);

  await product.reload();
  assert.equal(product.isActive, false);

  const stockPage = await adminClient("/stock/in");
  assert.doesNotMatch(await stockPage.text(), /TEST-NEW/);
});
