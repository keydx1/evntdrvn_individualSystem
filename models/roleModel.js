import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

/**
 * A role is a named bundle of permissions. `users.role` stores the role key,
 * so a role can be renamed or re-scoped without touching user rows.
 */
export const Role = sequelize.define(
  "Role",
  {
    key: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: true,
      validate: { is: /^[a-z][a-z0-9_-]{1,31}$/ },
    },
    name: {
      type: DataTypes.STRING(60),
      allowNull: false,
      validate: { notEmpty: true, len: [2, 60] },
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    permissions: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    isSystem: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "roles",
    indexes: [{ unique: true, fields: ["key"] }],
  }
);

/** Normalised permission list for a role row. */
export const rolePermissions = (role) => {
  const raw = role?.permissions ?? [];
  return Array.isArray(raw) ? raw.filter((item) => typeof item === "string") : [];
};
