import bcrypt from "bcryptjs";
import { Op } from "sequelize";
import { Role, StockMovement, User } from "../models/index.js";
import { rolePermissions } from "../models/roleModel.js";
import { DEFAULT_ROLE_PERMISSIONS, invalidateRoleCache } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { FormValidator, parseId } from "../utils/validation.js";
import { userRoleLabel } from "../utils/helpers.js";

const MANAGED_PERMISSION = "users.manage";

/** Roles available for assignment, falling back to the built-in defaults. */
const loadRoles = async () => {
  const rows = await Role.findAll({ order: [["id", "ASC"]] });
  if (rows.length > 0) return rows;

  return Object.keys(DEFAULT_ROLE_PERMISSIONS).map((key) => ({
    key,
    name: userRoleLabel(key),
    description: null,
    permissions: DEFAULT_ROLE_PERMISSIONS[key],
    isSystem: true,
  }));
};

const roleTone = (role) => {
  const permissions = rolePermissions(role);
  if (permissions.includes("roles.manage")) return "info";
  if (permissions.includes(MANAGED_PERMISSION)) return "success";
  if (permissions.includes("products.manage")) return "warning";
  return "muted";
};

const renderForm = async (res, { status = 200, values, errors, isEdit, account = null }) => {
  const roles = await loadRoles();

  return res.status(status).render("users/form", {
    title: isEdit ? "Edit user" : "Add user",
    section: "Administration",
    active: "users",
    isEdit,
    account,
    values,
    errors,
    roles: roles.map((role) => ({
      key: role.key,
      name: role.name,
      description: role.description,
      permissionCount: rolePermissions(role).length,
    })),
  });
};

const validateUser = async (body, { userId = null, editing = false, currentUserId = null } = {}) => {
  const v = new FormValidator(body);
  const roles = await loadRoles();
  const roleKeys = roles.map((role) => role.key);
  const managingKeys = roles
    .filter((role) => rolePermissions(role).includes(MANAGED_PERMISSION))
    .map((role) => role.key);

  v.text("name", "Full name", { min: 2, max: 120 });
  v.email("email", "Email address", { required: true });
  v.oneOf("role", "Role", roleKeys);
  const password = v.text("password", "Password", {
    required: !editing,
    min: 8,
    max: 72,
  });
  const isActive = v.checkbox("isActive");

  if (!editing) v.values.isActive = true;

  if (v.values.email) {
    const duplicate = await User.findOne({
      where: {
        email: v.values.email,
        ...(userId ? { id: { [Op.ne]: userId } } : {}),
      },
    });
    if (duplicate) v.fail("An account with this email already exists.");
  }

  if (!roleKeys.includes(v.values.role) && v.values.role) {
    v.fail("The selected role no longer exists.");
  }

  const nextKeepsManagement = managingKeys.includes(v.values.role);

  if (editing && userId) {
    const account = await User.findByPk(userId);
    if (!account) {
      v.fail("That user account no longer exists.");
      return { v, password };
    }

    const nextActive = Object.prototype.hasOwnProperty.call(v.values, "isActive")
      ? v.values.isActive
      : account.isActive;

    if (userId === currentUserId) {
      if (!nextKeepsManagement) v.fail("You cannot remove your own access-management permission.");
      if (!nextActive) v.fail("You cannot deactivate your own account.");
    }

    const currentlyManages = managingKeys.includes(account.role) && account.isActive;
    const willManage = nextKeepsManagement && nextActive;

    if (currentlyManages && !willManage) {
      const otherManagers = managingKeys.length
        ? await User.count({ where: { role: managingKeys, isActive: true, id: { [Op.ne]: account.id } } })
        : 0;
      if (otherManagers === 0) {
        v.fail("At least one active account with access management must remain.");
      }
    }
  }

  return { v, password };
};

export const userIndex = asyncHandler(async (req, res) => {
  const [rows, roles] = await Promise.all([
    User.findAll({
      include: [{ model: StockMovement, as: "movements", attributes: ["id"] }],
      order: [
        ["role", "ASC"],
        ["name", "ASC"],
      ],
    }),
    loadRoles(),
  ]);

  const roleByKey = new Map(roles.map((role) => [String(role.key), role]));

  const users = rows.map((row) => {
    const account = row.toJSON();
    const role = roleByKey.get(String(account.role));
    return {
      ...account,
      roleName: role?.name || userRoleLabel(account.role),
      roleTone: roleTone(role || { permissions: [] }),
      movementCount: (account.movements || []).length,
    };
  });

  return res.render("users/index", {
    title: "Users",
    section: "Administration",
    active: "users",
    users,
    roleTotal: roles.length,
  });
});

export const userCreatePage = asyncHandler(async (req, res) => {
  return renderForm(res, {
    values: {
      name: "",
      email: "",
      role: "staff",
      password: "",
      isActive: true,
    },
    errors: [],
    isEdit: false,
  });
});

export const userCreate = asyncHandler(async (req, res) => {
  const { v, password } = await validateUser(req.body, {
    editing: false,
    currentUserId: req.user.id,
  });

  if (!v.isValid) {
    return renderForm(res, {
      status: 422,
      values: v.values,
      errors: v.errors,
      isEdit: false,
    });
  }

  const account = await User.create({
    name: v.values.name,
    email: v.values.email,
    role: v.values.role,
    password: await bcrypt.hash(password, 12),
    isActive: true,
  });

  invalidateRoleCache();
  req.flash("success_msg", `${account.name} can now sign in.`);
  return res.redirect("/users");
});

export const userEditPage = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const account = id ? await User.findByPk(id) : null;

  if (!account) {
    return res.status(404).render("errors/error", {
      title: "User not found",
      status: 404,
      message: "That user account could not be found.",
    });
  }

  return renderForm(res, {
    values: { ...account.toJSON(), password: "" },
    errors: [],
    isEdit: true,
    account,
  });
});

export const userUpdate = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const account = id ? await User.findByPk(id) : null;

  if (!account) {
    return res.status(404).render("errors/error", {
      title: "User not found",
      status: 404,
      message: "That user account could not be found.",
    });
  }

  const { v, password } = await validateUser(req.body, {
    userId: id,
    editing: true,
    currentUserId: req.user.id,
  });

  if (!v.isValid) {
    return renderForm(res, {
      status: 422,
      values: { ...account.toJSON(), ...v.values, password: "" },
      errors: v.errors,
      isEdit: true,
      account,
    });
  }

  const updates = {
    name: v.values.name,
    email: v.values.email,
    role: v.values.role,
    isActive: v.values.isActive,
  };

  if (password) updates.password = await bcrypt.hash(password, 12);

  await account.update(updates);

  invalidateRoleCache();
  req.flash("success_msg", `${account.name}'s account was updated.`);
  return res.redirect("/users");
});
