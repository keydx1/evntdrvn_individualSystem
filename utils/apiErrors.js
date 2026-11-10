export const ERROR_STATUS = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  INSUFFICIENT_STOCK: 409,
  DUPLICATE_REQUEST: 409,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

export class ApiError extends Error {
  constructor(code, message, details = null, status = null) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
    this.status = status || ERROR_STATUS[code] || 500;
  }
}

export const badRequest = (message, details = null) =>
  new ApiError("VALIDATION_ERROR", message, details);

export const asyncApi = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

export const sendApiError = (res, req, error) => {
  const isApiError = error instanceof ApiError;
  const status = isApiError ? error.status : 500;
  const code = isApiError ? error.code : "INTERNAL_ERROR";
  const message = isApiError ? error.message : "An unexpected error occurred.";

  if (!isApiError) {
    console.error(
      JSON.stringify({
        level: "error",
        request_id: req.id,
        method: req.method,
        path: req.originalUrl,
        message: error?.message,
        stack: error?.stack,
      })
    );
  }

  return res.status(status).json({
    error: {
      code,
      message,
      details: isApiError ? error.details : null,
      request_id: req.id ?? null,
    },
  });
};
