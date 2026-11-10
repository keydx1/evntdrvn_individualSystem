import { Op, col, fn } from "sequelize";
import {
  Product,
  StockMovement,
  Supplier,
  User,
} from "../models/index.js";
import { recordStockMovement } from "../services/stockService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  buildPagination,
  makeReference,
  number,
  pageNumber,
  parseDateEnd,
  parseDateStart,
} from "../utils/helpers.js";
import { FormValidator, ValidationError, parseId } from "../utils/validation.js";

const PER_PAGE = 15;

const MODE_META = {
  in: {
    title: "Stock in",
    description: "Record newly delivered or returned stock.",
    action: "Record stock in",
    referencePrefix: "IN",
  },
  out: {
    title: "Stock out",
    description: "Release stock for production, delivery or station use.",
    action: "Record stock out",
    referencePrefix: "OUT",
  },
  adjustment: {
    title: "Stock adjustment",
    description: "Correct the on-hand balance after a physical count.",
    action: "Save adjustment",
    referencePrefix: "ADJ",
  },
};

const buildMovementWhere = (query) => {
  const where = {};
  const productId = parseId(query.productId);
  const type = ["in", "out", "adjustment"].includes(query.type) ? query.type : "";
  const from = String(query.from ?? "").trim();
  const to = String(query.to ?? "").trim();

  if (productId) where.productId = productId;
  if (type) where.type = type;

  const start = parseDateStart(from);
  const end = parseDateEnd(to);

  if (start && end) where.createdAt = { [Op.between]: [start, end] };
  else if (start) where.createdAt = { [Op.gte]: start };
  else if (end) where.createdAt = { [Op.lte]: end };

  return {
    where,
    filters: { productId: productId || "", type, from, to },
  };
};

const loadFormOptions = async () => {
  const [products, suppliers] = await Promise.all([
    Product.findAll({
      where: { isActive: true },
      order: [["name", "ASC"]],
    }),
    Supplier.findAll({
      where: { isActive: true },
      order: [["name", "ASC"]],
    }),
  ]);

  return { products, suppliers };
};

const renderMovementForm = async (res, { mode, status = 200, values, errors }) => {
  const { products, suppliers } = await loadFormOptions();
  const meta = MODE_META[mode];

  return res.status(status).render("stock/form", {
    title: meta.title,
    section: "Inventory",
    active: "stock",
    mode,
    // The adjustment form posts to /stock/adjust, not /stock/adjustment.
    postAction: mode === "adjustment" ? "/stock/adjust" : `/stock/${mode}`,
    meta,
    products,
    suppliers,
    values,
    errors,
  });
};

export const stockIndex = asyncHandler(async (req, res) => {
  const { where, filters } = buildMovementWhere(req.query);
  const page = pageNumber(req.query.page);

  const [total, totals, products] = await Promise.all([
    StockMovement.count({ where }),
    StockMovement.findAll({
      where,
      attributes: ["type", [fn("SUM", col("quantity")), "total"]],
      group: ["type"],
      raw: true,
    }),
    Product.findAll({ order: [["name", "ASC"]] }),
  ]);

  const pagination = buildPagination({
    page,
    perPage: PER_PAGE,
    total,
    path: "/stock",
    query: filters,
  });

  const movements = await StockMovement.findAll({
    where,
    include: [
      { model: Product, as: "product", attributes: ["id", "name", "sku", "unit"] },
      { model: User, as: "user", attributes: ["id", "name"] },
      { model: Supplier, as: "supplier", attributes: ["id", "name"] },
    ],
    order: [
      ["createdAt", "DESC"],
      ["id", "DESC"],
    ],
    limit: PER_PAGE,
    offset: (pagination.page - 1) * PER_PAGE,
  });

  const summary = { in: 0, out: 0, adjustment: 0 };
  for (const row of totals) {
    const value = Number(row.total) || 0;
    if (row.type === "in") summary.in = value;
    if (row.type === "out") summary.out = Math.abs(value);
    if (row.type === "adjustment") summary.adjustment = value;
  }

  return res.render("stock/index", {
    title: "Inventory history",
    section: "Inventory",
    active: "stock",
    movements,
    products,
    pagination,
    filters,
    summary,
    resultCount: total,
  });
});

