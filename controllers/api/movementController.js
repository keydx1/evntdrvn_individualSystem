import crypto from "node:crypto";
import { Op, col, fn } from "sequelize";
import {
  ApiIdempotency,
  Product,
  StockMovement,
  User,
  sequelize,
} from "../../models/index.js";
import { recordStockMovement } from "../../services/stockService.js";
import { ValidationError } from "../../utils/validation.js";
import { ApiError, asyncApi, badRequest } from "../../utils/apiErrors.js";
import {
  integerInput,
  isoOffset,
  money,
  pageMeta,
  parseDateInput,
} from "../../utils/apiFormat.js";

const SOURCE_SYSTEMS = ["pos", "customers", "hr", "accounting", "manual"];
const TYPES = ["in", "out", "adjustment"];
const MAX_LINES = 100;

const hashBody = (value) => crypto.createHash("sha256").update(value).digest("hex");

const parseMoneyInput = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const text = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    throw badRequest(`Invalid unit_cost: ${value}. Use a decimal with at most 2 places.`);
  }
  return Number(text).toFixed(2);
};

const serializeMovement = (movement) => ({
  id: movement.id,
  type: movement.type,
  quantity: Number(movement.quantity),
  previous_stock: Number(movement.previousStock),
  new_stock: Number(movement.newStock),
  unit_cost: money(movement.unitCost),
  reference: movement.reference,
  customer_ref: movement.customerRef ?? null,
  source_system: movement.sourceSystem ?? null,
  notes: movement.notes,
  occurred_at: isoOffset(movement.occurredAt || movement.createdAt),
  created_at: isoOffset(movement.createdAt),
  product: movement.product
    ? {
        id: movement.product.id,
        sku: movement.product.sku,
        name: movement.product.name,
        unit: movement.product.unit,
      }
    : null,
  actor: movement.user
    ? {
        user_id: movement.user.id,
        name: movement.user.name,
        external_employee_id: movement.user.externalEmployeeId ?? null,
      }
    : null,
});

const dateConditions = (from, to) => {
  if (!from && !to) return [];

  const range = {};
  if (from) range[Op.gte] = from;
  if (to) range[Op.lte] = to;

  // Rows created before occurred_at existed fall back to createdAt.
  return [
    {
      [Op.or]: [
        { occurredAt: range },
        { occurredAt: null, createdAt: range },
      ],
    },
  ];
};

export const listMovements = asyncApi(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const requested = Number.parseInt(req.query.per_page, 10) || 50;
  const perPage = Math.min(Math.max(1, requested), 500);
  const offset = (page - 1) * perPage;

  const from = parseDateInput(req.query.from, { endOfDay: false });
  const to = parseDateInput(req.query.to, { endOfDay: true });
  if (req.query.from && !from) throw badRequest("Invalid `from` date. Use ISO-8601.");
  if (req.query.to && !to) throw badRequest("Invalid `to` date. Use ISO-8601.");

  const conditions = [...dateConditions(from, to)];

  if (req.query.type) {
    const type = String(req.query.type);
    if (!TYPES.includes(type)) throw badRequest(`Invalid type: ${type}.`);
    conditions.push({ type });
  }

  if (req.query.source_system) {
    conditions.push({ sourceSystem: String(req.query.source_system) });
  }

  if (req.query.reference) {
    conditions.push({ reference: String(req.query.reference) });
  }

  if (req.query.customer_ref) {
    conditions.push({ customerRef: String(req.query.customer_ref) });
  }

  if (req.query.sku) {
    const product = await Product.findOne({
      where: { sku: String(req.query.sku) },
      attributes: ["id"],
    });
    if (!product) {
      return res.json({
        data: [],
        totals: { in_total: 0, out_total: 0, adjustment_total: 0 },
        meta: pageMeta(req, { page, perPage, total: 0 }),
      });
    }
    conditions.push({ productId: product.id });
  }

  const where = conditions.length ? { [Op.and]: conditions } : {};

  const [count, rows, totals] = await Promise.all([
    StockMovement.count({ where }),
    StockMovement.findAll({
      where,
      include: [
        { model: Product, as: "product", attributes: ["id", "sku", "name", "unit"] },
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "externalEmployeeId"],
        },
      ],
      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],
      limit: perPage,
      offset,
    }),
    StockMovement.findAll({
      where,
      attributes: ["type", [fn("SUM", col("quantity")), "total"]],
      group: ["type"],
      raw: true,
    }),
  ]);

  const summary = { in_total: 0, out_total: 0, adjustment_total: 0 };
  for (const row of totals) {
    const value = Number(row.total) || 0;
    if (row.type === "in") summary.in_total = value;
    if (row.type === "out") summary.out_total = Math.abs(value);
    if (row.type === "adjustment") summary.adjustment_total = value;
  }

  return res.json({
    data: rows.map(serializeMovement),
    totals: summary,
    meta: pageMeta(req, { page, perPage, total: count }),
  });
});

