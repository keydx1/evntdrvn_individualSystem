import { Op } from "sequelize";
import {
  Category,
  Product,
  StockMovement,
  Supplier,
  User,
} from "../models/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  dateInput,
  parseDateEnd,
  parseDateStart,
  sendCsv,
  startOfMonthInput,
  todayInput,
} from "../utils/helpers.js";
import { parseId } from "../utils/validation.js";

const startOfDay = (date = new Date()) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const endOfDay = (date = new Date()) => {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
};

const startOfWeek = (date = new Date()) => {
  const value = startOfDay(date);
  const offset = (value.getDay() + 6) % 7; // Monday-based week
  value.setDate(value.getDate() - offset);
  return value;
};

const startOfMonth = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);

export const REPORT_PERIODS = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];

const PERIOD_LABELS = {
  daily: "Daily report · today",
  weekly: "Weekly report · Monday to today",
  monthly: "Monthly report · month to date",
  custom: "Custom range",
};

const buildRange = (query) => {
  const now = new Date();
  const requested = ["daily", "weekly", "monthly", "custom"].includes(String(query.period ?? ""))
    ? String(query.period)
    : "";
  const fromRaw = String(query.from ?? "").trim();
  const toRaw = String(query.to ?? "").trim();
  const period = requested || (fromRaw || toRaw ? "custom" : "monthly");

  if (period !== "custom") {
    const start =
      period === "daily"
        ? startOfDay(now)
        : period === "weekly"
          ? startOfWeek(now)
          : startOfMonth(now);

    return {
      period,
      periodLabel: PERIOD_LABELS[period],
      from: dateInput(start),
      to: dateInput(now),
      start,
      end: endOfDay(now),
      filterError: "",
    };
  }

  const fallbackFrom = startOfMonthInput();
  const fallbackTo = todayInput();
  const fromDate = fromRaw ? parseDateStart(fromRaw) : parseDateStart(fallbackFrom);
  const toDate = toRaw ? parseDateEnd(toRaw) : parseDateEnd(fallbackTo);

  let filterError = "";

  if (!fromDate || !toDate) {
    filterError = "Enter valid start and end dates. Showing the default period instead.";
  } else if (fromDate > toDate) {
    filterError = "The start date must be before the end date. Showing the default period instead.";
  }

  const start = filterError ? parseDateStart(fallbackFrom) : fromDate;
  const end = filterError ? parseDateEnd(fallbackTo) : toDate;

  return {
    period: "custom",
    periodLabel: PERIOD_LABELS.custom,
    from: dateInput(start),
    to: dateInput(end),
    start,
    end,
    filterError,
  };
};

const loadProducts = async (categoryId) => {
  const where = { isActive: true };
  if (categoryId) where.categoryId = categoryId;

  return Product.findAll({
    where,
    include: [
      { model: Category, as: "category" },
      { model: Supplier, as: "supplier" },
    ],
    order: [["name", "ASC"]],
  });
};

const movementInclude = (categoryId) => [
  {
    model: Product,
    as: "product",
    attributes: ["id", "name", "sku", "unit", "categoryId"],
    include: [{ model: Category, as: "category", attributes: ["id", "name"] }],
    ...(categoryId ? { where: { categoryId } } : {}),
  },
  { model: User, as: "user", attributes: ["id", "name"] },
  { model: Supplier, as: "supplier", attributes: ["id", "name"] },
];

const buildMovementRangeWhere = (start, end) => ({
  createdAt: { [Op.between]: [start, end] },
});

const summariseProducts = (products) => {
  const summary = {
    products: products.length,
    units: 0,
    costValue: 0,
    retailValue: 0,
    lowStock: 0,
    outOfStock: 0,
  };

  for (const row of products) {
    const product = row.toJSON ? row.toJSON() : row;
    const quantity = Number(product.quantity);
    const reorderLevel = Number(product.reorderLevel);

    summary.units += quantity;
    summary.costValue += quantity * Number(product.costPrice);
    summary.retailValue += quantity * Number(product.sellingPrice);
    if (quantity <= 0) summary.outOfStock += 1;
    else if (quantity <= reorderLevel) summary.lowStock += 1;
  }

  return summary;
};

