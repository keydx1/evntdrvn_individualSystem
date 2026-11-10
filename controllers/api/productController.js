import { Op, col } from "sequelize";
import { Category, Product, Supplier, sequelize } from "../../models/index.js";
import { ApiError, asyncApi } from "../../utils/apiErrors.js";
import {
  booleanParam,
  isoOffset,
  money,
  pageMeta,
  pagination,
  parseDateInput,
} from "../../utils/apiFormat.js";

export const serializeProduct = (product) => ({
  id: product.id,
  sku: product.sku,
  name: product.name,
  unit: product.unit,
  category: product.category
    ? { id: product.category.id, name: product.category.name }
    : null,
  supplier: product.supplier
    ? { id: product.supplier.id, name: product.supplier.name }
    : null,
  cost_price: money(product.costPrice),
  selling_price: money(product.sellingPrice),
  quantity: Number(product.quantity),
  reorder_level: Number(product.reorderLevel),
  location: product.location,
  description: product.description,
  is_active: Boolean(product.isActive),
  updated_at: isoOffset(product.updatedAt),
});

const withRelations = [
  { model: Category, as: "category", attributes: ["id", "name"] },
  { model: Supplier, as: "supplier", attributes: ["id", "name"] },
];

export const listProducts = asyncApi(async (req, res) => {
  const { page, perPage, offset } = pagination(req.query);
  const conditions = [];

  const active = booleanParam(req.query.active, true);
  if (active !== null) conditions.push({ isActive: active });

  if (req.query.sku) conditions.push({ sku: String(req.query.sku).trim() });

  const query = String(req.query.q || "").trim();
  if (query) {
    conditions.push({
      [Op.or]: [
        { name: { [Op.like]: `%${query}%` } },
        { sku: { [Op.like]: `%${query}%` } },
      ],
    });
  }

  if (req.query.category_id) {
    const categoryId = Number.parseInt(req.query.category_id, 10);
    if (Number.isInteger(categoryId)) conditions.push({ categoryId });
  }

  if (booleanParam(req.query.low_stock, false)) {
    conditions.push(sequelize.where(col("quantity"), Op.lte, col("reorderLevel")));
  }

  const updatedSince = parseDateInput(req.query.updated_since);
  if (updatedSince) conditions.push({ updatedAt: { [Op.gte]: updatedSince } });

  const where = conditions.length ? { [Op.and]: conditions } : {};

  const { count, rows } = await Product.findAndCountAll({
    where,
    include: withRelations,
    order: [["sku", "ASC"]],
    limit: perPage,
    offset,
    distinct: true,
  });

  return res.json({
    data: rows.map(serializeProduct),
    meta: pageMeta(req, { page, perPage, total: count }),
  });
});

export const getProductBySku = asyncApi(async (req, res) => {
  const sku = String(req.params.sku || "").trim();
  if (!sku) throw new ApiError("VALIDATION_ERROR", "A product SKU is required.");

  const product = await Product.findOne({ where: { sku }, include: withRelations });
  if (!product) {
    throw new ApiError("NOT_FOUND", `No product found for SKU ${sku}.`);
  }

  return res.json({ data: serializeProduct(product), meta: { request_id: req.id ?? null } });
});

export const listCategories = asyncApi(async (req, res) => {
  const rows = await Category.findAll({ order: [["name", "ASC"]] });
  return res.json({
    data: rows.map((row) => ({ id: row.id, name: row.name, description: row.description })),
    meta: { request_id: req.id ?? null },
  });
});

export const listSuppliers = asyncApi(async (req, res) => {
  const rows = await Supplier.findAll({ order: [["name", "ASC"]] });
  return res.json({
    data: rows.map((row) => ({
      id: row.id,
      name: row.name,
      contact_person: row.contactPerson ?? null,
      phone: row.phone ?? null,
      email: row.email ?? null,
      is_active: Boolean(row.isActive),
    })),
    meta: { request_id: req.id ?? null },
  });
});

export const listStockLevels = asyncApi(async (req, res) => {
  const { page, perPage, offset } = pagination(req.query);
  const conditions = [];
  if (booleanParam(req.query.active, true) !== null) {
    conditions.push({ isActive: booleanParam(req.query.active, true) });
  }

  const { count, rows } = await Product.findAndCountAll({
    where: conditions.length ? { [Op.and]: conditions } : {},
    order: [["sku", "ASC"]],
    limit: perPage,
    offset,
  });

  return res.json({
    data: rows.map((product) => ({
      sku: product.sku,
      name: product.name,
      unit: product.unit,
      quantity: Number(product.quantity),
      reorder_level: Number(product.reorderLevel),
      is_active: Boolean(product.isActive),
      status:
        Number(product.quantity) <= 0
          ? "out_of_stock"
          : Number(product.quantity) <= Number(product.reorderLevel)
            ? "low_stock"
            : "in_stock",
      updated_at: isoOffset(product.updatedAt),
    })),
    meta: pageMeta(req, { page, perPage, total: count }),
  });
});
