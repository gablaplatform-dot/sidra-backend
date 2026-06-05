import { AppError } from "../utils/AppError.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { env } from "../config/env.js";

export const requireAuth = (allowedRoles = []) => {
  return (req, _res, next) => {
    const header = req.headers.authorization ?? "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
      return next(new AppError({ message: "Unauthorized", statusCode: 401, code: "UNAUTHORIZED" }));
    }

    try {
      const payload = verifyAccessToken({ token, secret: env.jwtSecret, issuer: env.jwtIssuer });
      req.user = { id: payload.sub, role: payload.role };

      if (allowedRoles.length && !allowedRoles.includes(req.user.role)) {
        return next(new AppError({ message: "Forbidden", statusCode: 403, code: "FORBIDDEN" }));
      }

      next();
    } catch {
      next(new AppError({ message: "Unauthorized", statusCode: 401, code: "UNAUTHORIZED" }));
    }
  };
};

export const optionalAuth = () => {
  return (req, _res, next) => {
    const header = req.headers.authorization ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) return next();

    try {
      const payload = verifyAccessToken({ token, secret: env.jwtSecret, issuer: env.jwtIssuer });
      req.user = { id: payload.sub, role: payload.role };
    } catch {
      // Public endpoints still work without a valid optional token.
    }
    next();
  };
};
