// One-off, idempotent migration: seeds the 4 system AdminRole rows and assigns every existing
// role: "admin" user (created back when permissions were a free-form adminPermissions JSON
// array) to the closest-matching role. Run once after `npm run db:push`:
//   node scripts/backfill-admin-roles.js
//
// bootstrap.service.js and prisma/seed.js also upsert the same system roles on their own (they
// run on every boot / fresh setup and can't assume this script already ran), so re-running this
// is always safe.
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

import { SYSTEM_ROLES } from "../src/constants/permissions.js";

dotenv.config();

const prisma = new PrismaClient();

const main = async () => {
  const roleByKey = {};
  for (const role of SYSTEM_ROLES) {
    roleByKey[role.key] = await prisma.adminRole.upsert({ where: { key: role.key }, create: role, update: {} });
  }
  process.stdout.write(`Seeded ${SYSTEM_ROLES.length} system roles.\n`);

  const admins = await prisma.user.findMany({ where: { role: "admin" } });
  let migrated = 0;
  for (const admin of admins) {
    if (admin.adminRoleId) continue;
    const legacyPermissions = Array.isArray(admin.adminPermissions) ? admin.adminPermissions : [];
    const targetKey = legacyPermissions.includes("*") ? "super_admin" : "operations";
    await prisma.user.update({ where: { id: admin.id }, data: { adminRoleId: roleByKey[targetKey].id } });
    process.stdout.write(`Assigned ${admin.email ?? admin.id} -> ${targetKey}\n`);
    migrated += 1;
  }
  process.stdout.write(`Migrated ${migrated} admin(s); ${admins.length - migrated} already had a role.\n`);

  const activeSuperAdmins = await prisma.user.count({
    where: { role: "admin", isActive: true, adminRoleId: roleByKey.super_admin.id }
  });
  if (activeSuperAdmins === 0) {
    process.stderr.write("WARNING: no active Super Admin after backfill. Fix this manually before relying on permission enforcement.\n");
  }
};

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    await prisma.$disconnect();
    throw e;
  });
