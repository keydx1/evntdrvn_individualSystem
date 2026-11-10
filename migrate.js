import mysql from "mysql2/promise";
import { dbConfig, sequelize } from "./models/db.js";
import "./models/index.js";

const createDatabaseIfMissing = async () => {
  if (!/^[A-Za-z0-9_]+$/.test(dbConfig.name)) {
    throw new Error("DB_NAME may contain only letters, numbers and underscores.");
  }

  const connection = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
  });

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbConfig.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log(`✅ Database ready: ${dbConfig.name}`);
  } finally {
    await connection.end();
  }
};

const run = async () => {
  await createDatabaseIfMissing();
  await sequelize.authenticate();
  await sequelize.sync({ alter: process.argv.includes("--alter") });
  console.log("✅ Tables created / verified");
  console.log("   Next: npm run seed");
};

run()
  .catch((error) => {
    console.error("❌ Migration failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
