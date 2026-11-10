import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const User = sequelize.define(
  "User",
  {
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
      validate: { notEmpty: true, len: [2, 120] },
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM("admin", "staff"),
      allowNull: false,
      defaultValue: "staff",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    // HR owns employees; AquaPiol only stores the external reference.
    externalEmployeeId: {
      type: DataTypes.STRING(64),
      allowNull: true,
      unique: true,
      field: "external_employee_id",
    },
  },
  {
    tableName: "users",
    indexes: [
      { unique: true, fields: ["email"] },
      { unique: true, fields: ["external_employee_id"] },
    ],
  }
);
