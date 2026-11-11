import { sequelize } from "./db.js";
import { Category } from "./categoryModel.js";
import { Supplier } from "./supplierModel.js";
import { Product } from "./productModel.js";
import { StockMovement } from "./stockMovementModel.js";
import { User } from "./userModel.js";
import { Role } from "./roleModel.js";
import { ApiIdempotency } from "./apiIdempotency.js";

Category.hasMany(Product, {
  as: "products",
  foreignKey: "categoryId",
  onDelete: "RESTRICT",
});
Product.belongsTo(Category, { as: "category", foreignKey: "categoryId" });

Supplier.hasMany(Product, {
  as: "products",
  foreignKey: "supplierId",
  onDelete: "SET NULL",
});
Product.belongsTo(Supplier, { as: "supplier", foreignKey: "supplierId" });

Product.hasMany(StockMovement, {
  as: "movements",
  foreignKey: "productId",
  onDelete: "RESTRICT",
});
StockMovement.belongsTo(Product, { as: "product", foreignKey: "productId" });

User.hasMany(StockMovement, {
  as: "movements",
  foreignKey: "userId",
  onDelete: "RESTRICT",
});
StockMovement.belongsTo(User, { as: "user", foreignKey: "userId" });

Supplier.hasMany(StockMovement, {
  as: "movements",
  foreignKey: "supplierId",
  onDelete: "SET NULL",
});
StockMovement.belongsTo(Supplier, { as: "supplier", foreignKey: "supplierId" });

export { sequelize, Category, Supplier, Product, StockMovement, User, Role, ApiIdempotency };
