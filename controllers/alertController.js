import { Category, Product, Supplier } from "../models/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parseId } from "../utils/validation.js";

const STATUS_FILTERS = ["low", "out"];

export const alertPage = asyncHandler(async (req, res) => {
  const categoryId = parseId(req.query.category);
  const requestedStatus = String(req.query.status ?? "");
  const status = STATUS_FILTERS.includes(requestedStatus) ? requestedStatus : "";

  const where = { isActive: true };
  if (categoryId) where.categoryId = categoryId;

  const [productRows, categories] = await Promise.all([
    Product.findAll({
      where,
      include: [
        { model: Category, as: "category" },
        { model: Supplier, as: "supplier" },
      ],
      order: [
        ["quantity", "ASC"],
        ["name", "ASC"],
      ],
    }),
    Category.findAll({ order: [["name", "ASC"]] }),
  ]);

  const products = productRows.map((row) => {
    const product = row.toJSON();
    const quantity = Number(product.quantity);
    const reorderLevel = Number(product.reorderLevel);
    const isOut = quantity <= 0;
    const isLow = quantity > 0 && quantity <= reorderLevel;

    return {
      ...product,
      quantity,
      reorderLevel,
      shortfall: Math.max(0, reorderLevel - quantity),
      isOut,
      isLow,
      status: isOut
        ? { label: "Out of stock", className: "danger" }
        : { label: "Low stock", className: "warning" },
    };
  });

  const alerts = products.filter((product) => product.isOut || product.isLow);
  const outOfStock = alerts.filter((product) => product.isOut);
  const lowStock = alerts.filter((product) => product.isLow);

  const visible = status === "out" ? outOfStock : status === "low" ? lowStock : alerts;

  const unitsShort = alerts.reduce((sum, product) => sum + product.shortfall, 0);
  const restockValue = alerts.reduce(
    (sum, product) => sum + product.shortfall * Number(product.costPrice),
    0
  );

  return res.render("alerts/index", {
    title: "Low stock alerts",
    section: "Inventory",
    active: "alerts",
    alerts: visible,
    alertTotal: alerts.length,
    outOfStock,
    lowStock,
    products,
    categories,
    unitsShort,
    restockValue,
    filters: { category: categoryId || "", status },
    resultCount: visible.length,
  });
});
