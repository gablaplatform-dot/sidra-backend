import { AppError } from "../utils/AppError.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { env } from "../config/env.js";
import { prisma } from "../config/db.js";
import { Roles } from "../constants/enums.js";

const SESSION_ROLES = new Set(Object.values(Roles));

// A session token has a user id and a role and no `purpose`. One-off links (onboarding, admin invites)
// are signed with the same secret but are not sessions and must never work as one.
const sessionFrom = (payload) => {
  if (!payload || typeof payload.sub !== "string" || !payload.sub) return null;
  if (payload.purpose) return null;
  if (!SESSION_ROLES.has(payload.role)) return null;
  return { id: payload.sub, role: payload.role, roleId: payload.roleId ?? null };
};

// Suspending or deactivating an account must stop it working now, not when its token expires. The flag is
// re-read from the user row, with a short cache so this is not a query on every request.
const ACTIVE_TTL_MS = 15 * 1000;
const activeCache = new Map();
export const forgetUserActive = (userId) => activeCache.delete(String(userId));
const isUserActive = async (userId) => {
  const hit = activeCache.get(userId);
  if (hit && Date.now() - hit.at < ACTIVE_TTL_MS) return hit.active;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isActive: true } });
  const active = Boolean(user) && user.isActive !== false;
  if (activeCache.size > 5000) activeCache.clear();
  activeCache.set(userId, { active, at: Date.now() });
  return active;
};

export const requireAuth = (allowedRoles = []) => {
  return async (req, _res, next) => {
    const header = req.headers.authorization ?? "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
      return next(new AppError({ message: "Unauthorized", statusCode: 401, code: "UNAUTHORIZED" }));
    }

    let session;
    try {
      session = sessionFrom(verifyAccessToken({ token, secret: env.jwtSecret, issuer: env.jwtIssuer }));
    } catch {
      session = null;
    }
    if (!session) return next(new AppError({ message: "Unauthorized", statusCode: 401, code: "UNAUTHORIZED" }));

    try {
      if (!(await isUserActive(session.id))) {
        return next(new AppError({ message: "This account is not active.", statusCode: 403, code: "ACCOUNT_INACTIVE" }));
      }
    } catch (error) {
      return next(error);
    }

    req.user = session;
    if (allowedRoles.length && !allowedRoles.includes(req.user.role)) {
      return next(new AppError({ message: "Forbidden", statusCode: 403, code: "FORBIDDEN" }));
    }
    next();
  };
};

export const optionalAuth = () => {
  return (req, _res, next) => {
    const header = req.headers.authorization ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) return next();

    try {
      const session = sessionFrom(verifyAccessToken({ token, secret: env.jwtSecret, issuer: env.jwtIssuer }));
      if (session) req.user = session;
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
