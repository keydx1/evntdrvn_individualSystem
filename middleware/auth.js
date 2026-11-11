import { Role } from "../models/index.js";
import { User } from "../models/userModel.js";
import { rolePermissions } from "../models/roleModel.js";
import { userRoleLabel } from "../utils/helpers.js";

/**
 * Every permission the app understands, grouped for the role editor UI.
 * Add a permission here and it becomes assignable to any role.
 */
export const PERMISSION_CATALOG = [
  {
    group: "Workspace",
    items: [
      {
        key: "dashboard.view",
        label: "View the dashboard",
        description: "Stock value, low-stock alerts and recent activity.",
      },
    ],
  },
  {
    group: "Products",
    items: [
      { key: "products.view", label: "View products", description: "Open the catalogue and product pages." },
      { key: "products.manage", label: "Manage products", description: "Create, edit, archive and delete products." },
    ],
  },
  {
    group: "Categories",
    items: [
      { key: "categories.view", label: "View categories" },
      { key: "categories.manage", label: "Manage categories" },
    ],
  },
  {
    group: "Suppliers",
    items: [
      { key: "suppliers.view", label: "View suppliers" },
      { key: "suppliers.manage", label: "Manage suppliers" },
    ],
  },
  {
    group: "Stock ledger",
    items: [
      { key: "stock.view", label: "View inventory history", description: "Read the stock ledger and totals." },
      { key: "stock.record", label: "Record stock movements", description: "Stock in, stock out and adjustments." },
    ],
  },
  {
    group: "Reports",
    items: [
      { key: "reports.view", label: "View reports" },
      { key: "reports.export", label: "Export CSV reports" },
    ],
  },
  {
    group: "Administration",
    items: [
      { key: "users.manage", label: "Manage user accounts", description: "Create, edit and deactivate accounts." },
      { key: "roles.manage", label: "Manage roles and permissions" },
    ],
  },
];

export const PERMISSIONS = PERMISSION_CATALOG.flatMap((group) => group.items.map((item) => item.key));

/**
 * Default permission sets. Used to seed the roles table and as a fallback when
 * the database has no roles yet (fresh install before `npm run migrate:sql`).
 */
export const DEFAULT_ROLE_PERMISSIONS = {
  admin: [...PERMISSIONS],
  manager: [
    "dashboard.view",
    "products.view",
    "products.manage",
    "categories.view",
    "categories.manage",
    "suppliers.view",
    "suppliers.manage",
    "stock.view",
    "stock.record",
    "reports.view",
    "reports.export",
  ],
  staff: [
    "dashboard.view",
    "products.view",
    "categories.view",
    "suppliers.view",
    "stock.view",
    "stock.record",
    "reports.view",
  ],
  viewer: [
    "dashboard.view",
    "products.view",
    "categories.view",
    "suppliers.view",
    "stock.view",
    "reports.view",
  ],
};

/** permission -> roles that hold it, derived from the defaults above. */
export const PERMISSION_MATRIX = PERMISSIONS.reduce((matrix, permission) => {
  matrix[permission] = Object.keys(DEFAULT_ROLE_PERMISSIONS).filter((role) =>
    DEFAULT_ROLE_PERMISSIONS[role].includes(permission)
  );
  return matrix;
}, {});

const CACHE_TTL_MS = 30_000;
let cache = { at: 0, map: new Map() };

/** Drop the cache after a role change so the UI reflects it immediately. */
export const invalidateRoleCache = () => {
  cache = { at: 0, map: new Map() };
};

/**
 * Load roles into memory (short TTL). Falls back to the built-in defaults when
 * the roles table is missing or empty, so a fresh database still works.
 */
export const getRoleMap = async ({ force = false } = {}) => {
  if (!force && cache.map.size > 0 && Date.now() - cache.at < CACHE_TTL_MS) return cache.map;

  try {
    const rows = await Role.findAll({ order: [["id", "ASC"]] });
    if (rows.length > 0) {
      cache = {
        at: Date.now(),
        map: new Map(
          rows.map((row) => [
            row.key,
            { key: row.key, name: row.name, description: row.description, permissions: rolePermissions(row) },
          ])
        ),
      };
    }
  } catch (error) {
    console.error(`[rbac] could not load roles, using defaults: ${error.message}`);
  }

  return cache.map;
};

export const permissionsForRole = (roleKey) => {
  const entry = cache.map.get(roleKey);
  if (entry) return entry.permissions;
  return DEFAULT_ROLE_PERMISSIONS[roleKey] ?? [];
};

export const roleDefinitionFor = (roleKey) => cache.map.get(roleKey) ?? null;

export const roleNameFor = (roleKey) => cache.map.get(roleKey)?.name ?? null;

/** Does this user hold the named permission? Unknown permissions are denied. */
export const can = (user, permission) => {
  if (!user?.role) return false;
  return permissionsForRole(user.role).includes(permission);
};

export const requireAuth = async (req, res, next) => {
  if (!req.session?.userId) {
    req.flash?.("error_msg", "Please sign in to continue.");
    return res.redirect("/login");
  }

  try {
    await getRoleMap();

    const user = await User.findByPk(req.session.userId);
    if (!user || !user.isActive) {
      req.session.userId = null;
      req.flash?.("error_msg", "Your account is no longer active. Please contact an administrator.");
      return res.redirect("/login");
    }

    req.user = user;
    res.locals.currentUser = user;
    res.locals.currentRoleName = roleNameFor(user.role) || userRoleLabel(user.role);
    res.locals.can = (permission) => can(user, permission);
    res.locals.canManageUsers = can(user, "users.manage");
    res.locals.canManageRoles = can(user, "roles.manage");
    return next();
  } catch (error) {
    return next(error);
  }
};

/**
 * Gate a route behind one or more permissions.
 * Must run after requireAuth so req.user is always populated.
 */
export const requirePermission = (...permissions) => (req, res, next) => {
  if (!req.user) return res.redirect("/login");

  const denied = permissions.find((permission) => !can(req.user, permission));
  if (denied) {
    return res.status(403).render("errors/error", {
      title: "Access denied",
      status: 403,
      message: `Your role does not have the "${denied}" permission for this page.`,
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
