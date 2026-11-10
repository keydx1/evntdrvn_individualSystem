#!/usr/bin/env node
/*
MIT License

Copyright (c) 2025 Christian I. Cabrera || XianFire Framework
Mindoro State University - Philippines

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");

const args = process.argv.slice(2);
const command = args[0] || "start";
const rest = args.slice(1);

// Map short aliases to full script names
const aliases = {
  "": "start",
  "s": "start",
  "start": "start",
  "d": "dev",
  "dev": "dev",
  "m": "migrate",
  "migrate": "migrate",
  "seed": "seed",
  "setup": "setup",
  "t": "test",
  "test": "test",
};

const script = aliases[command] || command;
const fullCmd = `npm run ${script}${rest.length ? " " + rest.join(" ") : ""}`;

if (command === "--help" || command === "-h" || command === "help") {
  console.log(`
🔥 XianFire CLI

Usage:
  xian [command] [args]

Commands:
  xian                  Start the server (alias: xian start)
  xian start            Start the server
  xian dev              Start with nodemon (hot reload)
  xian migrate          Run database migrations
  xian seed             Load the demo data set
  xian setup            Migrate and seed in one step
  xian create:model <Name>       Generate a model
  xian create:controller <Name>  Generate a controller
  xian create:add-middleware <Name>  Generate auth/role middleware
  xian create:upload-middleware <Name>  Generate image upload middleware
  xian route:list       List all registered routes
  xian test             Run the end-to-end test suite
  xian help             Show this help

Examples:
  xian
  xian dev
  xian create:model User
  xian create:controller userController
  xian route:list
  xian test
  xian migrate
  xian seed
`);
  process.exit(0);
}

try {
  execSync(fullCmd, { cwd: projectRoot, stdio: "inherit" });
} catch (e) {
  process.exit(e.status || 1);
}