import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import dotenv from "dotenv";

dotenv.config();

const schemaDir = resolve("prisma");

const resolveSqlitePath = (databaseUrl) => {
  if (!databaseUrl?.startsWith("file:")) {
    throw new Error("DATABASE_URL must be a SQLite file: URL, for example file:./dev.db");
  }

  const raw = databaseUrl.slice("file:".length);
  if (!raw) throw new Error("DATABASE_URL file path is empty");
  return isAbsolute(raw) ? raw : resolve(schemaDir, raw);
};

const findSqlite = () => {
  const candidates = [
    process.env.SQLITE3_BIN,
    "sqlite3",
    "/opt/homebrew/bin/sqlite3",
    "/usr/bin/sqlite3",
    "/Volumes/DevDisk/Android/sdk/platform-tools/sqlite3"
  ].filter(Boolean);

  for (const candidate of candidates) {
    const result = spawnSync(candidate, ["--version"], { encoding: "utf8" });
    if (result.status === 0) return candidate;
  }

  throw new Error("sqlite3 binary not found. Set SQLITE3_BIN=/absolute/path/to/sqlite3.");
};

const databasePath = resolveSqlitePath(process.env.DATABASE_URL ?? "file:./dev.db");
mkdirSync(dirname(databasePath), { recursive: true });

