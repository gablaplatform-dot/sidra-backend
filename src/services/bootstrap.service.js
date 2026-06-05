import { prisma } from "../config/db.js";
import { env } from "../config/env.js";

export class BootstrapService {
  constructor({ hashPassword }) {
    this.hashPassword = hashPassword;
  }

  async ensureDefaultAdmin() {
    const email = String(env.seedAdminEmail ?? "").trim().toLowerCase();
    const password = String(env.seedAdminPassword ?? "");
    const name = String(env.seedAdminName ?? "Admin").trim() || "Admin";
    const phone = String(env.seedAdminPhone ?? "").trim() || null;

    if (!email || !password) return { skipped: true, reason: "missing_admin_env" };

    const existing = await prisma.user.findFirst({ where: { email, role: "admin" } });
    if (existing) {
      const updates = {};
      if (existing.name !== name) updates.name = name;
      if ((existing.phone ?? null) !== phone) updates.phone = phone;
      if (existing.isActive === false) updates.isActive = true;
      if (!Array.isArray(existing.adminPermissions) || !existing.adminPermissions.includes("*")) {
        updates.adminPermissions = ["*"];
      }
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
        adminPermissions: ["*"]
      }
    });

    return { skipped: false, created: true, email };
  }
}
