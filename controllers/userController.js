import bcrypt from "bcryptjs";
import { Op } from "sequelize";
import { StockMovement, User } from "../models/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { FormValidator, parseId } from "../utils/validation.js";

const ROLES = ["admin", "staff"];

const renderForm = (res, { status = 200, values, errors, isEdit, account = null }) =>
  res.status(status).render("users/form", {
    title: isEdit ? "Edit user" : "Add user",
    section: "Administration",
    active: "users",
    isEdit,
    account,
    values,
    errors,
  });

const validateUser = async (body, { userId = null, editing = false, currentUserId = null } = {}) => {
  const v = new FormValidator(body);

  v.text("name", "Full name", { min: 2, max: 120 });
  v.email("email", "Email address", { required: true });
  v.oneOf("role", "Role", ROLES);
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
      if (v.values.role !== "admin") v.fail("You cannot remove your own administrator role.");
      if (!nextActive) v.fail("You cannot deactivate your own account.");
    }

    if (account.role === "admin" && (v.values.role !== "admin" || !nextActive)) {
      const otherAdmins = await User.count({
        where: {
          role: "admin",
          isActive: true,
          id: { [Op.ne]: account.id },
        },
      });
      if (otherAdmins === 0) v.fail("At least one active administrator account must remain.");
    }
  }

  return { v, password };
};

export const userIndex = asyncHandler(async (req, res) => {
  const rows = await User.findAll({
    include: [{ model: StockMovement, as: "movements", attributes: ["id"] }],
    order: [
      ["role", "ASC"],
      ["name", "ASC"],
    ],
  });

  const users = rows.map((row) => {
    const account = row.toJSON();
    return {
      ...account,
      movementCount: (account.movements || []).length,
    };
  });

  return res.render("users/index", {
    title: "Users",
    section: "Administration",
    active: "users",
    users,
  });
});

export const userCreatePage = (req, res) =>
  renderForm(res, {
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

  req.flash("success_msg", `${account.name} can now sign in as ${account.role}.`);
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

  req.flash("success_msg", `${account.name}'s account was updated.`);
  return res.redirect("/users");
});
