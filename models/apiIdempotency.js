import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

/**
 * Stores the response of a successful write so a retried Idempotency-Key can
 * replay the same result instead of deducting stock twice.
 */
export const ApiIdempotency = sequelize.define(
  "ApiIdempotency",
  {
    service: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    idempotencyKey: {
      type: DataTypes.STRING(128),
      allowNull: false,
      field: "idempotency_key",
    },
    endpoint: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    requestHash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      field: "request_hash",
    },
    responseStatus: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "response_status",
    },
    responseBody: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
      field: "response_body",
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "expires_at",
    },
  },
  {
    tableName: "api_idempotency",
    indexes: [
      { unique: true, fields: ["service", "idempotency_key"], name: "uq_idem_service_key" },
      { fields: ["expires_at"] },
    ],
  }
);