const normalizeBulkBody = (body, service) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw badRequest("Request body must be a JSON object.");
  }

  const sourceSystem = String(body.source_system || service).trim();
  if (!SOURCE_SYSTEMS.includes(sourceSystem)) {
    throw badRequest(
      `Invalid source_system: ${sourceSystem}. Allowed: ${SOURCE_SYSTEMS.join(", ")}.`
    );
  }

  const reference = String(body.reference ?? "").trim();
  if (!reference) throw badRequest("`reference` is required (receipt, order, or document number).");
  if (reference.length > 60) throw badRequest("`reference` must be 60 characters or fewer.");

  const customerRef = body.customer_ref ? String(body.customer_ref).trim() : null;
  if (customerRef && customerRef.length > 64) {
    throw badRequest("`customer_ref` must be 64 characters or fewer.");
  }

  let occurredAt = null;
  if (body.occurred_at) {
    occurredAt = parseDateInput(body.occurred_at, { endOfDay: false });
    if (!occurredAt) throw badRequest("Invalid `occurred_at`. Use ISO-8601.");
  }

  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    throw badRequest("`lines` must be a non-empty array.");
  }
  if (body.lines.length > MAX_LINES) {
    throw badRequest(`A batch may contain at most ${MAX_LINES} lines.`);
  }

  const seen = new Set();
  const lines = body.lines.map((raw, index) => {
    if (!raw || typeof raw !== "object") {
      throw badRequest(`Line ${index + 1} must be an object.`);
    }

    const sku = String(raw.sku ?? "").trim();
    if (!sku) throw badRequest(`Line ${index + 1} is missing \`sku\`.`);

    const type = String(raw.type ?? "").trim();
    if (!TYPES.includes(type)) {
      throw badRequest(`Line ${index + 1} has an invalid type. Use in, out, or adjustment.`);
    }

    const quantity = integerInput(raw.quantity);
    if (quantity === null || quantity <= 0) {
      throw badRequest(
        `Line ${index + 1}: \`quantity\` must be a positive whole number (fractions are not supported).`
      );
    }

    const marker = `${sku}::${type}`;
    if (seen.has(marker)) {
      throw badRequest(
        `Line ${index + 1} duplicates ${sku} with type ${type}. Merge the lines before sending.`
      );
    }
    seen.add(marker);

    return {
      sku,
      type,
      quantity,
      unitCost: parseMoneyInput(raw.unit_cost),
      reason: raw.reason ?? raw.notes ?? null,
    };
  });

  return {
    sourceSystem,
    reference,
    customerRef,
    occurredAt,
    lines,
  };
};

const mapStockError = (error) => {
  if (error instanceof ApiError) return error;

  if (error instanceof ValidationError) {
    const message = error.message || "Invalid stock movement.";
    if (/on hand/i.test(message)) {
      return new ApiError("INSUFFICIENT_STOCK", message);
    }
    return new ApiError("VALIDATION_ERROR", message);
  }

  if (error?.name === "SequelizeUniqueConstraintError") {
    return new ApiError(
      "CONFLICT",
      "This reference was already recorded for one of the products. Use a unique reference per movement batch."
    );
  }

  return error;
};

