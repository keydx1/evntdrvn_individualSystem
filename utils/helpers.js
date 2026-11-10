const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-PH");

export const number = (value) => numberFormatter.format(Number(value) || 0);

export const money = (value) => currencyFormatter.format(Number(value) || 0);

export const formatDate = (value) => {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const formatDateTime = (value) => {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const dateInput = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const initials = (name = "") => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export const signed = (value) => {
  const amount = Number(value) || 0;
  if (amount > 0) return `+${amount}`;
  return String(amount);
};

export const stockStatus = (product) => {
  if (Number(product.quantity) <= 0) {
    return { label: "Out of stock", className: "danger" };
  }
  if (Number(product.quantity) <= Number(product.reorderLevel)) {
    return { label: "Low stock", className: "warning" };
  }
  return { label: "In stock", className: "success" };
};

export const userRoleLabel = (role) => (role === "admin" ? "Administrator" : "Staff");

export const movementLabel = (type) =>
  ({ in: "Stock in", out: "Stock out", adjustment: "Adjustment" })[type] || type;

export const movementClass = (type) =>
  ({ in: "success", out: "danger", adjustment: "info" })[type] || "muted";

export const pageNumber = (value, fallback = 1) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const buildPagination = ({ page, perPage, total, path, query = {} }) => {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(Math.max(1, page), totalPages);

  const urlFor = (target) => {
    const params = new URLSearchParams();
    for (const [key, raw] of Object.entries(query)) {
      if (key === "page" || raw === undefined || raw === null || raw === "") continue;
      if (Array.isArray(raw)) {
        raw.forEach((item) => params.append(key, item));
      } else {
        params.set(key, raw);
      }
    }
    if (target > 1) params.set("page", String(target));
    const queryString = params.toString();
    return queryString ? `${path}?${queryString}` : path;
  };

  const pages = [];
  const add = (target) =>
    pages.push({ number: target, url: urlFor(target), active: target === current });

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i += 1) add(i);
  } else {
    add(1);
    if (current > 3) pages.push({ ellipsis: true });
    const start = Math.max(2, current - 1);
    const end = Math.min(totalPages - 1, current + 1);
    for (let i = start; i <= end; i += 1) add(i);
    if (current < totalPages - 2) pages.push({ ellipsis: true });
    add(totalPages);
  }

  return {
    page: current,
    perPage,
    total,
    totalPages,
    hasPrev: current > 1,
    hasNext: current < totalPages,
    prevUrl: urlFor(current - 1),
    nextUrl: urlFor(current + 1),
    pages,
    firstItem: total === 0 ? 0 : (current - 1) * perPage + 1,
    lastItem: Math.min(current * perPage, total),
  };
};

export const makeReference = (prefix) => {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${date}-${suffix}`;
};

const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export const sendCsv = (res, filename, rows) => {
  const body = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(`\uFEFF${body}`);
};

export const startOfMonthInput = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
};

export const todayInput = () => dateInput(new Date());

export const parseDateStart = (value) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const parseDateEnd = (value) => {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date;
};
