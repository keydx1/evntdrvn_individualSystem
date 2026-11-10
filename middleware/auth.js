import { User } from "../models/index.js";

/**
 * Single source of truth for role based access control.
 *
 * Each permission maps to the roles allowed to perform it. Adding a role or a
 * permission only requires touching this table — routes and views read from it.
 *
 *   admin  full station administration
 *   staff  read everything and record stock movements only
 */
export const PERMISSION_MATRIX = {
  "dashboard.view": ["admin", "staff"],

  "products.view": ["admin", "staff"],
  "products.manage": ["admin"],

  "categories.view": ["admin", "staff"],
  "categories.manage": ["admin"],

  "suppliers.view": ["admin", "staff"],
  "suppliers.manage": ["admin"],

  "stock.view": ["admin", "staff"],
  "stock.record": ["admin", "staff"],

  "reports.view": ["admin", "staff"],
  "reports.export": ["admin"],

  "users.manage": ["admin"],
};

export const PERMISSIONS = Object.keys(PERMISSION_MATRIX);

/** Does this user hold the named permission? Unknown permissions are denied. */
export const can = (user, permission) => {
  if (!user?.role) return false;
  const roles = PERMISSION_MATRIX[permission];
  if (!roles) return false;
  return roles.includes(user.role);
};

export const requireAuth = async (req, res, next) => {
  if (!req.session?.userId) {
    req.flash?.("error_msg", "Please sign in to continue.");
    return res.redirect("/login");
  }

  try {
    const user = await User.findByPk(req.session.userId);
    if (!user || !user.isActive) {
      req.session.userId = null;
      req.flash?.("error_msg", "Your account is no longer active. Please contact an administrator.");
      return res.redirect("/login");
    }

    req.user = user;
    res.locals.currentUser = user;
    res.locals.can = (permission) => can(user, permission);
    return next();
  } catch (error) {
    return next(error);
  }
};

/**
 * Gate a route behind one or more permissions from PERMISSION_MATRIX.
 * Must run after requireAuth so req.user is always populated.
 */
export const requirePermission = (...permissions) => (req, res, next) => {
  if (!req.user) return res.redirect("/login");

  const denied = permissions.find((permission) => !can(req.user, permission));
  if (denied) {
    return res.status(403).render("errors/error", {
      title: "Access denied",
      status: 403,
      message: "Your account does not have permission to open this page.",
    });
  }

  return next();
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.redirect("/login");

  if (!roles.includes(req.user.role)) {
    return res.status(403).render("errors/error", {
      title: "Access denied",
      status: 403,
      message: "Your account does not have permission to open this page.",
    });
  }

  return next();
};
