import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { User } from "../models/index.js";
import { ApiError } from "../utils/apiErrors.js";

const DEFAULT_SCOPES = {
  pos: ["inventory:read", "inventory:write"],
  customers: ["inventory:read", "ledger:read"],
  hr: ["inventory:read", "ledger:read"],
  accounting: ["inventory:read", "ledger:read"],
};

const SERVICE_EMAILS = {
  pos: "pos-system@integration.local",
  customers: "customers-system@integration.local",
  hr: "hr-system@integration.local",
  accounting: "accounting-system@integration.local",
};

let tokenCache = null;
const actorCache = new Map();

const safeJson = (value, fallback) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const loadTokens = () => {
  if (tokenCache) return tokenCache;

  const configuredScopes = safeJson(process.env.API_SCOPES || "{}", {});
  const tokens = safeJson(process.env.API_TOKENS || "{}", {});

  tokenCache = Object.entries(tokens)
    .filter(([, token]) => typeof token === "string" && token.trim().length >= 8)
    .map(([service, token]) => ({
      service,
      token: token.trim(),
      scopes: Array.isArray(configuredScopes[service])
        ? configuredScopes[service]
        : DEFAULT_SCOPES[service] || ["inventory:read"],
    }));

  return tokenCache;
};

const findService = (provided) => {
  const candidate = Buffer.from(provided);
  for (const entry of loadTokens()) {
    const expected = Buffer.from(entry.token);
    if (expected.length === candidate.length && crypto.timingSafeEqual(expected, candidate)) {
      return entry;
    }
  }
  return null;
};

/**
 * stock_movements.userId is NOT NULL, so every integrated system gets its own
 * actor row. The password is random and unusable, so these accounts cannot log in.
 */
const resolveServiceActor = async (service) => {
  if (actorCache.has(service)) return actorCache.get(service);

  const email = SERVICE_EMAILS[service] || `${service}-system@integration.local`;
  const [user] = await User.findOrCreate({
    where: { email },
    defaults: {
      name: `${service} integration`,
      email,
      password: await bcrypt.hash(crypto.randomUUID(), 8),
      role: "staff",
      isActive: true,
    },
  });

  actorCache.set(service, user);
  return user;
};

export const apiAuth = async (req, res, next) => {
  try {
    const header = req.get("authorization") || "";
    const [scheme, rawToken] = header.split(" ");
    const token = String(rawToken || "").trim();

    if (!/^Bearer$/i.test(scheme) || !token) {
      throw new ApiError(
        "UNAUTHORIZED",
        "Missing service token. Send: Authorization: Bearer <token>."
      );
    }

    const entry = findService(token);
    if (!entry) throw new ApiError("UNAUTHORIZED", "Invalid service token.");

    req.service = { name: entry.service, scopes: entry.scopes };
    req.serviceUser = await resolveServiceActor(entry.service);
    return next();
  } catch (error) {
    return next(error);
  }
};

export const requireScope = (scope) => (req, res, next) => {
  if (!req.service?.scopes?.includes(scope)) {
    return next(
      new ApiError("FORBIDDEN", `This service token is missing the required scope: ${scope}.`)
    );
  }
  return next();
};

export const resetApiAuthCache = () => {
  tokenCache = null;
  actorCache.clear();
};
