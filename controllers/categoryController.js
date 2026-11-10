import { Op } from "sequelize";
import { Category, Product } from "../models/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { FormValidator, parseId } from "../utils/validation.js";

const renderForm = (res, { status = 200, values, errors, isEdit, category = null }) =>
  res.status(status).render("categories/form", {
    title: isEdit ? "Edit category" : "Add category",
    section: "Inventory",
    active: "categories",
    isEdit,
    category,
    values,
    errors,
  });

const validateCategory = async (body, categoryId = null) => {
  const v = new FormValidator(body);
  v.text("name", "Category name", { min: 2, max: 100 });
  v.optionalText("description", "Description", { max: 255 });

  if (v.values.name) {
    const duplicate = await Category.findOne({
      where: {
        name: v.values.name,
        ...(categoryId ? { id: { [Op.ne]: categoryId } } : {}),
      },
    });
    if (duplicate) v.fail("A category with this name already exists.");
  }

  return v;
};

export const categoryIndex = asyncHandler(async (req, res) => {
  const rows = await Category.findAll({
    include: [{ model: Product, as: "products", attributes: ["id", "quantity", "isActive"] }],
    order: [["name", "ASC"]],
  });

  const categories = rows.map((row) => {
    const category = row.toJSON();
    const activeProducts = (category.products || []).filter((product) => product.isActive);
    return {
      ...category,
      productCount: activeProducts.length,
      totalUnits: activeProducts.reduce((sum, product) => sum + Number(product.quantity), 0),
    };
  });

  return res.render("categories/index", {
    title: "Categories",
    section: "Inventory",
    active: "categories",
    categories,
  });
});

export const categoryCreatePage = (req, res) =>
  renderForm(res, {
    values: { name: "", description: "" },
    errors: [],
    isEdit: false,
  });

export const categoryCreate = asyncHandler(async (req, res) => {
  const v = await validateCategory(req.body);

  if (!v.isValid) {
    return renderForm(res, {
      status: 422,
      values: v.values,
      errors: v.errors,
      isEdit: false,
    });
  }

  const category = await Category.create({
    name: v.values.name,
    description: v.values.description,
  });

  req.flash("success_msg", `${category.name} category was created.`);
  return res.redirect("/categories");
});

export const categoryEditPage = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const category = id ? await Category.findByPk(id) : null;

  if (!category) {
    return res.status(404).render("errors/error", {
      title: "Category not found",
      status: 404,
      message: "That category could not be found.",
    });
  }

  return renderForm(res, {
    values: category.toJSON(),
    errors: [],
    isEdit: true,
    category,
  });
});

export const categoryUpdate = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const category = id ? await Category.findByPk(id) : null;

  if (!category) {
    return res.status(404).render("errors/error", {
      title: "Category not found",
      status: 404,
      message: "That category could not be found.",
    });
  }

  const v = await validateCategory(req.body, id);

  if (!v.isValid) {
    return renderForm(res, {
      status: 422,
      values: { ...category.toJSON(), ...v.values },
      errors: v.errors,
      isEdit: true,
      category,
    });
  }

  await category.update({
    name: v.values.name,
    description: v.values.description,
  });

  req.flash("success_msg", `${category.name} category was updated.`);
  return res.redirect("/categories");
});

export const categoryDelete = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const category = id ? await Category.findByPk(id) : null;

  if (!category) {
    return res.status(404).render("errors/error", {
      title: "Category not found",
      status: 404,
      message: "That category could not be found.",
    });
  }

  const productCount = await Product.count({ where: { categoryId: id } });
  if (productCount > 0) {
    req.flash(
      "error_msg",
      `${category.name} cannot be deleted while ${productCount} product(s) use it.`
    );
    return res.redirect("/categories");
  }

  await category.destroy();
  req.flash("success_msg", `${category.name} category was deleted.`);
  return res.redirect("/categories");
});
