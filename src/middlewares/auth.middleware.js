import { AppError } from "../utils/AppError.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { env } from "../config/env.js";
import { prisma } from "../config/db.js";

export const requireAuth = (allowedRoles = []) => {
  return (req, _res, next) => {
    const header = req.headers.authorization ?? "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
      return next(new AppError({ message: "Unauthorized", statusCode: 401, code: "UNAUTHORIZED" }));
    }

    try {
      const payload = verifyAccessToken({ token, secret: env.jwtSecret, issuer: env.jwtIssuer });
      req.user = { id: payload.sub, role: payload.role, roleId: payload.roleId ?? null };

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
      req.user = { id: payload.sub, role: payload.role, roleId: payload.roleId ?? null };
    } catch {
      // Public endpoints still work without a valid optional token.
    }
    next();
  };
};

// Fine-grained admin permission gate - runs after requireAuth([Roles.ADMIN]) on a route, which
// populates req.user. Re-reads the admin's CURRENT role assignment and active status from the
// User row on every request, rather than trusting the roleId embedded in the JWT - a token
// issued before an admin was reassigned to a different role (or deactivated) must not keep
// acting under its old, possibly broader, permission set until it expires.
export const requirePermission = (permissionKey) => {
  return async (req, _res, next) => {
    try {
      if (!req.user?.id) {
        return next(new AppError({ message: "Unauthorized", statusCode: 401, code: "UNAUTHORIZED" }));
      }

      const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { isActive: true, adminRoleId: true } });
      if (!user || user.isActive === false || !user.adminRoleId) {
        return next(new AppError({ message: "Forbidden", statusCode: 403, code: "FORBIDDEN" }));
      }

      const role = await prisma.adminRole.findUnique({ where: { id: user.adminRoleId } });
      const perms = Array.isArray(role?.permissions) ? role.permissions : [];
      if (!perms.includes("*") && !perms.includes(permissionKey)) {
        return next(new AppError({ message: "Forbidden", statusCode: 403, code: "FORBIDDEN" }));
      }

      req.adminRole = role;
      next();
    } catch (e) {
      next(e);
    }
  };
};
