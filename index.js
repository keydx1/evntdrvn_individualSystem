import express from "express";
import path from "node:path";
import fs from "node:fs";
import session from "express-session";
import flash from "connect-flash";
import hbs from "hbs";
import { fileURLToPath, pathToFileURL } from "node:url";
import router from "./routes/index.js";
import apiRouter from "./routes/api.js";
import { sequelize } from "./models/index.js";
import { csrfProtection } from "./middleware/csrf.js";
import { requestId } from "./middleware/requestId.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { registerViewHelpers } from "./utils/handlebars.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use(requestId);

// The JSON API is mounted BEFORE the session and CSRF middleware so
// service-to-service calls are authenticated by token instead of a cookie.
app.use("/api/v1", apiRouter);

app.use(
  session({
    name: "aquapiol.sid",
    secret: process.env.SESSION_SECRET || "aquapiol-xianfire-development-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);
app.use(flash());

app.use((req, res, next) => {
  res.setHeader("X-Powered-By", "XianFire Framework");
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  res.locals.now = new Date();
  res.locals.currentPath = req.path;
  res.locals.query = req.query;
  next();
});

app.use(csrfProtection);

registerViewHelpers();

const partialsDir = path.join(__dirname, "views/partials");
for (const file of fs.readdirSync(partialsDir).filter((name) => name.endsWith(".xian"))) {
  hbs.registerPartial(file.replace(/\.xian$/, ""), fs.readFileSync(path.join(partialsDir, file), "utf8"));
}

app.engine("xian", async (filePath, options, callback) => {
  try {
    const originalPartialsDir = hbs.partialsDir;
    hbs.partialsDir = path.join(__dirname, "views");

    const html = await new Promise((resolve, reject) => {
      hbs.__express(filePath, options, (error, rendered) => {
        if (error) return reject(error);
        return resolve(rendered);
      });
    });

    hbs.partialsDir = originalPartialsDir;
    callback(null, html);
  } catch (error) {
    callback(error);
  }
});

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "xian");

app.use("/", router);
app.use(notFound);
app.use(errorHandler);

export default app;

export const startServer = async (port = PORT) => {
  await sequelize.authenticate();

  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      const actualPort = server.address().port;
      console.log(`🔥 AquaPiol inventory running at http://localhost:${actualPort}`);
      resolve(server);
    });
    server.on("error", reject);
  });
};

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun && !process.env.XIAN_ELECTRON) {
  startServer().catch((error) => {
    console.error("❌ Unable to start AquaPiol:", error.message);
    console.error("   Check your MySQL connection, then run: npm run setup");
    process.exitCode = 1;
  });
}
