import { Op } from "sequelize";
import {
  Category,
  Product,
  StockMovement,
  Supplier,
  User,
  sequelize,
} from "../models/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  buildPagination,
  makeReference,
  pageNumber,
  stockStatus,
} from "../utils/helpers.js";
import { FormValidator, parseId } from "../utils/validation.js";

const PER_PAGE = 10;
const UNITS = [
  "piece",
  "bottle",
  "gallon",
  "pack",
  "roll",
  "kit",
  "sack",
  "liter",
  "box",
  "set",
];

const blankValues = {
  sku: "",
  name: "",
  categoryId: "",
  supplierId: "",
  unit: "piece",
  reorderLevel: "10",
  costPrice: "0.00",
  sellingPrice: "0.00",
  location: "",
  description: "",
  openingQuantity: "0",
  openingUnitCost: "",
};

const renderForm = async (res, { status = 200, values, errors, isEdit, product = null }) => {
  const [categories, suppliers] = await Promise.all([
    Category.findAll({ order: [["name", "ASC"]] }),
    Supplier.findAll({ order: [["name", "ASC"]] }),
  ]);

  return res.status(status).render("products/form", {
    title: isEdit ? "Edit product" : "Add product",
    section: "Inventory",
    active: "products",
    isEdit,
    product,
    values,
    errors,
    categories,
    suppliers,
    units: UNITS,
  });
};

const validateProduct = async (body, { productId = null } = {}) => {
  const v = new FormValidator(body);

  v.text("sku", "SKU / product code", { max: 50, upper: true });
  v.text("name", "Product name", { min: 2, max: 150 });
  const categoryId = v.int("categoryId", "Category", { min: 1 });
  const supplierId = v.int("supplierId", "Supplier", { required: false, min: 1 });
  v.oneOf("unit", "Unit of measure", UNITS);
  v.int("reorderLevel", "Reorder level", { min: 0, max: 1_000_000 });
  v.money("costPrice", "Cost price");
  v.money("sellingPrice", "Selling price");
  v.optionalText("location", "Storage location", { max: 100 });
  v.optionalText("description", "Description", { max: 1000 });

  let openingQuantity = 0;
  let openingUnitCost = null;
  if (!productId) {
    openingQuantity = v.int("openingQuantity", "Opening stock", { required: false, min: 0, max: 1_000_000 }) ?? 0;
    openingUnitCost = v.optionalMoney("openingUnitCost", "Opening unit cost");
  }

  if (categoryId) {
    const category = await Category.findByPk(categoryId);
    if (!category) v.fail("The selected category does not exist.");
    else if (!category.isActive) v.fail("The selected category is inactive.");
  }

  if (supplierId) {
    const supplier = await Supplier.findByPk(supplierId);
    if (!supplier) v.fail("The selected supplier does not exist.");
    else if (!supplier.isActive) v.fail("The selected supplier is inactive.");
  }

  if (v.values.sku) {
    const duplicate = await Product.findOne({
      where: {
        sku: v.values.sku,
        ...(productId ? { id: { [Op.ne]: productId } } : {}),
      },
    });
    if (duplicate) v.fail("A product with this SKU already exists.");
  }

  if (v.isValid && Number(v.values.sellingPrice) > 0 && Number(v.values.costPrice) > Number(v.values.sellingPrice)) {
    v.fail("Selling price should not be lower than the cost price.");
  }

  return { v, categoryId, supplierId, openingQuantity, openingUnitCost };
};

export const productIndex = asyncHandler(async (req, res) => {
  const search = String(req.query.search ?? "").trim();
  const categoryId = parseId(req.query.category);
  const requestedStatus = String(req.query.status ?? "");
  const status = ["low", "out", "archived"].includes(requestedStatus) ? requestedStatus : "";

  const where = {
    isActive: status !== "archived",
  };

  if (categoryId) where.categoryId = categoryId;
  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { sku: { [Op.like]: `%${search}%` } },
      { location: { [Op.like]: `%${search}%` } },
    ];
  }

  const [rows, categories] = await Promise.all([
    Product.findAll({
      where,
      include: [
        { model: Category, as: "category" },
        { model: Supplier, as: "supplier" },
      ],
      order: [["name", "ASC"]],
    }),
    Category.findAll({ order: [["name", "ASC"]] }),
  ]);

  let products = rows.map((row) => {
    const product = row.toJSON();
    return {
      ...product,
      status: product.isActive
        ? stockStatus(product)
        : { label: "Archived", className: "muted" },
      stockValue: Number(product.quantity) * Number(product.costPrice),
    };
  });

  if (status === "low") {
    products = products.filter(
      (product) => Number(product.quantity) > 0 && Number(product.quantity) <= Number(product.reorderLevel)
    );
  } else if (status === "out") {
    products = products.filter((product) => Number(product.quantity) <= 0);
  }

  const pagination = buildPagination({
    page: pageNumber(req.query.page),
    perPage: PER_PAGE,
    total: products.length,
    path: "/products",
    query: {
      search,
      category: categoryId || "",
      status,
    },
  });

  const visible = products.slice(
    (pagination.page - 1) * PER_PAGE,
    pagination.page * PER_PAGE
  );

  return res.render("products/index", {
    title: "Products",
    section: "Inventory",
    active: "products",
    products: visible,
    categories,
    pagination,
    filters: { search, category: categoryId || "", status },
    resultCount: products.length,
  });
});

