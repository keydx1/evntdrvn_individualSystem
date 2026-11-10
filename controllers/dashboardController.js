import { Op } from "sequelize";
import {
  Category,
  Product,
  StockMovement,
  Supplier,
  User,
} from "../models/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const dashboardPage = asyncHandler(async (req, res) => {
  const products = await Product.findAll({
    where: { isActive: true },
    include: [{ model: Category, as: "category" }],
    order: [["name", "ASC"]],
  });

  const productRows = products.map((product) => product.toJSON());

  const stats = productRows.reduce(
    (summary, product) => {
      const quantity = Number(product.quantity);
      const reorderLevel = Number(product.reorderLevel);
      summary.units += quantity;
      summary.costValue += quantity * Number(product.costPrice);
      summary.retailValue += quantity * Number(product.sellingPrice);

      if (quantity <= 0) summary.outOfStock += 1;
      else if (quantity <= reorderLevel) summary.lowStock += 1;

      return summary;
    },
    {
      products: productRows.length,
      units: 0,
      lowStock: 0,
      outOfStock: 0,
      costValue: 0,
      retailValue: 0,
    }
  );

  const lowStock = productRows
    .filter((product) => Number(product.quantity) <= Number(product.reorderLevel))
    .sort((a, b) => Number(a.quantity) - Number(b.quantity))
    .slice(0, 6);

  const recentMovements = await StockMovement.findAll({
    include: [
      { model: Product, as: "product", include: [{ model: Category, as: "category" }] },
      { model: User, as: "user", attributes: ["id", "name"] },
      { model: Supplier, as: "supplier", attributes: ["id", "name"] },
    ],
    order: [
      ["createdAt", "DESC"],
      ["id", "DESC"],
    ],
    limit: 8,
  });

  const categoryMap = new Map();
  for (const product of productRows) {
    const name = product.category?.name || "Uncategorized";
    const entry = categoryMap.get(name) || { name, products: 0, units: 0, value: 0 };
    entry.products += 1;
    entry.units += Number(product.quantity);
    entry.value += Number(product.quantity) * Number(product.costPrice);
    categoryMap.set(name, entry);
  }

  const categorySummary = [...categoryMap.values()]
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const since = new Date();
  since.setDate(since.getDate() - 29);
  since.setHours(0, 0, 0, 0);

  const monthlyMovements = await StockMovement.count({
    where: { createdAt: { [Op.gte]: since } },
  });

  // ---- Chart datasets -------------------------------------------------

  // Daily units received vs released over the last 30 days (the window starts
  // 30 days back so a delivery made on this exact day is still included).
  const dayKey = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate()
    ).padStart(2, "0")}`;

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const trendStart = new Date();
  trendStart.setHours(0, 0, 0, 0);
  trendStart.setDate(trendStart.getDate() - 30);
  const trendDays = 31;

  const trendMap = new Map();
  for (let offset = 0; offset < trendDays; offset += 1) {
    const day = new Date(trendStart);
    day.setDate(trendStart.getDate() + offset);
    trendMap.set(dayKey(day), {
      label: `${monthNames[day.getMonth()]} ${day.getDate()}`,
      in: 0,
      out: 0,
    });
  }

  const trendRows = await StockMovement.findAll({
    where: { createdAt: { [Op.gte]: trendStart } },
    attributes: ["type", "quantity", "createdAt"],
  });

  for (const row of trendRows) {
    const bucket = trendMap.get(dayKey(new Date(row.createdAt)));
    if (!bucket) continue;
    const units = Math.abs(Number(row.quantity)) || 0;
    if (row.type === "in") bucket.in += units;
    else if (row.type === "out") bucket.out += units;
  }

  const trend = [...trendMap.values()];
  const trendTotals = {
    in: trend.reduce((sum, day) => sum + day.in, 0),
    out: trend.reduce((sum, day) => sum + day.out, 0),
  };

  // Donut: how much of the catalogue is healthy, low or out of stock.
  const stockHealth = [
    {
      label: "Healthy",
      value: stats.products - stats.lowStock - stats.outOfStock,
      color: "#0f9f6e",
    },
    { label: "Low stock", value: stats.lowStock, color: "#b45309" },
    { label: "Out of stock", value: stats.outOfStock, color: "#d64b4b" },
  ].map((segment) => ({
    ...segment,
    pct: stats.products > 0 ? Math.round((segment.value / stats.products) * 100) : 0,
  }));

  // Columns: the heaviest stocked active products.
  const topProducts = productRows
    .map((product) => ({
      id: product.id,
      name: product.name,
      unit: product.unit,
      quantity: Number(product.quantity),
    }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 6);
  const topMax = Math.max(1, ...topProducts.map((product) => product.quantity));
  const topProductsPct = topProducts.map((product) => ({
    ...product,
    pct: Math.max(2, Math.round((product.quantity / topMax) * 100)),
  }));

  // Bars: inventory value carried by each category.
  const categoryMax = Math.max(1, ...categorySummary.map((entry) => entry.value));
  const categoryBars = categorySummary.map((entry) => ({
    ...entry,
    pct: Math.max(2, Math.round((entry.value / categoryMax) * 100)),
  }));

  return res.render("dashboard", {
    title: "Dashboard",
    section: "Overview",
    active: "dashboard",
    stats,
    lowStock,
    recentMovements,
    categorySummary,
    monthlyMovements,
    trend,
    trendTotals,
    stockHealth,
    topProducts: topProductsPct,
    categoryBars,
  });
});
