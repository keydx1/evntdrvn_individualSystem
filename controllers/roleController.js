import { Role, User } from "../models/index.js";
import { rolePermissions } from "../models/roleModel.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { FormValidator, parseId } from "../utils/validation.js";
import { PERMISSION_CATALOG, PERMISSIONS, invalidateRoleCache } from "../middleware/auth.js";

const MANAGED_PERMISSION = "users.manage";

const roleCounts = async () => {
  const rows = await User.findAll({
    attributes: ["role", "isActive"],
    raw: true,
  });

  const counts = new Map();
  for (const row of rows) {
    const entry = counts.get(row.role) || { total: 0, active: 0 };
    entry.total += 1;
    if (row.isActive) entry.active += 1;
    counts.set(row.role, entry);
  }
  return counts;
};

const catalogFor = (selected = []) =>
  PERMISSION_CATALOG.map((group) => ({
    group: group.group,
    items: group.items.map((item) => ({
      ...item,
      checked: selected.includes(item.key),
    })),
  }));

const renderForm = async (res, { status = 200, values, errors, isEdit, role = null }) => {
  const counts = role ? await roleCounts() : new Map();
  const assigned = role ? counts.get(role.key) || { total: 0, active: 0 } : { total: 0, active: 0 };
  const selected = Array.isArray(values.permissions) ? values.permissions : [];

  return res.status(status).render("roles/form", {
    title: isEdit ? "Edit role" : "New role",
    section: "Administration",
    active: "roles",
    isEdit,
    role,
    values,
    errors,
    catalog: catalogFor(selected),
    selectedCount: selected.length,
    totalPermissions: PERMISSIONS.length,
    assignedUsers: assigned.total,
  });
};

const readPermissions = (body) => {
  const raw = body?.permissions;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return [...new Set(list.map((item) => String(item)))].filter((item) => PERMISSIONS.includes(item));
};

/** Roles that currently grant access management. */
const rolesWithAccessManagement = async (excludeKey = null) => {
  const rows = await Role.findAll();
  if (rows.length === 0) return excludeKey ? [] : ["admin"];

  return rows
    .filter((row) => row.key !== excludeKey)
    .filter((row) => rolePermissions(row).includes(MANAGED_PERMISSION))
    .map((row) => row.key);
};

export const roleIndex = asyncHandler(async (req, res) => {
  const [roles, counts] = await Promise.all([
    Role.findAll({ order: [["id", "ASC"]] }),
    roleCounts(),
  ]);

  const rows = roles.map((role) => {
    const permissions = rolePermissions(role);
    const usage = counts.get(role.key) || { total: 0, active: 0 };
    return {
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissionCount: permissions.length,
      totalPermissions: PERMISSIONS.length,
      canManageUsers: permissions.includes(MANAGED_PERMISSION),
      userCount: usage.total,
      activeUserCount: usage.active,
      isOwnRole: req.user.role === role.key,
    };
  });

  return res.render("roles/index", {
    title: "Roles & permissions",
    section: "Administration",
    active: "roles",
    roles: rows,
    permissionTotal: PERMISSIONS.length,
  });
});

export const roleCreatePage = asyncHandler(async (req, res) => {
  return renderForm(res, {
    values: {
      key: "",
      name: "",
      description: "",
      permissions: PERMISSION_CATALOG.find((group) => group.group === "Stock ledger")
        ? ["dashboard.view", "products.view", "stock.view", "reports.view"]
        : [],
    },
    errors: [],
    isEdit: false,
  });
});

