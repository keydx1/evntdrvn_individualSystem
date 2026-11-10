import crypto from "node:crypto";

/** Attaches a stable request id so every log line and response can be correlated. */
export const requestId = (req, res, next) => {
  const incoming = req.get("x-request-id");
  const safe = typeof incoming === "string" && incoming.trim().length > 0 && incoming.length <= 128;
  req.id = safe ? incoming.trim() : `req_${crypto.randomUUID()}`;
  res.setHeader("X-Request-Id", req.id);
  next();
};
