import { prisma } from "../config/db.js";
import { env } from "../config/env.js";
import { SYSTEM_ROLES } from "../constants/permissions.js";

export class BootstrapService {
  constructor({ hashPassword }) {
    this.hashPassword = hashPassword;
  }

  // Runs on every boot (see src/server.js), so - unlike the one-off scripts/backfill-admin-roles.js
  // - it can't assume the system roles already exist; it upserts them itself first.
  async ensureSystemRoles() {
    const roleByKey = {};
    for (const role of SYSTEM_ROLES) {
      roleByKey[role.key] = await prisma.adminRole.upsert({ where: { key: role.key }, create: role, update: {} });
    }
    return roleByKey;
  }

  async ensureDefaultAdmin() {
    const email = String(env.seedAdminEmail ?? "").trim().toLowerCase();
    const password = String(env.seedAdminPassword ?? "");
    const name = String(env.seedAdminName ?? "Admin").trim() || "Admin";
    const phone = String(env.seedAdminPhone ?? "").trim() || null;

    const roleByKey = await this.ensureSystemRoles();

    if (!email || !password) return { skipped: true, reason: "missing_admin_env" };

    const superAdminRoleId = roleByKey.super_admin.id;
    const existing = await prisma.user.findFirst({ where: { email, role: "admin" } });
    if (existing) {
      const updates = {};
      if (existing.name !== name) updates.name = name;
      if ((existing.phone ?? null) !== phone) updates.phone = phone;
      if (existing.isActive === false) updates.isActive = true;
      if (existing.adminRoleId !== superAdminRoleId) updates.adminRoleId = superAdminRoleId;
      if (Object.keys(updates).length) {
        await prisma.user.update({ where: { id: existing.id }, data: updates });
      }
      return { skipped: false, created: false, email };
    }

    const passwordHash = await this.hashPassword(password);
    await prisma.user.create({
      data: {
        name,
        email,
        phone,
        passwordHash,
        role: "admin",
        isActive: true,
        adminRoleId: superAdminRoleId
      }
    });

    return { skipped: false, created: true, email };
  }
}
