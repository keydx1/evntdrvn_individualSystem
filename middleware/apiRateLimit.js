import { ApiError } from "../utils/apiErrors.js";

const buckets = new Map();
let lastSweep = Date.now();

/** Simple in-memory sliding window per service token. Good enough for five systems. */
export const apiRateLimit = (req, res, next) => {
  const limit = Math.max(1, Number.parseInt(process.env.RATE_LIMIT_PER_MIN, 10) || 120);
  const key = req.service?.name || req.ip;
  const now = Date.now();
  const windowStart = now - 60_000;

  const hits = (buckets.get(key) || []).filter((timestamp) => timestamp > windowStart);

  if (hits.length >= limit) {
    res.setHeader("Retry-After", "60");
    return next(new ApiError("RATE_LIMITED", "Too many requests. Retry after 60 seconds."));
  }

  hits.push(now);
  buckets.set(key, hits);

  if (now - lastSweep > 300_000) {
    lastSweep = now;
    for (const [bucketKey, timestamps] of buckets.entries()) {
      const recent = timestamps.filter((timestamp) => timestamp > windowStart);
      if (recent.length === 0) buckets.delete(bucketKey);
      else buckets.set(bucketKey, recent);
    }
  }

  return next();
};
