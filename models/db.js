import { Sequelize } from "sequelize";

// XianFire does not bundle dotenv. Node 20.12+ can load a local .env file
// without an extra dependency; the defaults below keep fresh installs working.
try {
  process.loadEnvFile?.();
} catch {
  // No .env file present — use the local development defaults.
}

const database = process.env.DB_NAME || "aquapiol_inventory";

export const dbConfig = {
  name: database,
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  timezone: process.env.DB_TIMEZONE || "+08:00",
};

export const sequelize = new Sequelize(dbConfig.name, dbConfig.user, dbConfig.password, {
  host: dbConfig.host,
  port: dbConfig.port,
  dialect: "mysql",
  timezone: dbConfig.timezone,
  logging: false,
  define: {
    charset: "utf8mb4",
    collate: "utf8mb4_unicode_ci",
  },
});

export const syncDatabase = async ({ alter = false, force = false } = {}) => {
  await sequelize.authenticate();
  await sequelize.sync({ alter, force });
  return sequelize;
};
