// Single source of truth for admin permission keys - consumed by requirePermission
// (src/middlewares/auth.middleware.js), the admin/role services, and GET /admin/permissions
// (which the admin_ui reads instead of keeping its own copy).
export const PERMISSIONS = Object.freeze([
  { key: "users", label: "Users management", group: "Core", description: "View and suspend end-user accounts." },
  { key: "providers", label: "Providers management", group: "Core", description: "Approve, moderate and manage providers." },
  { key: "categories", label: "Categories", group: "Core", description: "Manage directory and shop categories." },
  { key: "listings", label: "Listings", group: "Core", description: "Manage provider listings and products." },
  { key: "reviews", label: "Reviews", group: "Core", description: "Moderate provider reviews." },
  { key: "inquiries", label: "Inquiries", group: "Core", description: "View and resolve customer inquiries." },
  { key: "orders", label: "Orders", group: "Core", description: "View and update marketplace orders." },
  { key: "media", label: "Media", group: "Core", description: "Manage uploaded media assets." },
  { key: "transactions", label: "Transactions", group: "Finance", description: "View platform transactions." },
  { key: "wallets", label: "Wallets", group: "Finance", description: "View provider and platform wallets and withdrawals." },
  { key: "subscriptions", label: "Subscriptions", group: "Finance", description: "View provider subscriptions." },
  { key: "reports", label: "Reports", group: "System", description: "View analytics and reports." },
  { key: "settings", label: "Platform settings", group: "System", description: "Edit platform-wide settings." },
  { key: "adminroles", label: "Admins & roles", group: "System", description: "Manage admin accounts, invites and roles." }
]);

export const PERMISSION_KEYS = Object.freeze(PERMISSIONS.map((p) => p.key));

export const isValidPermissionKey = (key) => PERMISSION_KEYS.includes(key);

// The 4 seeded starting roles - matches src/services/bootstrap.service.js, prisma/seed.js and
// scripts/backfill-admin-roles.js, which all upsert these same rows.
export const SYSTEM_ROLES = Object.freeze([
  { key: "super_admin", name: "Super Admin", description: "Full access to every module.", permissions: ["*"], isSystem: true, isProtected: true },
  { key: "operations", name: "Operations", description: "Providers, users and activity review.", permissions: ["users", "providers", "categories", "listings", "reviews", "inquiries", "orders"], isSystem: true, isProtected: false },
  { key: "finance", name: "Finance", description: "Transactions, wallets and payouts.", permissions: ["transactions", "wallets", "subscriptions", "reports"], isSystem: true, isProtected: false },
  { key: "auditor", name: "Auditor", description: "Read-only reporting access.", permissions: ["reports"], isSystem: true, isProtected: false }
]);