export const roleCreate = asyncHandler(async (req, res) => {
  const v = new FormValidator(req.body);
  v.text("key", "Role key", { min: 2, max: 32 });
  v.text("name", "Role name", { min: 2, max: 60 });
  v.optionalText("description", "Description", { max: 255 });

  const key = String(v.values.key || "").trim().toLowerCase();
  v.values.key = key;

  if (key && !/^[a-z][a-z0-9_-]{1,31}$/.test(key)) {
    v.fail("Role key must start with a letter and use only lowercase letters, numbers, - or _.");
  }

  const permissions = readPermissions(req.body);
  if (permissions.length === 0) v.fail("Select at least one permission for this role.");

  if (key) {
    const existing = await Role.findOne({ where: { key } });
    if (existing) v.fail("A role with this key already exists.");
  }

  if (!v.isValid) {
    return renderForm(res, {
      status: 422,
      values: { ...v.values, permissions },
      errors: v.errors,
      isEdit: false,
    });
  }

  const role = await Role.create({
    key,
    name: v.values.name,
    description: v.values.description,
    permissions,
    isSystem: false,
  });

  invalidateRoleCache();
  req.flash("success_msg", `${role.name} role was created with ${permissions.length} permission(s).`);
  return res.redirect("/roles");
});

export const roleEditPage = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const role = id ? await Role.findByPk(id) : null;

  if (!role) {
    return res.status(404).render("errors/error", {
      title: "Role not found",
      status: 404,
      message: "That role does not exist or may have been removed.",
    });
  }

  return renderForm(res, {
    values: { ...role.toJSON(), permissions: rolePermissions(role), isSystem: role.isSystem },
    errors: [],
    isEdit: true,
    role,
  });
});

export const roleUpdate = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const role = id ? await Role.findByPk(id) : null;

  if (!role) {
    return res.status(404).render("errors/error", {
      title: "Role not found",
      status: 404,
      message: "That role does not exist or may have been removed.",
    });
  }

  const v = new FormValidator(req.body);
  v.text("name", "Role name", { min: 2, max: 60 });
  v.optionalText("description", "Description", { max: 255 });

  const permissions = readPermissions(req.body);
  if (permissions.length === 0) v.fail("Select at least one permission for this role.");

  if (req.user.role === role.key && !permissions.includes(MANAGED_PERMISSION)) {
    v.fail("Your own role must keep the user-management permission.");
  }

  if (!permissions.includes(MANAGED_PERMISSION)) {
    const otherKeys = await rolesWithAccessManagement(role.key);
    if (otherKeys.length === 0) {
      v.fail("At least one role must keep the user-management permission.");
    }
  }

  if (!v.isValid) {
    return renderForm(res, {
      status: 422,
      values: { ...v.values, permissions, isSystem: role.isSystem },
      errors: v.errors,
      isEdit: true,
      role,
    });
  }

  await role.update({
    name: v.values.name,
    description: v.values.description,
    permissions,
  });

  invalidateRoleCache();
  req.flash("success_msg", `${role.name} role was updated.`);
  return res.redirect("/roles");
});

export const roleDelete = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const role = id ? await Role.findByPk(id) : null;

  if (!role) {
    return res.status(404).render("errors/error", {
      title: "Role not found",
      status: 404,
      message: "That role does not exist or may have been removed.",
    });
  }

  if (role.isSystem) {
    req.flash("error_msg", `${role.name} is a built-in role and cannot be deleted. Edit its permissions instead.`);
    return res.redirect("/roles");
  }

  if (req.user.role === role.key) {
    req.flash("error_msg", "You cannot delete the role your own account is using.");
    return res.redirect("/roles");
  }

  const assigned = await User.count({ where: { role: role.key } });
  if (assigned > 0) {
    req.flash(
      "error_msg",
      `${role.name} is assigned to ${assigned} account(s). Move them to another role before deleting it.`
    );
    return res.redirect("/roles");
  }

  await role.destroy();
  invalidateRoleCache();
  req.flash("success_msg", `${role.name} role was deleted.`);
  return res.redirect("/roles");
});

/** Exported for the user controller's guard rails. */
export const userCanManageUsers = (roleRow) => rolePermissions(roleRow).includes(MANAGED_PERMISSION);
