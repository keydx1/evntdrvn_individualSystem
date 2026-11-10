import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const StockMovement = sequelize.define(
  "StockMovement",
  {
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    supplierId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    type: {
      type: DataTypes.ENUM("in", "out", "adjustment"),
      allowNull: false,
      validate: { isIn: [["in", "out", "adjustment"]] },
    },
    // Signed change applied to the product balance (+in, -out, +/- adjustment).
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    previousStock: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    newStock: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    unitCost: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },
    reference: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Integration fields: external references only, never master data.
    customerRef: {
      type: DataTypes.STRING(64),
      allowNull: true,
      field: "customer_ref",
    },
    sourceSystem: {
      type: DataTypes.STRING(32),
      allowNull: true,
      field: "source_system",
    },
    occurredAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "occurred_at",
    },
  },
  {
    tableName: "stock_movements",
    updatedAt: false,
    indexes: [
      { fields: ["productId"] },
      { fields: ["userId"] },
      { fields: ["type"] },
      { fields: ["createdAt"] },
      { fields: ["customer_ref"] },
      { fields: ["occurred_at"] },
      { fields: ["source_system", "createdAt"] },
      {
        unique: true,
        fields: ["productId", "reference", "type"],
        name: "uq_movement_product_reference_type",
      },
    ],
  }
);