const sql = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  passwordHash TEXT NOT NULL DEFAULT '',
  authProvider TEXT NOT NULL DEFAULT 'password',
  googleSub TEXT UNIQUE,
  avatarUrl TEXT,
  profile JSONB NOT NULL DEFAULT '{}',
  role TEXT NOT NULL,
  isActive BOOLEAN NOT NULL DEFAULT 1,
  adminPermissions JSONB NOT NULL DEFAULT '[]',
  adminRoleId TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (adminRoleId) REFERENCES admin_roles(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS admin_roles (
  id TEXT PRIMARY KEY NOT NULL,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  permissions JSONB NOT NULL DEFAULT '[]',
  isSystem BOOLEAN NOT NULL DEFAULT 0,
  isProtected BOOLEAN NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_invites (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  roleId TEXT,
  roleName TEXT NOT NULL DEFAULT '',
  tokenHash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'sent',
  invitedById TEXT,
  sentAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resentCount INTEGER NOT NULL DEFAULT 0,
  lastSentAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acceptedAt DATETIME,
  revokedAt DATETIME,
  expiresAt DATETIME NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (roleId) REFERENCES admin_roles(id) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (invitedById) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  parentId TEXT,
  behavior TEXT NOT NULL DEFAULT 'general',
  viewType TEXT NOT NULL DEFAULT 'directory',
  appView TEXT NOT NULL DEFAULT 'directory',
  providerFields JSONB NOT NULL DEFAULT '[]',
  listingFields JSONB NOT NULL DEFAULT '[]',
  settings JSONB NOT NULL DEFAULT '{}',
  sortOrder INTEGER NOT NULL DEFAULT 0,
  imageUrl TEXT,
  isActive BOOLEAN NOT NULL DEFAULT 1,
  moderationStatus TEXT NOT NULL DEFAULT 'approved',
  createdByProviderId TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parentId) REFERENCES categories(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL UNIQUE,
  businessName TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  categoryId TEXT,
  publicSlug TEXT UNIQUE,
  contact JSONB NOT NULL DEFAULT '{}',
  media JSONB NOT NULL DEFAULT '{}',
  customFields JSONB NOT NULL DEFAULT '{}',
  location JSONB NOT NULL DEFAULT '{}',
  lat REAL,
  lng REAL,
  geohash5 TEXT,
  geohash6 TEXT,
  isApproved BOOLEAN NOT NULL DEFAULT 0,
  moderationStatus TEXT NOT NULL DEFAULT 'pending',
  onboardingStatus TEXT NOT NULL DEFAULT 'draft',
  invitationSentAt DATETIME,
  invitationAcceptedAt DATETIME,
  registeredAt DATETIME,
  ratingAvg REAL NOT NULL DEFAULT 0,
  ratingCount INTEGER NOT NULL DEFAULT 0,
  profileViews INTEGER NOT NULL DEFAULT 0,
  contactClicks INTEGER NOT NULL DEFAULT 0,
  subscriptionStatus TEXT NOT NULL DEFAULT 'none',
  walletEnabled BOOLEAN NOT NULL DEFAULT 0,
  onlinePaymentsEnabled BOOLEAN NOT NULL DEFAULT 1,
  settingsOverrides JSONB NOT NULL DEFAULT '{}',
  availability JSONB NOT NULL DEFAULT '{}',
  verification JSONB NOT NULL DEFAULT '{}',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS shop_categories (
  id TEXT PRIMARY KEY NOT NULL,
  providerId TEXT NOT NULL,
  parentId TEXT,
  name TEXT NOT NULL,
  sortOrder INTEGER NOT NULL DEFAULT 0,
  imageUrl TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (providerId) REFERENCES providers(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (parentId) REFERENCES shop_categories(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS product_categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  parentId TEXT,
  imageUrl TEXT,
  isActive BOOLEAN NOT NULL DEFAULT 1,
  moderationStatus TEXT NOT NULL DEFAULT 'approved',
  createdByProviderId TEXT,
  sortOrder INTEGER NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parentId) REFERENCES product_categories(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS service_products (
  id TEXT PRIMARY KEY NOT NULL,
  providerId TEXT NOT NULL,
  categoryId TEXT,
  productCategoryId TEXT,
  shopCategoryId TEXT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price DECIMAL NOT NULL DEFAULT 0.00,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  featured BOOLEAN NOT NULL DEFAULT 0,
  media JSONB NOT NULL DEFAULT '{}',
  customFields JSONB NOT NULL DEFAULT '{}',
  inventory INTEGER,
  sku TEXT,
  originalPrice DECIMAL NOT NULL DEFAULT 0.00,
  discountPercent INTEGER,
  isNew BOOLEAN NOT NULL DEFAULT 0,
  soldCount INTEGER NOT NULL DEFAULT 0,
  viewCount INTEGER NOT NULL DEFAULT 0,
  onlinePaymentEnabled BOOLEAN NOT NULL DEFAULT 1,
  availability JSONB NOT NULL DEFAULT '{}',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (providerId) REFERENCES providers(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (productCategoryId) REFERENCES product_categories(id) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (shopCategoryId) REFERENCES shop_categories(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS provider_invitations (
  id TEXT PRIMARY KEY NOT NULL,
  providerId TEXT NOT NULL,
  email TEXT NOT NULL,
  tokenHash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'sent',
  sentAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resentCount INTEGER NOT NULL DEFAULT 0,
  lastSentAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acceptedAt DATETIME,
  expiresAt DATETIME NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (providerId) REFERENCES providers(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS admin_settings (
  id TEXT PRIMARY KEY NOT NULL,
  enableSubscription BOOLEAN NOT NULL DEFAULT 1,
  enableContactFee BOOLEAN NOT NULL DEFAULT 1,
  enableWallet BOOLEAN NOT NULL DEFAULT 1,
  enableEcommerce BOOLEAN NOT NULL DEFAULT 1,
  subscriptionFee DECIMAL NOT NULL DEFAULT 0.00,
  contactFee DECIMAL NOT NULL DEFAULT 0.00,
  transactionFeePercent INTEGER NOT NULL DEFAULT 0,
  minimumWithdrawalAmount DECIMAL NOT NULL DEFAULT 0.00,
  platformName TEXT NOT NULL DEFAULT 'Sidra',
  supportEmail TEXT,
  supportPhone TEXT,
  featureFlags JSONB NOT NULL DEFAULT '{}',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contact_unlocks (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT,
  providerId TEXT NOT NULL,
  paid BOOLEAN NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (providerId) REFERENCES providers(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY NOT NULL,
  providerId TEXT NOT NULL,
  amount DECIMAL NOT NULL DEFAULT 0.00,
  expiresAt DATETIME NOT NULL,
  status TEXT NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (providerId) REFERENCES providers(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  userId TEXT,
  providerId TEXT,
  amount DECIMAL NOT NULL DEFAULT 0.00,
  fee DECIMAL NOT NULL DEFAULT 0.00,
  netAmount DECIMAL NOT NULL DEFAULT 0.00,
  metadata JSONB NOT NULL DEFAULT '{}',
  reference TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (providerId) REFERENCES providers(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS wallets (
  id TEXT PRIMARY KEY NOT NULL,
  providerId TEXT UNIQUE,
  balance DECIMAL NOT NULL DEFAULT 0.00,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (providerId) REFERENCES providers(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id TEXT PRIMARY KEY NOT NULL,
  providerId TEXT NOT NULL,
  amount DECIMAL NOT NULL DEFAULT 0.00,
  fee DECIMAL NOT NULL DEFAULT 0.00,
  netAmount DECIMAL NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL,
  transactionId TEXT NOT NULL UNIQUE,
  requestedBy TEXT NOT NULL,
  approvedBy TEXT,
  rejectedBy TEXT,
  paidBy TEXT,
  approvedAt DATETIME,
  rejectedAt DATETIME,
  paidAt DATETIME,
  note TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (providerId) REFERENCES providers(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (transactionId) REFERENCES transactions(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (requestedBy) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (approvedBy) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (rejectedBy) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (paidBy) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS favorites (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  providerId TEXT NOT NULL,
  listingId TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (providerId) REFERENCES providers(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (listingId) REFERENCES service_products(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  providerId TEXT NOT NULL,
  listingId TEXT,
  rating INTEGER NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (providerId) REFERENCES providers(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (listingId) REFERENCES service_products(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS profile_visits (
  id TEXT PRIMARY KEY NOT NULL,
  providerId TEXT NOT NULL,
  userId TEXT,
  source TEXT,
  sessionId TEXT,
  ipHash TEXT,
  userAgent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (providerId) REFERENCES providers(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS contact_events (
  id TEXT PRIMARY KEY NOT NULL,
  providerId TEXT NOT NULL,
  userId TEXT,
  type TEXT NOT NULL,
  value TEXT,
  paid BOOLEAN NOT NULL DEFAULT 0,
  source TEXT,
  sessionId TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (providerId) REFERENCES providers(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS search_events (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT,
  query TEXT,
  categoryId TEXT,
  filters JSONB NOT NULL DEFAULT '{}',
  resultCount INTEGER NOT NULL DEFAULT 0,
  sessionId TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY NOT NULL,
  providerId TEXT,
  ownerId TEXT,
  key TEXT NOT NULL,
  url TEXT NOT NULL,
  mimeType TEXT,
  size INTEGER,
  kind TEXT NOT NULL DEFAULT 'image',
  metadata JSONB NOT NULL DEFAULT '{}',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (providerId) REFERENCES providers(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT,
  providerId TEXT NOT NULL,
  listingId TEXT,
  type TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'new',
  name TEXT,
  email TEXT,
  phone TEXT,
  message TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (providerId) REFERENCES providers(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT,
  providerId TEXT NOT NULL,
  transactionId TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  subtotal DECIMAL NOT NULL DEFAULT 0.00,
  fee DECIMAL NOT NULL DEFAULT 0.00,
  total DECIMAL NOT NULL DEFAULT 0.00,
  customer JSONB NOT NULL DEFAULT '{}',
  fulfillment JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (providerId) REFERENCES providers(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (transactionId) REFERENCES transactions(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY NOT NULL,
  orderId TEXT NOT NULL,
  listingId TEXT,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unitPrice DECIMAL NOT NULL DEFAULT 0.00,
  total DECIMAL NOT NULL DEFAULT 0.00,
  metadata JSONB NOT NULL DEFAULT '{}',
  FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (listingId) REFERENCES service_products(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY NOT NULL,
  actorId TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entityId TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actorId) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS promotions (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  type TEXT NOT NULL DEFAULT 'banner',
  startsAt DATETIME,
  endsAt DATETIME,
  discountPercent INTEGER,
  imageUrl TEXT,
  ctaLabel TEXT,
  ctaHref TEXT,
  listingIds JSONB,
  categoryId TEXT,
  providerId TEXT,
  isFeatured BOOLEAN NOT NULL DEFAULT 0,
  sortOrder INTEGER NOT NULL DEFAULT 0,
  isActive BOOLEAN NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (providerId) REFERENCES providers(id) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS ride_drivers (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL UNIQUE,
  vehicleType TEXT NOT NULL,
  vehicleModel TEXT,
  licensePlate TEXT,
  licensePhotoUrl TEXT,
  isApproved BOOLEAN NOT NULL DEFAULT 0,
  moderationStatus TEXT NOT NULL DEFAULT 'pending',
  rejectionReason TEXT,
  isOnline BOOLEAN NOT NULL DEFAULT 0,
  lat REAL,
  lng REAL,
  geohash5 TEXT,
  geohash6 TEXT,
  lastLocationAt DATETIME,
  ratingAvg REAL NOT NULL DEFAULT 0,
  ratingCount INTEGER NOT NULL DEFAULT 0,
  contact JSONB NOT NULL DEFAULT '{}',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS ride_driver_wallets (
  id TEXT PRIMARY KEY NOT NULL,
  rideDriverId TEXT NOT NULL UNIQUE,
  balance DECIMAL NOT NULL DEFAULT 0.00,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rideDriverId) REFERENCES ride_drivers(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS ride_trips (
  id TEXT PRIMARY KEY NOT NULL,
  riderId TEXT NOT NULL,
  driverId TEXT,
  vehicleType TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'searching',
  pickupLat REAL NOT NULL,
  pickupLng REAL NOT NULL,
  pickupAddress TEXT NOT NULL DEFAULT '',
  dropoffLat REAL NOT NULL,
  dropoffLng REAL NOT NULL,
  dropoffAddress TEXT NOT NULL DEFAULT '',
  estimatedDistanceKm REAL NOT NULL DEFAULT 0,
  estimatedDurationMin REAL NOT NULL DEFAULT 0,
  estimatedFare DECIMAL NOT NULL DEFAULT 0.00,
  finalFare DECIMAL NOT NULL DEFAULT 0.00,
  driverEarning DECIMAL NOT NULL DEFAULT 0.00,
  platformFee DECIMAL NOT NULL DEFAULT 0.00,
  routePolyline TEXT,
  paymentMethod TEXT NOT NULL DEFAULT 'cash',
  paymentStatus TEXT NOT NULL DEFAULT 'pending',
  transactionId TEXT UNIQUE,
  requestedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  matchedAt DATETIME,
  acceptedAt DATETIME,
  riderConfirmedAt DATETIME,
  arrivedAt DATETIME,
  startedAt DATETIME,
  completedAt DATETIME,
  cancelledAt DATETIME,
  cancelReason TEXT,
  riderRating INTEGER,
  driverRating INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (riderId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (driverId) REFERENCES ride_drivers(id) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (transactionId) REFERENCES transactions(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS ride_settings (
  id TEXT PRIMARY KEY NOT NULL,
  vehicleType TEXT NOT NULL UNIQUE,
  baseFare DECIMAL NOT NULL DEFAULT 0.00,
  perKmRate DECIMAL NOT NULL DEFAULT 0.00,
  perMinuteRate DECIMAL NOT NULL DEFAULT 0.00,
  minimumFare DECIMAL NOT NULL DEFAULT 0.00,
  commissionPercent INTEGER NOT NULL DEFAULT 0,
  roadDistanceMultiplier REAL NOT NULL DEFAULT 1.3,
  avgSpeedKmh REAL NOT NULL DEFAULT 25,
  isActive BOOLEAN NOT NULL DEFAULT 1,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ride_drivers_isOnline_vehicleType_geohash6_idx ON ride_drivers(isOnline, vehicleType, geohash6);
CREATE INDEX IF NOT EXISTS ride_drivers_isOnline_vehicleType_geohash5_idx ON ride_drivers(isOnline, vehicleType, geohash5);
CREATE INDEX IF NOT EXISTS ride_drivers_moderationStatus_createdAt_idx ON ride_drivers(moderationStatus, createdAt);
CREATE INDEX IF NOT EXISTS ride_trips_status_requestedAt_idx ON ride_trips(status, requestedAt);
CREATE INDEX IF NOT EXISTS ride_trips_riderId_createdAt_idx ON ride_trips(riderId, createdAt);
CREATE INDEX IF NOT EXISTS ride_trips_driverId_createdAt_idx ON ride_trips(driverId, createdAt);

CREATE UNIQUE INDEX IF NOT EXISTS categories_parentId_name_key ON categories(parentId, name);
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);
CREATE INDEX IF NOT EXISTS users_isActive_idx ON users(isActive);
CREATE INDEX IF NOT EXISTS categories_parentId_idx ON categories(parentId);
CREATE INDEX IF NOT EXISTS categories_behavior_idx ON categories(behavior);
CREATE INDEX IF NOT EXISTS categories_isActive_sortOrder_idx ON categories(isActive, sortOrder);
CREATE INDEX IF NOT EXISTS providers_categoryId_createdAt_idx ON providers(categoryId, createdAt);
CREATE INDEX IF NOT EXISTS providers_isApproved_moderationStatus_createdAt_idx ON providers(isApproved, moderationStatus, createdAt);
CREATE INDEX IF NOT EXISTS providers_discovery_idx ON providers(isApproved, moderationStatus, ratingAvg, ratingCount, createdAt);
CREATE INDEX IF NOT EXISTS service_products_providerId_type_createdAt_idx ON service_products(providerId, type, createdAt);
CREATE INDEX IF NOT EXISTS service_products_status_createdAt_idx ON service_products(status, createdAt);
CREATE INDEX IF NOT EXISTS service_products_featured_status_idx ON service_products(featured, status);
CREATE UNIQUE INDEX IF NOT EXISTS shop_categories_providerId_parentId_name_key ON shop_categories(providerId, parentId, name);
CREATE INDEX IF NOT EXISTS shop_categories_providerId_parentId_idx ON shop_categories(providerId, parentId);
CREATE UNIQUE INDEX IF NOT EXISTS product_categories_parentId_name_key ON product_categories(parentId, name);
CREATE INDEX IF NOT EXISTS product_categories_parentId_idx ON product_categories(parentId);
CREATE INDEX IF NOT EXISTS product_categories_isActive_sortOrder_idx ON product_categories(isActive, sortOrder);
CREATE INDEX IF NOT EXISTS provider_invitations_providerId_status_idx ON provider_invitations(providerId, status);
CREATE INDEX IF NOT EXISTS provider_invitations_email_idx ON provider_invitations(email);
CREATE INDEX IF NOT EXISTS provider_invitations_expiresAt_idx ON provider_invitations(expiresAt);
CREATE UNIQUE INDEX IF NOT EXISTS contact_unlocks_userId_providerId_key ON contact_unlocks(userId, providerId);
CREATE INDEX IF NOT EXISTS contact_unlocks_userId_idx ON contact_unlocks(userId);
CREATE INDEX IF NOT EXISTS contact_unlocks_providerId_idx ON contact_unlocks(providerId);
CREATE INDEX IF NOT EXISTS contact_unlocks_paid_idx ON contact_unlocks(paid);
CREATE INDEX IF NOT EXISTS subscriptions_providerId_expiresAt_idx ON subscriptions(providerId, expiresAt);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions(status);
CREATE INDEX IF NOT EXISTS subscriptions_expiresAt_idx ON subscriptions(expiresAt);
CREATE INDEX IF NOT EXISTS transactions_providerId_createdAt_idx ON transactions(providerId, createdAt);
CREATE INDEX IF NOT EXISTS transactions_userId_createdAt_idx ON transactions(userId, createdAt);
CREATE INDEX IF NOT EXISTS transactions_type_idx ON transactions(type);
CREATE INDEX IF NOT EXISTS transactions_status_idx ON transactions(status);
CREATE INDEX IF NOT EXISTS transactions_reference_idx ON transactions(reference);
CREATE INDEX IF NOT EXISTS withdrawal_requests_providerId_createdAt_idx ON withdrawal_requests(providerId, createdAt);
CREATE INDEX IF NOT EXISTS withdrawal_requests_status_idx ON withdrawal_requests(status);
CREATE UNIQUE INDEX IF NOT EXISTS favorites_userId_providerId_key ON favorites(userId, providerId);
CREATE INDEX IF NOT EXISTS favorites_userId_createdAt_idx ON favorites(userId, createdAt);
CREATE INDEX IF NOT EXISTS favorites_providerId_idx ON favorites(providerId);
CREATE UNIQUE INDEX IF NOT EXISTS reviews_userId_providerId_key ON reviews(userId, providerId);
CREATE INDEX IF NOT EXISTS reviews_providerId_status_createdAt_idx ON reviews(providerId, status, createdAt);
CREATE INDEX IF NOT EXISTS reviews_userId_idx ON reviews(userId);
CREATE INDEX IF NOT EXISTS profile_visits_providerId_createdAt_idx ON profile_visits(providerId, createdAt);
CREATE INDEX IF NOT EXISTS profile_visits_userId_createdAt_idx ON profile_visits(userId, createdAt);
CREATE INDEX IF NOT EXISTS profile_visits_sessionId_idx ON profile_visits(sessionId);
CREATE INDEX IF NOT EXISTS contact_events_providerId_type_createdAt_idx ON contact_events(providerId, type, createdAt);
CREATE INDEX IF NOT EXISTS contact_events_userId_createdAt_idx ON contact_events(userId, createdAt);
CREATE INDEX IF NOT EXISTS contact_events_sessionId_idx ON contact_events(sessionId);
CREATE INDEX IF NOT EXISTS search_events_userId_createdAt_idx ON search_events(userId, createdAt);
CREATE INDEX IF NOT EXISTS search_events_categoryId_createdAt_idx ON search_events(categoryId, createdAt);
CREATE INDEX IF NOT EXISTS search_events_sessionId_idx ON search_events(sessionId);
CREATE INDEX IF NOT EXISTS media_assets_providerId_createdAt_idx ON media_assets(providerId, createdAt);
CREATE INDEX IF NOT EXISTS media_assets_ownerId_createdAt_idx ON media_assets(ownerId, createdAt);
CREATE INDEX IF NOT EXISTS media_assets_kind_idx ON media_assets(kind);
CREATE INDEX IF NOT EXISTS inquiries_providerId_status_createdAt_idx ON inquiries(providerId, status, createdAt);
CREATE INDEX IF NOT EXISTS inquiries_userId_createdAt_idx ON inquiries(userId, createdAt);
CREATE INDEX IF NOT EXISTS inquiries_type_idx ON inquiries(type);
CREATE INDEX IF NOT EXISTS orders_providerId_status_createdAt_idx ON orders(providerId, status, createdAt);
CREATE INDEX IF NOT EXISTS orders_userId_createdAt_idx ON orders(userId, createdAt);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX IF NOT EXISTS order_items_orderId_idx ON order_items(orderId);
CREATE INDEX IF NOT EXISTS order_items_listingId_idx ON order_items(listingId);
CREATE INDEX IF NOT EXISTS audit_logs_actorId_createdAt_idx ON audit_logs(actorId, createdAt);
CREATE INDEX IF NOT EXISTS audit_logs_entity_entityId_idx ON audit_logs(entity, entityId);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs(action);
`;

const sqlite = findSqlite();
const result = spawnSync(sqlite, [databasePath], { input: sql, encoding: "utf8" });

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout || "sqlite schema sync failed\n");
  process.exit(result.status ?? 1);
}

const runSql = (statement) => {
  const res = spawnSync(sqlite, [databasePath], { input: statement, encoding: "utf8" });
  if (res.status !== 0) {
    process.stderr.write(res.stderr || res.stdout || `sqlite statement failed: ${statement}\n`);
    process.exit(res.status ?? 1);
  }
  return res.stdout;
};

const ensureColumn = (table, column, definition) => {
  const info = runSql(`PRAGMA table_info(${table});`);
  const exists = info
    .split("\n")
    .filter(Boolean)
    .some((line) => line.split("|")[1] === column);
  if (!exists) runSql(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
};

[
  ["users", "authProvider", "TEXT NOT NULL DEFAULT 'password'"],
  ["users", "googleSub", "TEXT"],
  ["users", "avatarUrl", "TEXT"],
  ["users", "profile", "JSONB NOT NULL DEFAULT '{}'"],
  ["categories", "viewType", "TEXT NOT NULL DEFAULT 'directory'"],
  ["categories", "appView", "TEXT NOT NULL DEFAULT 'directory'"],
  ["providers", "publicSlug", "TEXT"],
  ["providers", "onboardingStatus", "TEXT NOT NULL DEFAULT 'draft'"],
  ["providers", "invitationSentAt", "DATETIME"],
  ["providers", "invitationAcceptedAt", "DATETIME"],
  ["providers", "registeredAt", "DATETIME"],
  ["providers", "profileViews", "INTEGER NOT NULL DEFAULT 0"],
  ["providers", "contactClicks", "INTEGER NOT NULL DEFAULT 0"],
  ["providers", "onlinePaymentsEnabled", "BOOLEAN NOT NULL DEFAULT 1"],
  ["service_products", "categoryId", "TEXT"],
  ["service_products", "onlinePaymentEnabled", "BOOLEAN NOT NULL DEFAULT 1"],
  ["service_products", "shopCategoryId", "TEXT"],
  ["ride_drivers", "licensePhotoUrl", "TEXT"],
  ["ride_drivers", "rejectionReason", "TEXT"],
  ["ride_trips", "acceptedAt", "DATETIME"],
  ["ride_trips", "riderConfirmedAt", "DATETIME"],
  ["ride_trips", "routePolyline", "TEXT"],
  ["categories", "moderationStatus", "TEXT NOT NULL DEFAULT 'approved'"],
  ["categories", "createdByProviderId", "TEXT"],
  ["categories", "imageUrl", "TEXT"],
  ["shop_categories", "imageUrl", "TEXT"],
  ["service_products", "originalPrice", "DECIMAL NOT NULL DEFAULT 0.00"],
  ["service_products", "discountPercent", "INTEGER"],
  ["service_products", "isNew", "BOOLEAN NOT NULL DEFAULT 0"],
  ["service_products", "soldCount", "INTEGER NOT NULL DEFAULT 0"],
  ["service_products", "viewCount", "INTEGER NOT NULL DEFAULT 0"],
  ["favorites", "listingId", "TEXT"],
  ["reviews", "listingId", "TEXT"],
  ["service_products", "productCategoryId", "TEXT"],
  ["providers", "lat", "REAL"],
  ["providers", "lng", "REAL"],
  ["providers", "geohash5", "TEXT"],
  ["providers", "geohash6", "TEXT"],
  ["users", "adminRoleId", "TEXT"]
].forEach(([table, column, definition]) => ensureColumn(table, column, definition));

// These indexes have to be created after the ensureColumn pass above, since on a database
// created before these columns existed, the column (and therefore the index) can't exist yet.
runSql("CREATE INDEX IF NOT EXISTS service_products_productCategoryId_status_idx ON service_products(productCategoryId, status);");
runSql("CREATE INDEX IF NOT EXISTS providers_moderationStatus_geohash6_idx ON providers(moderationStatus, geohash6);");
runSql("CREATE INDEX IF NOT EXISTS providers_moderationStatus_geohash5_idx ON providers(moderationStatus, geohash5);");

// wallets.providerId used to be NOT NULL (one wallet per provider). A platform-owned wallet
// (providerId = NULL) needs that relaxed. SQLite can't ALTER COLUMN, so on databases that still
// have the old NOT NULL constraint, recreate the table and copy the data across.
const walletsColumnInfo = runSql("PRAGMA table_info(wallets);")
  .split("\n")
  .filter(Boolean)
  .map((line) => line.split("|"));
const providerIdColumn = walletsColumnInfo.find((cols) => cols[1] === "providerId");
if (providerIdColumn && providerIdColumn[3] === "1") {
  runSql(`
    PRAGMA foreign_keys = OFF;
    CREATE TABLE wallets_new (
      id TEXT PRIMARY KEY NOT NULL,
      providerId TEXT UNIQUE,
      balance DECIMAL NOT NULL DEFAULT 0.00,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (providerId) REFERENCES providers(id) ON DELETE CASCADE ON UPDATE CASCADE
    );
    INSERT INTO wallets_new (id, providerId, balance, createdAt, updatedAt)
      SELECT id, providerId, balance, createdAt, updatedAt FROM wallets;
    DROP TABLE wallets;
    ALTER TABLE wallets_new RENAME TO wallets;
    PRAGMA foreign_keys = ON;
  `);
}

// contact_unlocks.userId used to be NOT NULL (one row per logged-in customer). Anonymous
// contact-unlock payments (no account required) need that relaxed too. SQLite can't ALTER
// COLUMN, so recreate the table on databases that still have the old constraint, then restore
// the indexes that get dropped along with it (they aren't declared inline on this table).
const contactUnlocksColumnInfo = runSql("PRAGMA table_info(contact_unlocks);")
  .split("\n")
  .filter(Boolean)
  .map((line) => line.split("|"));
const contactUnlockUserIdColumn = contactUnlocksColumnInfo.find((cols) => cols[1] === "userId");
if (contactUnlockUserIdColumn && contactUnlockUserIdColumn[3] === "1") {
  runSql(`
    PRAGMA foreign_keys = OFF;
    CREATE TABLE contact_unlocks_new (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT,
      providerId TEXT NOT NULL,
      paid BOOLEAN NOT NULL DEFAULT 0,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY (providerId) REFERENCES providers(id) ON DELETE CASCADE ON UPDATE CASCADE
    );
    INSERT INTO contact_unlocks_new (id, userId, providerId, paid, createdAt, updatedAt)
      SELECT id, userId, providerId, paid, createdAt, updatedAt FROM contact_unlocks;
    DROP TABLE contact_unlocks;
    ALTER TABLE contact_unlocks_new RENAME TO contact_unlocks;
    CREATE UNIQUE INDEX IF NOT EXISTS contact_unlocks_userId_providerId_key ON contact_unlocks(userId, providerId);
    CREATE INDEX IF NOT EXISTS contact_unlocks_userId_idx ON contact_unlocks(userId);
    CREATE INDEX IF NOT EXISTS contact_unlocks_providerId_idx ON contact_unlocks(providerId);
    CREATE INDEX IF NOT EXISTS contact_unlocks_paid_idx ON contact_unlocks(paid);
    PRAGMA foreign_keys = ON;
  `);
}

// promotions.startsAt/endsAt used to be NOT NULL. "Always-on" promotions with no fixed time
// window need that relaxed. SQLite can't ALTER COLUMN, so recreate the table on databases that
// still have the old constraint, then restore the indexes that get dropped along with it.
const promotionsColumnInfo = runSql("PRAGMA table_info(promotions);")
  .split("\n")
  .filter(Boolean)
  .map((line) => line.split("|"));
const promotionsStartsAtColumn = promotionsColumnInfo.find((cols) => cols[1] === "startsAt");
if (promotionsStartsAtColumn && promotionsStartsAtColumn[3] === "1") {
  runSql(`
    PRAGMA foreign_keys = OFF;
    CREATE TABLE promotions_new (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      type TEXT NOT NULL DEFAULT 'banner',
      startsAt DATETIME,
      endsAt DATETIME,
      discountPercent INTEGER,
      imageUrl TEXT,
      ctaLabel TEXT,
      ctaHref TEXT,
      listingIds JSONB,
      categoryId TEXT,
      providerId TEXT,
      isFeatured BOOLEAN NOT NULL DEFAULT 0,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      isActive BOOLEAN NOT NULL DEFAULT 1,
      metadata JSONB NOT NULL DEFAULT '{}',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (providerId) REFERENCES providers(id) ON DELETE SET NULL ON UPDATE CASCADE,
      FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL ON UPDATE CASCADE
    );
    INSERT INTO promotions_new (id, title, subtitle, type, startsAt, endsAt, discountPercent, imageUrl, ctaLabel, ctaHref, listingIds, categoryId, providerId, isFeatured, sortOrder, isActive, metadata, createdAt, updatedAt)
      SELECT id, title, subtitle, type, startsAt, endsAt, discountPercent, imageUrl, ctaLabel, ctaHref, listingIds, categoryId, providerId, isFeatured, sortOrder, isActive, metadata, createdAt, updatedAt FROM promotions;
    DROP TABLE promotions;
    ALTER TABLE promotions_new RENAME TO promotions;
    CREATE INDEX IF NOT EXISTS promotions_type_isActive_idx ON promotions(type, isActive);
    CREATE INDEX IF NOT EXISTS promotions_startsAt_endsAt_idx ON promotions(startsAt, endsAt);
    CREATE INDEX IF NOT EXISTS promotions_featured_isActive_sortOrder_idx ON promotions(isFeatured, isActive, sortOrder);
    CREATE INDEX IF NOT EXISTS promotions_categoryId_idx ON promotions(categoryId);
    CREATE INDEX IF NOT EXISTS promotions_providerId_idx ON promotions(providerId);
    PRAGMA foreign_keys = ON;
  `);
}

// admin_invites.roleId used to be NOT NULL with no roleName snapshot column - a deleted role
// should still leave its past invites readable, so roleId is now nullable (SET NULL on delete)
// and roleName is a denormalized snapshot. Recreate-and-copy, same approach as the other
// column-nullability migrations above.
const adminInvitesColumnInfo = runSql("PRAGMA table_info(admin_invites);")
  .split("\n")
  .filter(Boolean)
  .map((line) => line.split("|"));
if (adminInvitesColumnInfo.length) {
  const roleIdColumn = adminInvitesColumnInfo.find((cols) => cols[1] === "roleId");
  const hasRoleName = adminInvitesColumnInfo.some((cols) => cols[1] === "roleName");
  if ((roleIdColumn && roleIdColumn[3] === "1") || !hasRoleName) {
    runSql(`
      PRAGMA foreign_keys = OFF;
      CREATE TABLE admin_invites_new (
        id TEXT PRIMARY KEY NOT NULL,
        email TEXT NOT NULL,
        name TEXT NOT NULL,
        roleId TEXT,
        roleName TEXT NOT NULL DEFAULT '',
        tokenHash TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'sent',
        invitedById TEXT,
        sentAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        resentCount INTEGER NOT NULL DEFAULT 0,
        lastSentAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        acceptedAt DATETIME,
        revokedAt DATETIME,
        expiresAt DATETIME NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}',
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (roleId) REFERENCES admin_roles(id) ON DELETE SET NULL ON UPDATE CASCADE,
        FOREIGN KEY (invitedById) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
      );
      INSERT INTO admin_invites_new (id, email, name, roleId, roleName, tokenHash, status, invitedById, sentAt, resentCount, lastSentAt, acceptedAt, revokedAt, expiresAt, metadata, createdAt, updatedAt)
        SELECT ai.id, ai.email, ai.name, ai.roleId, COALESCE(ar.name, ''), ai.tokenHash, ai.status, ai.invitedById, ai.sentAt, ai.resentCount, ai.lastSentAt, ai.acceptedAt, ai.revokedAt, ai.expiresAt, ai.metadata, ai.createdAt, ai.updatedAt
        FROM admin_invites ai LEFT JOIN admin_roles ar ON ar.id = ai.roleId;
      DROP TABLE admin_invites;
      ALTER TABLE admin_invites_new RENAME TO admin_invites;
      PRAGMA foreign_keys = ON;
    `);
  }
}

[
  "CREATE UNIQUE INDEX IF NOT EXISTS users_googleSub_key ON users(googleSub);",
  "CREATE INDEX IF NOT EXISTS users_authProvider_idx ON users(authProvider);",
  "CREATE INDEX IF NOT EXISTS categories_viewType_idx ON categories(viewType);",
  "CREATE UNIQUE INDEX IF NOT EXISTS providers_publicSlug_key ON providers(publicSlug);",
  "CREATE INDEX IF NOT EXISTS providers_publicSlug_idx ON providers(publicSlug);",
  "CREATE INDEX IF NOT EXISTS providers_onboardingStatus_createdAt_idx ON providers(onboardingStatus, createdAt);",
  "CREATE INDEX IF NOT EXISTS service_products_categoryId_status_idx ON service_products(categoryId, status);",
  "CREATE INDEX IF NOT EXISTS service_products_shopCategoryId_status_idx ON service_products(shopCategoryId, status);",
  "CREATE INDEX IF NOT EXISTS categories_viewType_moderationStatus_idx ON categories(viewType, moderationStatus);",
  "CREATE INDEX IF NOT EXISTS service_products_soldCount_status_idx ON service_products(soldCount, status);",
  "CREATE INDEX IF NOT EXISTS favorites_listingId_idx ON favorites(listingId);",
  "CREATE INDEX IF NOT EXISTS reviews_listingId_idx ON reviews(listingId);",
  "CREATE INDEX IF NOT EXISTS promotions_type_isActive_idx ON promotions(type, isActive);",
  "CREATE INDEX IF NOT EXISTS promotions_startsAt_endsAt_idx ON promotions(startsAt, endsAt);",
  "CREATE INDEX IF NOT EXISTS promotions_featured_isActive_sortOrder_idx ON promotions(isFeatured, isActive, sortOrder);",
  "CREATE INDEX IF NOT EXISTS promotions_categoryId_idx ON promotions(categoryId);",
  "CREATE INDEX IF NOT EXISTS promotions_providerId_idx ON promotions(providerId);",
  "CREATE INDEX IF NOT EXISTS users_adminRoleId_idx ON users(adminRoleId);",
  "CREATE INDEX IF NOT EXISTS admin_invites_email_status_idx ON admin_invites(email, status);",
  "CREATE INDEX IF NOT EXISTS admin_invites_tokenHash_idx ON admin_invites(tokenHash);",
  "CREATE INDEX IF NOT EXISTS admin_invites_expiresAt_idx ON admin_invites(expiresAt);"
].forEach(runSql);

process.stdout.write(`SQLite schema is ready at ${databasePath}\n`);
