import { Product, StockMovement, sequelize } from "../models/index.js";
import { ValidationError } from "../utils/validation.js";

/**
 * Applies a stock change and writes the corresponding immutable ledger row.
 * The product row is locked so two simultaneous movements cannot overwrite
 * each other's balance. Pass `transaction` to join an outer all-or-nothing batch.
 */
export const recordStockMovement = async ({
  productId,
  userId,
  type,
  quantity = 0,
  newQuantity = null,
  unitCost = null,
  supplierId = null,
  reference = null,
  notes = null,
  customerRef = null,
  sourceSystem = null,
  occurredAt = null,
  transaction: providedTransaction = null,
}) => {
  if (!["in", "out", "adjustment"].includes(type)) {
    throw new ValidationError("Invalid stock movement type.");
  }

  const transaction = providedTransaction || (await sequelize.transaction());
  const ownsTransaction = !providedTransaction;

  try {
    const product = await Product.findByPk(productId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!product) throw new ValidationError("The selected product no longer exists.");
    if (!product.isActive) throw new ValidationError("Archived products cannot receive stock movements.");

    const previousStock = Number(product.quantity);
    let delta;

    if (type === "in") {
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new ValidationError("Quantity received must be a positive whole number.");
      }
      delta = quantity;
    } else if (type === "out") {
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new ValidationError("Quantity released must be a positive whole number.");
      }
      if (quantity > previousStock) {
        throw new ValidationError(
          `Only ${previousStock} ${product.unit}(s) are on hand. Reduce the quantity or adjust the stock count first.`
        );
      }
      delta = -quantity;
    } else {
      if (!Number.isInteger(newQuantity) || newQuantity < 0) {
        throw new ValidationError("Counted quantity must be zero or a positive whole number.");
      }
      delta = newQuantity - previousStock;
      if (delta === 0) {
        throw new ValidationError(
          "The counted quantity matches the current stock. No adjustment was recorded."
        );
      }
    }

    const newStock = previousStock + delta;
    const updates = { quantity: newStock };

    let appliedUnitCost = null;
    if (type === "in") {
      appliedUnitCost = unitCost ?? null;
      if (unitCost !== null && unitCost !== undefined) {
        updates.costPrice = unitCost;
      }
    } else {
      // Cost snapshot so Accounting always has a value for issues and adjustments.
      appliedUnitCost = unitCost ?? product.costPrice ?? null;
    }

    await product.update(updates, { transaction });

    const movement = await StockMovement.create(
      {
        productId: product.id,
        userId,
        supplierId: supplierId || null,
        type,
        quantity: delta,
        previousStock,
        newStock,
        unitCost: appliedUnitCost,
        reference,
        notes,
        customerRef: customerRef || null,
        sourceSystem: sourceSystem || null,
        occurredAt: occurredAt || new Date(),
      },
      { transaction }
    );

    if (ownsTransaction) await transaction.commit();
    return { product, movement };
  } catch (error) {
    if (ownsTransaction) await transaction.rollback();
    throw error;
  }
};