export const reportPage = asyncHandler(async (req, res) => {
  const { period, periodLabel, from, to, start, end, filterError } = buildRange(req.query);
  const categoryId = parseId(req.query.category);

  const [productRows, categories] = await Promise.all([
    loadProducts(categoryId),
    Category.findAll({ order: [["name", "ASC"]] }),
  ]);

  const products = productRows.map((row) => row.toJSON());
  const summary = summariseProducts(products);

  const groupsMap = new Map();
  for (const product of products) {
    const name = product.category?.name || "Uncategorized";
    const group = groupsMap.get(name) || {
      name,
      products: 0,
      units: 0,
      costValue: 0,
      retailValue: 0,
    };
    group.products += 1;
    group.units += Number(product.quantity);
    group.costValue += Number(product.quantity) * Number(product.costPrice);
    group.retailValue += Number(product.quantity) * Number(product.sellingPrice);
    groupsMap.set(name, group);
  }

  const groups = [...groupsMap.values()].sort((a, b) => b.costValue - a.costValue);

  const lowStock = products
    .filter((product) => Number(product.quantity) <= Number(product.reorderLevel))
    .sort((a, b) => Number(a.quantity) - Number(b.quantity));

  const movements = await StockMovement.findAll({
    where: buildMovementRangeWhere(start, end),
    include: movementInclude(categoryId),
    order: [
      ["createdAt", "DESC"],
      ["id", "DESC"],
    ],
  });

  const movementSummary = movements.reduce(
    (summaryRow, movement) => {
      const quantity = Number(movement.quantity);
      summaryRow.count += 1;
      if (movement.type === "in") summaryRow.in += quantity;
      else if (movement.type === "out") summaryRow.out += Math.abs(quantity);
      else summaryRow.adjustment += quantity;
      return summaryRow;
    },
    { in: 0, out: 0, adjustment: 0, count: 0 }
  );

  // Daily breakdown so the same page serves the daily, weekly and monthly report.
  const dailyMap = new Map();
  for (const movement of movements) {
    const key = dateInput(new Date(movement.createdAt));
    const bucket = dailyMap.get(key) || {
      date: key,
      in: 0,
      out: 0,
      adjustment: 0,
      count: 0,
    };
    const quantity = Number(movement.quantity);
    bucket.count += 1;
    if (movement.type === "in") bucket.in += quantity;
    else if (movement.type === "out") bucket.out += Math.abs(quantity);
    else bucket.adjustment += quantity;
    dailyMap.set(key, bucket);
  }

  const daily = [...dailyMap.values()].sort((a, b) => b.date.localeCompare(a.date));

  return res.render("reports/index", {
    title: "Reports",
    section: "Insights",
    active: "reports",
    period,
    periodLabel,
    periods: REPORT_PERIODS,
    daily,
    from,
    to,
    filters: { from, to, category: categoryId || "" },
    categories,
    summary,
    groups,
    lowStock,
    movements: movements.slice(0, 50),
    movementCount: movements.length,
    movementSummary,
    filterError,
  });
});

export const exportProductsCsv = asyncHandler(async (req, res) => {
  const categoryId = parseId(req.query.category);
  const productRows = await loadProducts(categoryId);

  const rows = [
    [
      "SKU",
      "Product",
      "Category",
      "Supplier",
      "Unit",
      "On hand",
      "Reorder level",
      "Cost price",
      "Selling price",
      "Stock value",
      "Status",
    ],
  ];

  for (const row of productRows) {
    const product = row.toJSON();
    const status =
      Number(product.quantity) <= 0
        ? "Out of stock"
        : Number(product.quantity) <= Number(product.reorderLevel)
          ? "Low stock"
          : "In stock";

    rows.push([
      product.sku,
      product.name,
      product.category?.name || "",
      product.supplier?.name || "",
      product.unit,
      product.quantity,
      product.reorderLevel,
      product.costPrice,
      product.sellingPrice,
      (Number(product.quantity) * Number(product.costPrice)).toFixed(2),
      status,
    ]);
  }

  return sendCsv(res, `aquapiol-products-${todayInput()}.csv`, rows);
});

export const exportMovementsCsv = asyncHandler(async (req, res) => {
  const { from, to, start, end } = buildRange(req.query);
  const categoryId = parseId(req.query.category);

  const movements = await StockMovement.findAll({
    where: buildMovementRangeWhere(start, end),
    include: movementInclude(categoryId),
    order: [
      ["createdAt", "ASC"],
      ["id", "ASC"],
    ],
  });

  const rows = [
    [
      "Date",
      "Type",
      "SKU",
      "Product",
      "Category",
      "Change",
      "Previous stock",
      "New stock",
      "Unit cost",
      "Reference",
      "Supplier",
      "Recorded by",
      "Notes",
    ],
  ];

  for (const movement of movements) {
    rows.push([
      movement.createdAt.toISOString(),
      movement.type,
      movement.product?.sku || "",
      movement.product?.name || "",
      movement.product?.category?.name || "",
      movement.quantity,
      movement.previousStock,
      movement.newStock,
      movement.unitCost ?? "",
      movement.reference || "",
      movement.supplier?.name || "",
      movement.user?.name || "",
      movement.notes || "",
    ]);
  }

  return sendCsv(res, `aquapiol-stock-movements-${from}-to-${to}.csv`, rows);
});