export const stockForm = (mode) =>
  asyncHandler(async (req, res) => {
    const meta = MODE_META[mode];
    if (!meta) {
      return res.status(404).render("errors/error", {
        title: "Movement not found",
        status: 404,
        message: "That stock action does not exist.",
      });
    }

    const productId = parseId(req.query.productId);

    return renderMovementForm(res, {
      mode,
      values: {
        productId: productId || "",
        quantity: "",
        newQuantity: "",
        unitCost: "",
        supplierId: "",
        reference: "",
        notes: "",
      },
      errors: [],
    });
  });

export const stockCreate = (mode) =>
  asyncHandler(async (req, res) => {
    const meta = MODE_META[mode];
    if (!meta) {
      return res.status(404).render("errors/error", {
        title: "Movement not found",
        status: 404,
        message: "That stock action does not exist.",
      });
    }

    const v = new FormValidator(req.body);
    const productId = v.int("productId", "Product", { min: 1 });
    v.optionalText("reference", "Reference number", { max: 60 });

    let quantity = null;
    let newQuantity = null;
    let unitCost = null;
    let supplierId = null;

    if (mode === "in") {
      quantity = v.int("quantity", "Quantity received", { min: 1, max: 1_000_000 });
      unitCost = v.optionalMoney("unitCost", "Unit cost");
      supplierId = v.int("supplierId", "Supplier", { required: false, min: 1 });
      v.optionalText("notes", "Notes", { max: 500 });
    } else if (mode === "out") {
      quantity = v.int("quantity", "Quantity released", { min: 1, max: 1_000_000 });
      v.optionalText("notes", "Notes", { max: 500 });
    } else {
      newQuantity = v.int("newQuantity", "Counted quantity", { min: 0, max: 1_000_000 });
      v.text("notes", "Reason for adjustment", { min: 3, max: 500 });
    }

    const product = productId ? await Product.findByPk(productId) : null;
    if (productId && !product) v.fail("The selected product does not exist.");
    if (product && !product.isActive) v.fail("Archived products cannot receive stock movements.");

    if (mode === "out" && product && quantity !== null && quantity > Number(product.quantity)) {
      v.fail(`Only ${number(product.quantity)} ${product.unit}(s) are currently on hand.`);
    }

    if (
      mode === "adjustment" &&
      product &&
      newQuantity !== null &&
      newQuantity === Number(product.quantity)
    ) {
      v.fail("The counted quantity matches the current stock. No adjustment is needed.");
    }

    if (supplierId) {
      const supplier = await Supplier.findByPk(supplierId);
      if (!supplier || !supplier.isActive) v.fail("Select an active supplier.");
    }

    if (!v.isValid) {
      return renderMovementForm(res, {
        mode,
        status: 422,
        values: v.values,
        errors: v.errors,
      });
    }

    try {
      const { product: updatedProduct } = await recordStockMovement({
        productId,
        userId: req.user.id,
        type: mode,
        quantity,
        newQuantity,
        unitCost,
        supplierId,
        reference: v.values.reference || makeReference(meta.referencePrefix),
        notes: v.values.notes,
      });

      req.flash(
        "success_msg",
        mode === "in"
          ? `${number(quantity)} ${updatedProduct.unit}(s) received for ${updatedProduct.name}.`
          : mode === "out"
            ? `${number(quantity)} ${updatedProduct.unit}(s) released from ${updatedProduct.name}.`
            : `${updatedProduct.name} stock was adjusted and recorded.`
      );

      return res.redirect(`/products/${updatedProduct.id}`);
    } catch (error) {
      if (error instanceof ValidationError) {
        return renderMovementForm(res, {
          mode,
          status: 422,
          values: v.values,
          errors: error.errors,
        });
      }
      throw error;
    }
  });