export const createBulkMovements = asyncApi(async (req, res) => {
  const service = req.service.name;
  const idempotencyKey = String(req.get("idempotency-key") || "").trim();

  if (idempotencyKey.length < 8 || idempotencyKey.length > 128) {
    throw badRequest("`Idempotency-Key` header is required (8-128 characters).");
  }

  const payload = normalizeBulkBody(req.body, service);
  const requestHash = hashBody(JSON.stringify(payload));

  const existing = await ApiIdempotency.findOne({
    where: { service, idempotencyKey },
  });

  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new ApiError(
        "DUPLICATE_REQUEST",
        "This Idempotency-Key was already used with a different request body."
      );
    }

    const replay = JSON.parse(existing.responseBody);
    replay.data.idempotent_replay = true;
    replay.meta = { ...(replay.meta || {}), request_id: req.id ?? null };
    return res.status(200).json(replay);
  }

  const skus = [...new Set(payload.lines.map((line) => line.sku))];
  const products = await Product.findAll({ where: { sku: skus } });
  const bySku = new Map(products.map((product) => [product.sku, product]));

  const missing = skus.filter((sku) => !bySku.has(sku));
  if (missing.length > 0) {
    throw new ApiError("VALIDATION_ERROR", "One or more SKUs do not exist.", { missing_skus: missing });
  }

  const archived = skus.filter((sku) => !bySku.get(sku).isActive);
  if (archived.length > 0) {
    throw new ApiError("CONFLICT", "Archived products cannot receive stock movements.", {
      archived_skus: archived,
    });
  }

  const ttlDays = Math.max(1, Number.parseInt(process.env.IDEMPOTENCY_TTL_DAYS, 10) || 7);
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  const transaction = await sequelize.transaction();

  try {
    const results = [];

    for (const line of payload.lines) {
      const product = bySku.get(line.sku);
      const isAdjustment = line.type === "adjustment";

      const { movement } = await recordStockMovement({
        productId: product.id,
        userId: req.serviceUser.id,
        type: line.type,
        quantity: isAdjustment ? 0 : line.quantity,
        newQuantity: isAdjustment ? line.quantity : null,
        unitCost: line.unitCost,
        reference: payload.reference,
        notes: line.reason,
        customerRef: payload.customerRef,
        sourceSystem: payload.sourceSystem,
        occurredAt: payload.occurredAt,
        transaction,
      });

      results.push({
        sku: line.sku,
        movement_id: movement.id,
        previous_stock: Number(movement.previousStock),
        new_stock: Number(movement.newStock),
        status: "applied",
      });
    }

    const responseBody = {
      data: {
        reference: payload.reference,
        idempotent_replay: false,
        lines: results,
      },
      meta: { request_id: req.id ?? null },
    };

    await ApiIdempotency.create(
      {
        service,
        idempotencyKey,
        endpoint: "POST /api/v1/stock/movements/bulk",
        requestHash,
        responseStatus: 201,
        responseBody: JSON.stringify(responseBody),
        expiresAt,
      },
      { transaction }
    );

    await transaction.commit();
    return res.status(201).json(responseBody);
  } catch (error) {
    await transaction.rollback();

    if (error?.name === "SequelizeUniqueConstraintError") {
      const raced = await ApiIdempotency.findOne({ where: { service, idempotencyKey } });
      if (raced && raced.requestHash === requestHash) {
        const replay = JSON.parse(raced.responseBody);
        replay.data.idempotent_replay = true;
        replay.meta = { ...(replay.meta || {}), request_id: req.id ?? null };
        return res.status(200).json(replay);
      }
      if (raced) {
        throw new ApiError(
          "DUPLICATE_REQUEST",
          "This Idempotency-Key was already used with a different request body."
        );
      }
    }

    throw mapStockError(error);
  }
});

export const stockValuation = asyncApi(async (req, res) => {
  const asOf = req.query.as_of ? parseDateInput(req.query.as_of, { endOfDay: true }) : null;
  if (req.query.as_of && !asOf) throw badRequest("Invalid `as_of` date. Use ISO-8601.");

  const conditions = [{ isActive: true }];
  if (req.query.category_id) {
    const categoryId = Number.parseInt(req.query.category_id, 10);
    if (Number.isInteger(categoryId)) conditions.push({ categoryId });
  }

  const products = await Product.findAll({
    where: { [Op.and]: conditions },
    order: [["sku", "ASC"]],
  });

  let quantities = null;
  if (asOf) {
    const rows = await StockMovement.findAll({
      attributes: ["productId", [fn("SUM", col("quantity")), "net"]],
      where: {
        [Op.or]: [
          { occurredAt: { [Op.lte]: asOf } },
          { occurredAt: null, createdAt: { [Op.lte]: asOf } },
        ],
      },
      group: ["productId"],
      raw: true,
    });
    quantities = new Map(rows.map((row) => [row.productId, Number(row.net) || 0]));
  }

  const lines = products.map((product) => {
    const quantity = asOf
      ? quantities.get(product.id) ?? 0
      : Number(product.quantity);

    return {
      sku: product.sku,
      name: product.name,
      unit: product.unit,
      quantity,
      unit_cost: money(product.costPrice),
      value: money(quantity * Number(product.costPrice)),
    };
  });

  const total = lines.reduce((sum, line) => sum + Number(line.value || 0), 0);

  return res.json({
    data: {
      as_of: asOf ? isoOffset(asOf) : isoOffset(new Date()),
      costing_method: "standard_cost_snapshot",
      currency: "PHP",
      lines,
      total_value: total.toFixed(2),
    },
    meta: { request_id: req.id ?? null },
  });
});
