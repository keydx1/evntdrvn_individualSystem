export class ValidationError extends Error {
  constructor(errors) {
    const list = Array.isArray(errors) ? errors : [errors];
    super(list[0] || "Validation failed.");
    this.name = "ValidationError";
    this.errors = list;
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Collects field values and friendly errors while parsing an HTTP form.
 * Values are kept in their submitted shape so a failed form can be re-rendered.
 */
export class FormValidator {
  constructor(body = {}) {
    this.body = body;
    this.errors = [];
    this.values = {};
  }

  fail(message) {
    this.errors.push(message);
    return this;
  }

  text(field, label, { required = true, min = 1, max = 255, upper = false } = {}) {
    const raw = String(this.body[field] ?? "").trim();
    const value = upper ? raw.toUpperCase() : raw;
    this.values[field] = value;

    if (required && !value) {
      this.errors.push(`${label} is required.`);
    } else if (value && value.length < min) {
      this.errors.push(`${label} must be at least ${min} characters.`);
    } else if (value.length > max) {
      this.errors.push(`${label} must be ${max} characters or fewer.`);
    }

    return value;
  }

  optionalText(field, label, { max = 255 } = {}) {
    const value = String(this.body[field] ?? "").trim();
    this.values[field] = value;
    if (value.length > max) this.errors.push(`${label} must be ${max} characters or fewer.`);
    return value || null;
  }

  email(field, label, { required = false } = {}) {
    const value = String(this.body[field] ?? "").trim().toLowerCase();
    this.values[field] = value;
    if (required && !value) this.errors.push(`${label} is required.`);
    if (value && !EMAIL_PATTERN.test(value)) this.errors.push(`${label} must be a valid email address.`);
    return value || null;
  }

  int(field, label, { min = 0, max = 1_000_000_000, required = true } = {}) {
    const raw = String(this.body[field] ?? "").trim();
    this.values[field] = raw;
    if (!raw) {
      if (required) this.errors.push(`${label} is required.`);
      return null;
    }
    if (!/^-?\d+$/.test(raw)) {
      this.errors.push(`${label} must be a whole number.`);
      return null;
    }
    const value = Number(raw);
    if (value < min || value > max) {
      this.errors.push(`${label} must be between ${min} and ${max}.`);
      return null;
    }
    return value;
  }

  money(field, label, { min = 0, max = 100_000_000 } = {}) {
    const raw = String(this.body[field] ?? "").trim();
    this.values[field] = raw;
    if (!raw) {
      this.errors.push(`${label} is required.`);
      return null;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      this.errors.push(`${label} must be a valid amount.`);
      return null;
    }
    if (value < min || value > max) {
      this.errors.push(`${label} must be between ${min} and ${max}.`);
      return null;
    }
    return Number(value.toFixed(2));
  }

  optionalMoney(field, label, { min = 0, max = 100_000_000 } = {}) {
    const raw = String(this.body[field] ?? "").trim();
    this.values[field] = raw;
    if (!raw) return null;
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      this.errors.push(`${label} must be a valid amount.`);
      return null;
    }
    if (value < min || value > max) {
      this.errors.push(`${label} must be between ${min} and ${max}.`);
      return null;
    }
    return Number(value.toFixed(2));
  }

  oneOf(field, label, allowed, { required = true } = {}) {
    const value = String(this.body[field] ?? "").trim();
    this.values[field] = value;
    if (!value) {
      if (required) this.errors.push(`${label} is required.`);
      return null;
    }
    if (!allowed.includes(value)) {
      this.errors.push(`${label} is invalid.`);
      return null;
    }
    return value;
  }

  date(field, label, { required = false } = {}) {
    const value = String(this.body[field] ?? "").trim();
    this.values[field] = value;
    if (!value) {
      if (required) this.errors.push(`${label} is required.`);
      return null;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      this.errors.push(`${label} must be a valid date.`);
      return null;
    }
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      this.errors.push(`${label} must be a valid date.`);
      return null;
    }
    return value;
  }

  checkbox(field) {
    const raw = this.body[field];
    const checked = raw === "on" || raw === "true" || raw === "1" || raw === true;
    this.values[field] = checked;
    return checked;
  }

  get isValid() {
    return this.errors.length === 0;
  }
}

export const parseId = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const isEmail = (value) => EMAIL_PATTERN.test(String(value || "").trim());
