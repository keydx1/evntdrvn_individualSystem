import crypto from "node:crypto";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const safeEqual = (left, right) => {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
};

export const csrfProtection = (req, res, next) => {
  if (!req.session) return next(new Error("Sessions must be configured before CSRF protection."));

  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }

  res.locals.csrfToken = req.session.csrfToken;

  if (SAFE_METHODS.has(req.method)) return next();

  const submitted = req.body?._csrf || req.get("x-csrf-token");
  if (!safeEqual(submitted, req.session.csrfToken)) {
    return res.status(403).render("errors/error", {
      title: "Session expired",
      status: 403,
      message:
        "This form could not be verified because your session expired. Go back, refresh the page, and submit again.",
    });
  }

  return next();
};
