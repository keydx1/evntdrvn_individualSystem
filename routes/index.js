import express from "express";
import { loginPage, loginUser, logoutUser } from "../controllers/authController.js";
import { dashboardPage } from "../controllers/dashboardController.js";
import { alertPage } from "../controllers/alertController.js";
import {
  productCreate,
  productCreatePage,
  productDelete,
  productEditPage,
  productIndex,
  productShow,
  productToggleArchive,
  productUpdate,
} from "../controllers/productController.js";
import {
  categoryCreate,
  categoryCreatePage,
  categoryDelete,
  categoryEditPage,
  categoryIndex,
  categoryUpdate,
} from "../controllers/categoryController.js";
import {
  supplierCreate,
  supplierCreatePage,
  supplierDelete,
  supplierEditPage,
  supplierIndex,
  supplierUpdate,
} from "../controllers/supplierController.js";
import {
  stockCreate,
  stockForm,
  stockIndex,
} from "../controllers/stockController.js";
import {
  exportMovementsCsv,
  exportProductsCsv,
  reportPage,
} from "../controllers/reportController.js";
import {
  userCreate,
  userCreatePage,
  userEditPage,
  userIndex,
  userUpdate,
} from "../controllers/userController.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { loadStockAlerts } from "../middleware/alerts.js";

const router = express.Router();

// Public
router.get("/login", loginPage);
router.post("/login", loginUser);

// Everything below requires a signed-in, active account.
router.use(requireAuth);
// Feeds the low-stock notification badge shown on every page.
router.use(loadStockAlerts);

router.post("/logout", logoutUser);
router.get("/", requirePermission("dashboard.view"), dashboardPage);
router.get("/alerts", requirePermission("products.view"), alertPage);

// Products
router.get("/products", requirePermission("products.view"), productIndex);
router.get("/products/new", requirePermission("products.manage"), productCreatePage);
router.post("/products", requirePermission("products.manage"), productCreate);
router.get("/products/:id", requirePermission("products.view"), productShow);
router.get("/products/:id/edit", requirePermission("products.manage"), productEditPage);
router.post("/products/:id", requirePermission("products.manage"), productUpdate);
router.post("/products/:id/archive", requirePermission("products.manage"), productToggleArchive);
router.post("/products/:id/delete", requirePermission("products.manage"), productDelete);

// Categories
router.get("/categories", requirePermission("categories.view"), categoryIndex);
router.get("/categories/new", requirePermission("categories.manage"), categoryCreatePage);
router.post("/categories", requirePermission("categories.manage"), categoryCreate);
router.get("/categories/:id/edit", requirePermission("categories.manage"), categoryEditPage);
router.post("/categories/:id", requirePermission("categories.manage"), categoryUpdate);
router.post("/categories/:id/delete", requirePermission("categories.manage"), categoryDelete);

// Suppliers
router.get("/suppliers", requirePermission("suppliers.view"), supplierIndex);
router.get("/suppliers/new", requirePermission("suppliers.manage"), supplierCreatePage);
router.post("/suppliers", requirePermission("suppliers.manage"), supplierCreate);
router.get("/suppliers/:id/edit", requirePermission("suppliers.manage"), supplierEditPage);
router.post("/suppliers/:id", requirePermission("suppliers.manage"), supplierUpdate);
router.post("/suppliers/:id/delete", requirePermission("suppliers.manage"), supplierDelete);

// Stock ledger — staff may record movements.
router.get("/stock", requirePermission("stock.view"), stockIndex);
router.get("/stock/in", requirePermission("stock.record"), stockForm("in"));
router.post("/stock/in", requirePermission("stock.record"), stockCreate("in"));
router.get("/stock/out", requirePermission("stock.record"), stockForm("out"));
router.post("/stock/out", requirePermission("stock.record"), stockCreate("out"));
router.get("/stock/adjust", requirePermission("stock.record"), stockForm("adjustment"));
router.post("/stock/adjust", requirePermission("stock.record"), stockCreate("adjustment"));

// Reports
router.get("/reports", requirePermission("reports.view"), reportPage);
router.get("/reports/export/products", requirePermission("reports.export"), exportProductsCsv);
router.get("/reports/export/movements", requirePermission("reports.export"), exportMovementsCsv);

// Administration
router.get("/users", requirePermission("users.manage"), userIndex);
router.get("/users/new", requirePermission("users.manage"), userCreatePage);
router.post("/users", requirePermission("users.manage"), userCreate);
router.get("/users/:id/edit", requirePermission("users.manage"), userEditPage);
router.post("/users/:id", requirePermission("users.manage"), userUpdate);

export default router;
