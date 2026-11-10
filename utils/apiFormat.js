const pad = (value, size = 2) => String(value).padStart(size, "0");

/** Serialize a DECIMAL(12,2) column (Sequelize returns a string) as a 2-decimal string. */
export const money = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed.toFixed(2);
};

/** ISO-8601 with the station offset so consumers never guess the timezone. */
export const isoOffset = (value, offsetHours = 8) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const shifted = new Date(date.getTime() + offsetHours * 3600 * 1000);
  const sign = offsetHours >= 0 ? "+" : "-";
  const offset = `${sign}${pad(Math.abs(offsetHours))}:00`;

  return (
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}` +
    `T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}${offset}`
  );
};

export const nowIso = () => isoOffset(new Date());

export const parseDateInput = (value, { endOfDay = false } = {}) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? `${text}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+08:00`
    : text;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const pagination = (query) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const requested = Number.parseInt(query.per_page, 10) || 50;
  const perPage = Math.min(Math.max(1, requested), 200);
  return { page, perPage, offset: (page - 1) * perPage };
};

export const pageMeta = (req, { page, perPage, total }) => ({
  request_id: req.id ?? null,
  page,
  per_page: perPage,
  total,
});

export const booleanParam = (value, fallback = null) => {
  if (value === undefined) return fallback;
  const text = String(value).toLowerCase();
  if (["1", "true", "yes"].includes(text)) return true;
  if (["0", "false", "no"].includes(text)) return false;
  return fallback;
};

export const integerInput = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim();
  if (!/^-?\d+$/.test(text)) return null;
  return Number.parseInt(text, 10);
};