export const productCreatePage = asyncHandler(async (req, res) => {
  return renderForm(res, {
    values: { ...blankValues },
    errors: [],
    isEdit: false,
  });
});

export const productCreate = asyncHandler(async (req, res) => {
  const { v, categoryId, supplierId, openingQuantity, openingUnitCost } =
    await validateProduct(req.body);

  if (!v.isValid) {
    return renderForm(res, {
      status: 422,
      values: { ...blankValues, ...v.values },
      errors: v.errors,
      isEdit: false,
    });
  }

  const transaction = await sequelize.transaction();

  try {
    const product = await Product.create(
      {
        sku: v.values.sku,
        name: v.values.name,
        categoryId,
        supplierId,
        unit: v.values.unit,
        quantity: openingQuantity,
        reorderLevel: Number(v.values.reorderLevel),
        costPrice: Number(v.values.costPrice),
        sellingPrice: Number(v.values.sellingPrice),
        location: v.values.location,
        description: v.values.description,
      },
      { transaction }
    );

    if (openingQuantity > 0) {
      await StockMovement.create(
        {
          productId: product.id,
          userId: req.user.id,
          supplierId: supplierId || null,
          type: "in",
          quantity: openingQuantity,
          previousStock: 0,
          newStock: openingQuantity,
          unitCost: openingUnitCost ?? Number(v.values.costPrice),
          reference: makeReference("OPEN"),
          notes: "Opening stock recorded when the product was created.",
        },
        { transaction }
      );
    }

    await transaction.commit();
    req.flash("success_msg", `${product.name} was added to inventory.`);
    return res.redirect(`/products/${product.id}`);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

export const productShow = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(404).render("errors/error", {
      title: "Product not found",
      status: 404,
      message: "That product code does not exist.",
    });
  }

  const productRow = await Product.findByPk(id, {
    include: [
      { model: Category, as: "category" },
      { model: Supplier, as: "supplier" },
    ],
  });

  if (!productRow) {
    return res.status(404).render("errors/error", {
      title: "Product not found",
      status: 404,
      message: "That product could not be found. It may have been removed.",
    });
  }

  const movements = await StockMovement.findAll({
    where: { productId: id },
    include: [
      { model: User, as: "user", attributes: ["id", "name"] },
      { model: Supplier, as: "supplier", attributes: ["id", "name"] },
    ],
    order: [
      ["createdAt", "DESC"],
      ["id", "DESC"],
    ],
    limit: 20,
  });

  const product = productRow.toJSON();

  return res.render("products/show", {
    title: product.name,
    section: "Inventory",
    active: "products",
    product,
    status: stockStatus(product),
    stockValue: Number(product.quantity) * Number(product.costPrice),
    retailValue: Number(product.quantity) * Number(product.sellingPrice),
    movements,
  });
});

export const productEditPage = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const product = id ? await Product.findByPk(id) : null;

  if (!product) {
    return res.status(404).render("errors/error", {
      title: "Product not found",
      status: 404,
      message: "That product could not be found.",
    });
  }

  return renderForm(res, {
    values: product.toJSON(),
    errors: [],
    isEdit: true,
    product,
  });
});

export const productUpdate = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const product = id ? await Product.findByPk(id) : null;

  if (!product) {
    return res.status(404).render("errors/error", {
      title: "Product not found",
      status: 404,
      message: "That product could not be found.",
    });
  }

  const { v, categoryId, supplierId } = await validateProduct(req.body, {
    productId: id,
  });

  if (!v.isValid) {
    return renderForm(res, {
      status: 422,
      values: { ...product.toJSON(), ...v.values },
      errors: v.errors,
      isEdit: true,
      product,
    });
  }

  await product.update({
    sku: v.values.sku,
    name: v.values.name,
    categoryId,
    supplierId,
    unit: v.values.unit,
    reorderLevel: Number(v.values.reorderLevel),
    costPrice: Number(v.values.costPrice),
    sellingPrice: Number(v.values.sellingPrice),
    location: v.values.location,
    description: v.values.description,
  });

  req.flash("success_msg", `${product.name} was updated.`);
  return res.redirect(`/products/${product.id}`);
});

export const productDelete = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const product = id ? await Product.findByPk(id) : null;

  if (!product) {
    return res.status(404).render("errors/error", {
      title: "Product not found",
      status: 404,
      message: "That product could not be found.",
    });
  }

  const movementCount = await StockMovement.count({ where: { productId: product.id } });
  if (movementCount > 0) {
    req.flash(
      "error_msg",
      `${product.name} has stock history and cannot be deleted. Archive it instead so the ledger stays intact.`
    );
    return res.redirect(`/products/${product.id}`);
  }

  await product.destroy();
  req.flash("success_msg", `${product.name} was deleted from inventory.`);
  return res.redirect("/products");
});

export const productToggleArchive = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const product = id ? await Product.findByPk(id) : null;

  if (!product) {
    return res.status(404).render("errors/error", {
      title: "Product not found",
      status: 404,
      message: "That product could not be found.",
    });
  }

  await product.update({ isActive: !product.isActive });

  req.flash(
    "success_msg",
    product.isActive
      ? `${product.name} was restored to active inventory.`
      : `${product.name} was archived. Its stock history is preserved.`
  );

  return res.redirect(`/products/${product.id}`);
});
