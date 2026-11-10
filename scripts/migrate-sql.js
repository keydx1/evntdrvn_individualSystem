import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { dbConfig } from "../models/db.js";

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "migrations");

const IGNORED_CODES = new Set([
  "ER_DUP_FIELDNAME", // column already exists
  "ER_DUP_KEYNAME", // index already exists
  "ER_CANT_DROP_FIELD_OR_KEY",
]);

const splitStatements = (sql) =>
  sql
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .split(/;\s*\n/)
    .map((statement) => statement.trim())
    .filter(Boolean);

const run = async () => {
  const connection = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    multipleStatements: false,
    database: dbConfig.name,
  });

  try {
    await connection.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        name VARCHAR(255) NOT NULL,
        applied_at DATETIME NOT NULL,
        PRIMARY KEY (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    const [appliedRows] = await connection.query("SELECT name FROM schema_migrations");
    const applied = new Set(appliedRows.map((row) => row.name));

    // The live database already has the base schema, so mark the generated
    // baseline as applied instead of trying to CREATE the existing tables.
    if (applied.size === 0) {
      const [tables] = await connection.query("SHOW TABLES LIKE 'users'");
      if (tables.length > 0) {
        await connection.query(
          "INSERT INTO schema_migrations (name, applied_at) VALUES (?, NOW())",
          ["001_baseline.sql"]
        );
        applied.add("001_baseline.sql");
        console.log("ℹ️  Baseline schema already exists — marked 001_baseline.sql as applied.");
      }
    }

    const files = (await fs.readdir(migrationsDir))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`↷ ${file} (already applied)`);
        continue;
      }

      const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
      for (const statement of splitStatements(sql)) {
        try {
          await connection.query(statement);
        } catch (error) {
          if (IGNORED_CODES.has(error.code)) {
            console.log(`   • skipped duplicate: ${error.code}`);
            continue;
          }
          throw error;
        }
      }

      await connection.query(
        "INSERT INTO schema_migrations (name, applied_at) VALUES (?, NOW())",
        [file]
      );
      console.log(`✅ applied ${file}`);
    }

    console.log("✅ Migrations complete.");
  } finally {
    await connection.end();
  }
};

run().catch((error) => {
  console.error("❌ Migration failed:", error.message);
  process.exitCode = 1;
});
