import { AppError } from "../utils/AppError.js";

export const errorMiddleware = (err, _req, res, _next) => {
  const safeError =
    err instanceof AppError
      ? err
      : new AppError({ message: "Internal Server Error", statusCode: 500, code: "INTERNAL_ERROR" });

  res.status(safeError.statusCode).json({
    error: {
      code: safeError.code,
      message: safeError.message,
      details: safeError.details
    }
  });
};

