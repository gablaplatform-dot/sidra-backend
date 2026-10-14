import { AppError } from "../utils/AppError.js";

// Known non-AppError failures that are the caller's fault, not ours.
const fromKnown = (err) => {
  if (err?.type === "entity.parse.failed") return new AppError({ message: "The request body isn't valid JSON.", statusCode: 400, code: "INVALID_JSON" });
  if (err?.type === "entity.too.large") return new AppError({ message: "The request is too large.", statusCode: 413, code: "PAYLOAD_TOO_LARGE" });
  if (err?.code === "P2025") return new AppError({ message: "Not found", statusCode: 404, code: "NOT_FOUND" });
  if (err?.code === "P2002") return new AppError({ message: "That already exists.", statusCode: 409, code: "ALREADY_EXISTS" });
  return null;
};

export const errorMiddleware = (err, req, res, _next) => {
  const safeError =
    err instanceof AppError
      ? err
      : fromKnown(err) ?? new AppError({ message: "Internal Server Error", statusCode: 500, code: "INTERNAL_ERROR" });

  // Server errors are logged (with the path, never the body) so failures aren't silent; client errors are not.
  if (safeError.statusCode >= 500) {
    process.stderr.write(`[error] ${req.method} ${String(req.originalUrl).split("?")[0]} -> ${safeError.statusCode} ${safeError.code}: ${err?.message ?? ""}\n`);
  }

  res.status(safeError.statusCode).json({
    error: {
      code: safeError.code,
      message: safeError.message,
      // Details can carry gateway responses and internals, so they are only shown for client errors.
      details: safeError.statusCode >= 500 ? undefined : safeError.details
    }
  });
};
