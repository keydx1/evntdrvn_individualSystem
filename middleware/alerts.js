import { Product } from "../models/index.js";

/**
 * Counts products that need replenishment so every authenticated page can show
 * the same low-stock notification in the sidebar and top bar.
 */
export const loadStockAlerts = async (req, res, next) => {
  try {
    const products = await Product.findAll({
      where: { isActive: true },
      attributes: ["quantity", "reorderLevel"],
      raw: true,
    });

    let lowStock = 0;
    let outOfStock = 0;

    for (const product of products) {
      const quantity = Number(product.quantity);
      const reorderLevel = Number(product.reorderLevel);

      if (quantity <= 0) outOfStock += 1;
      else if (quantity <= reorderLevel) lowStock += 1;
    }

    res.locals.alertCount = lowStock + outOfStock;
    res.locals.lowStockCount = lowStock;
    res.locals.outOfStockCount = outOfStock;

    return next();
  } catch (error) {
    return next(error);
  }
};
