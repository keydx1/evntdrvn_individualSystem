import { Op } from "sequelize";
import { Product, StockMovement, Supplier } from "../models/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { FormValidator, parseId } from "../utils/validation.js";

const renderForm = (res, { status = 200, values, errors, isEdit, supplier = null }) =>
  res.status(status).render("suppliers/form", {
    title: isEdit ? "Edit supplier" : "Add supplier",
    section: "Inventory",
    active: "suppliers",
    isEdit,
    supplier,
    values,
    errors,
  });

const validateSupplier = async (body, supplierId = null) => {
  const v = new FormValidator(body);
  v.text("name", "Supplier name", { min: 2, max: 150 });
  v.optionalText("contactPerson", "Contact person", { max: 120 });
  v.optionalText("phone", "Phone number", { max: 40 });
  v.email("email", "Email address");
  v.optionalText("address", "Address", { max: 255 });
  v.optionalText("notes", "Notes", { max: 1000 });

  if (v.values.name) {
    const duplicate = await Supplier.findOne({
      where: {
        name: v.values.name,
        ...(supplierId ? { id: { [Op.ne]: supplierId } } : {}),
      },
    });
    if (duplicate) v.fail("A supplier with this name already exists.");
  }

  return v;
};

export const supplierIndex = asyncHandler(async (req, res) => {
  const rows = await Supplier.findAll({
    include: [{ model: Product, as: "products", attributes: ["id", "quantity", "isActive"] }],
    order: [["name", "ASC"]],
  });

  const suppliers = rows.map((row) => {
    const supplier = row.toJSON();
    const activeProducts = (supplier.products || []).filter((product) => product.isActive);
    return {
      ...supplier,
      productCount: activeProducts.length,
      totalUnits: activeProducts.reduce((sum, product) => sum + Number(product.quantity), 0),
    };
  });

  return res.render("suppliers/index", {
    title: "Suppliers",
    section: "Inventory",
    active: "suppliers",
    suppliers,
  });
});

export const supplierCreatePage = (req, res) =>
  renderForm(res, {
    values: {
      name: "",
      contactPerson: "",
      phone: "",
      email: "",
      address: "",
      notes: "",
    },
    errors: [],
    isEdit: false,
  });

export const supplierCreate = asyncHandler(async (req, res) => {
  const v = await validateSupplier(req.body);

  if (!v.isValid) {
    return renderForm(res, {
      status: 422,
      values: v.values,
      errors: v.errors,
      isEdit: false,
    });
  }

  const supplier = await Supplier.create({
    name: v.values.name,
    contactPerson: v.values.contactPerson,
    phone: v.values.phone,
    email: v.values.email,
    address: v.values.address,
    notes: v.values.notes,
  });

  req.flash("success_msg", `${supplier.name} was added to suppliers.`);
  return res.redirect("/suppliers");
});

export const supplierEditPage = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const supplier = id ? await Supplier.findByPk(id) : null;

  if (!supplier) {
    return res.status(404).render("errors/error", {
      title: "Supplier not found",
      status: 404,
      message: "That supplier could not be found.",
    });
  }

  return renderForm(res, {
    values: supplier.toJSON(),
    errors: [],
    isEdit: true,
    supplier,
  });
});

export const supplierUpdate = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const supplier = id ? await Supplier.findByPk(id) : null;

  if (!supplier) {
    return res.status(404).render("errors/error", {
      title: "Supplier not found",
      status: 404,
      message: "That supplier could not be found.",
    });
  }

  const v = await validateSupplier(req.body, id);

  if (!v.isValid) {
    return renderForm(res, {
      status: 422,
      values: { ...supplier.toJSON(), ...v.values },
      errors: v.errors,
      isEdit: true,
      supplier,
    });
  }

  await supplier.update({
    name: v.values.name,
    contactPerson: v.values.contactPerson,
    phone: v.values.phone,
    email: v.values.email,
    address: v.values.address,
    notes: v.values.notes,
  });

  req.flash("success_msg", `${supplier.name} was updated.`);
  return res.redirect("/suppliers");
});

export const supplierDelete = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const supplier = id ? await Supplier.findByPk(id) : null;

  if (!supplier) {
    return res.status(404).render("errors/error", {
      title: "Supplier not found",
      status: 404,
      message: "That supplier could not be found.",
    });
  }

  const [productCount, movementCount] = await Promise.all([
    Product.count({ where: { supplierId: id } }),
    StockMovement.count({ where: { supplierId: id } }),
  ]);

  if (productCount > 0 || movementCount > 0) {
    req.flash(
      "error_msg",
      `${supplier.name} is linked to existing products or stock history and cannot be deleted.`
    );
    return res.redirect("/suppliers");
  }

  await supplier.destroy();
  req.flash("success_msg", `${supplier.name} was deleted.`);
  return res.redirect("/suppliers");
});
