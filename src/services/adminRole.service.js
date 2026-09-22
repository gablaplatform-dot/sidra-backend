import { AppError } from "../utils/AppError.js";
import { prisma } from "../config/db.js";
import { PERMISSION_KEYS, isValidPermissionKey } from "../constants/permissions.js";

const slugify = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "role";

const normalizePermissions = (permissions, { allowWildcard = false } = {}) => {
  if (!Array.isArray(permissions)) return [];
  const unique = [...new Set(permissions.map((p) => String(p).trim()))];
  for (const key of unique) {
    if (key === "*") {
      if (!allowWildcard) {
        throw new AppError({ message: "Only the Super Admin role may hold all permissions", statusCode: 400, code: "WILDCARD_NOT_ALLOWED" });
      }
      continue;
    }
    if (!isValidPermissionKey(key)) {
      throw new AppError({ message: `Unknown permission key: ${key}`, statusCode: 400, code: "INVALID_PERMISSION_KEY" });
    }
  }
  return unique;
};

// The "adminroles" permission lets its holder manage other admins AND author new roles - so
// letting any non-super-admin holder grant it (to themselves or anyone else) is a straight
// privilege-escalation path: list every concrete permission key one-by-one (nothing stops that
// short of the "*" wildcard) and you've minted a de-facto Super Admin without ever touching the
// protected role. Only an actual Super Admin may grant this one permission to a role.
const ADMIN_ROLES_PERMISSION = "adminroles";

export class AdminRoleService {
  async _actorIsSuperAdmin(actorId) {
    if (!actorId) return false;
    const actor = await prisma.user.findUnique({ where: { id: actorId }, include: { adminRole: true } });
    return actor?.adminRole?.key === "super_admin";
  }

  async list() {
    const roles = await prisma.adminRole.findMany({ orderBy: [{ isProtected: "desc" }, { isSystem: "desc" }, { name: "asc" }] });
    const counts = await prisma.user.groupBy({ by: ["adminRoleId"], where: { role: "admin", adminRoleId: { not: null } }, _count: { _all: true } });
    const countMap = new Map(counts.map((c) => [c.adminRoleId, c._count._all]));
    return { items: roles.map((r) => this.toDto(r, countMap.get(r.id) ?? 0)) };
  }

  async get({ roleId }) {
    const role = await prisma.adminRole.findUnique({ where: { id: roleId } });
    if (!role) throw new AppError({ message: "Role not found", statusCode: 404, code: "ROLE_NOT_FOUND" });
    return role;
  }

  async create({ name, description, permissions = [], actorId }) {
    const normalizedPermissions = normalizePermissions(permissions);
    if (normalizedPermissions.includes(ADMIN_ROLES_PERMISSION) && !(await this._actorIsSuperAdmin(actorId))) {
      throw new AppError({ message: "Only a Super Admin can grant the admins & roles permission", statusCode: 403, code: "ADMINROLES_GRANT_FORBIDDEN" });
    }
    let key = slugify(name);
    const existing = await prisma.adminRole.findUnique({ where: { key } });
    if (existing) key = `${key}_${Date.now().toString(36)}`;

    const created = await prisma.adminRole.create({
      data: { key, name, description: description ?? "", permissions: normalizedPermissions }
    });
    await this.writeAudit({ actorId, action: "admin.role.create", entityId: created.id, metadata: { name, permissions: normalizedPermissions } });
    return this.toDto(created, 0);
  }

  async update({ roleId, patch, actorId }) {
    const role = await this.get({ roleId });

    const update = {};
    if (patch.name !== undefined) {
      if (role.isProtected) throw new AppError({ message: "The Super Admin role cannot be renamed", statusCode: 409, code: "ROLE_PROTECTED" });
      update.name = patch.name;
    }
    if (patch.description !== undefined) update.description = patch.description ?? "";
    if (patch.permissions !== undefined) {
      if (role.isProtected) {
        throw new AppError({ message: "The Super Admin role's permissions cannot be changed", statusCode: 409, code: "ROLE_PROTECTED" });
      }
      update.permissions = normalizePermissions(patch.permissions);
      if (update.permissions.includes(ADMIN_ROLES_PERMISSION) && !(await this._actorIsSuperAdmin(actorId))) {
        throw new AppError({ message: "Only a Super Admin can grant the admins & roles permission", statusCode: 403, code: "ADMINROLES_GRANT_FORBIDDEN" });
      }
    }

    const updated = await prisma.adminRole.update({ where: { id: roleId }, data: update });
    await this.writeAudit({ actorId, action: "admin.role.update", entityId: roleId, metadata: { before: role, patch: update } });
    const count = await prisma.user.count({ where: { role: "admin", adminRoleId: roleId } });
    return this.toDto(updated, count);
  }

  async remove({ roleId, actorId }) {
    const role = await this.get({ roleId });
    if (role.isSystem || role.isProtected) {
      throw new AppError({ message: "Built-in roles cannot be deleted", statusCode: 409, code: "ROLE_PROTECTED" });
    }
    const assignedCount = await prisma.user.count({ where: { role: "admin", adminRoleId: roleId } });
    if (assignedCount > 0) {
      throw new AppError({ message: "Reassign admins on this role before deleting it", statusCode: 409, code: "ROLE_IN_USE" });
    }
    const pendingInvites = await prisma.adminInvite.count({ where: { roleId, status: "sent" } });
    if (pendingInvites > 0) {
      throw new AppError({ message: "Revoke pending invites for this role before deleting it", statusCode: 409, code: "ROLE_IN_USE" });
    }
    await prisma.adminRole.delete({ where: { id: roleId } });
    await this.writeAudit({ actorId, action: "admin.role.delete", entityId: roleId, metadata: { name: role.name } });
    return { deleted: true };
  }

  // Guards the last-active-Super-Admin invariant. `excludingUserId` lets a caller check "if I
  // remove/demote this specific user, would zero remain" without a race between count and act.
  async ensureAtLeastOneSuperAdmin({ excludingUserId } = {}) {
    const superAdminRole = await prisma.adminRole.findUnique({ where: { key: "super_admin" } });
    if (!superAdminRole) return;
    const remaining = await prisma.user.count({
      where: {
        role: "admin",
        adminRoleId: superAdminRole.id,
        isActive: true,
        ...(excludingUserId ? { id: { not: excludingUserId } } : {})
      }
    });
    if (remaining === 0) {
      throw new AppError({ message: "At least one active Super Admin must remain", statusCode: 409, code: "LAST_SUPER_ADMIN" });
    }
  }

  async writeAudit({ actorId, action, entityId, metadata }) {
    await prisma.auditLog.create({ data: { actorId: actorId ?? null, action, entity: "AdminRole", entityId: entityId ?? null, metadata: metadata ?? {} } });
  }

  toDto(role, adminCount = 0) {
    return {
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description ?? "",
      permissions: Array.isArray(role.permissions) ? role.permissions : [],
      isSystem: Boolean(role.isSystem),
      isProtected: Boolean(role.isProtected),
      adminCount,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt
    };
  }
}

export { PERMISSION_KEYS };
