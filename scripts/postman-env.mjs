#!/usr/bin/env node
/**
 * Fills the Postman environment with the real API tokens from .env so the
 * collection can be run without hand-pasting bearer tokens.
 *
 * Output is written to postman/generated/ (gitignored) because it contains
 * live credentials.
 *
 * Usage: npm run postman:env
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const envFile = path.join(root, ".env");
const templateFile = path.join(root, "postman", "AquaPiol-Local.postman_environment.json");
const outDir = path.join(root, "postman", "generated");
const outFile = path.join(outDir, "AquaPiol-Local.filled.postman_environment.json");

const VARIABLE_BY_SERVICE = {
  pos: "posToken",
  customers: "customersToken",
  hr: "hrToken",
  accounting: "accountingToken",
};

const readEnvValue = (source, key) => {
  const line = source
    .split(/\r?\n/)
    .find((entry) => entry.trimStart().startsWith(`${key}=`));
  if (!line) return null;
  const value = line.slice(line.indexOf("=") + 1).trim();
  return value.replace(/^["']|["']$/g, "");
};

if (!fs.existsSync(envFile)) {
  console.error(`Missing ${envFile}. Create it from .env.example first.`);
  process.exit(1);
}

const envSource = fs.readFileSync(envFile, "utf8");
let tokens;
try {
  tokens = JSON.parse(readEnvValue(envSource, "API_TOKENS") || "{}");
} catch {
  console.error("API_TOKENS in .env is not valid JSON. Expected {\"pos\":\"...\", ...}");
  process.exit(1);
}

const environment = JSON.parse(fs.readFileSync(templateFile, "utf8"));
const filled = [];
const missing = [];

for (const variable of environment.values) {
  const service = Object.keys(VARIABLE_BY_SERVICE).find(
    (key) => VARIABLE_BY_SERVICE[key] === variable.key
  );

  if (!service) {
    filled.push(variable);
    continue;
  }

  const token = typeof tokens[service] === "string" ? tokens[service].trim() : "";
  if (token.length < 8) missing.push(service);
  filled.push({ ...variable, value: token });
}

environment.name = "AquaPiol Local (filled)";
environment.values = filled;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(environment, null, 2)}\n`, "utf8");

const relative = path.relative(root, outFile).replace(/\\/g, "/");
console.log(`Wrote ${relative}`);

if (missing.length) {
  console.error(
    `Warning: no usable token for: ${missing.join(", ")}. Those requests will return 401.`
  );
  process.exitCode = 1;
} else {
  console.log("All four service tokens are set: pos, customers, hr, accounting.");
}
