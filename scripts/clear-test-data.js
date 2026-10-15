// Resets the live platform to a clean slate for end-to-end testing, keeping the catalogue and the money that was
// earned from contact unlocks:
//
//   REMOVED   every service provider (login, profile, listings, ads, orders, quotations, receipts, bookings, reviews,
//             favourites, inquiries, wallets, subscriptions, withdrawals, media records), every customer account,
//             all bus companies and their routes, trips, bookings, tickets and payouts, every payment record except
//             contact-unlock payments, and anonymous browsing/search analytics.
//   KEPT      all categories (directory, product, service), bus types and the bus onboarding questions, admin accounts
//             and roles, platform settings, AI settings, drivers, and contact-unlock payments with the platform
//             wallet balance they produced.
//
//   node scripts/clear-test-data.js            show what would be removed (changes nothing)
//   node scripts/clear-test-data.js --yes      do it
//
// Point DATABASE_URL at a copy of the database to rehearse.
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();
const prisma = new PrismaClient();
const log = (m) => process.stdout.write(`${m}\n`);
const YES = process.argv.includes("--yes");

const TABLES = [
  "users", "providers", "service_products", "promotions", "orders", "order_documents", "service_bookings", "reviews", "favorites",
  "inquiries", "wallets", "withdrawal_requests", "subscriptions", "contact_unlocks", "media_assets", "transactions", "bus_operators",
  "bus_bookings", "bus_tickets", "bus_trips", "bus_routes", "interest_events", "search_events", "profile_visits", "contact_events",
  "categories", "product_categories", "service_categories", "bus_types", "ride_trips", "ride_drivers"
];

const counts = async () => {
  const out = {};
  for (const t of TABLES) {
    try {
      out[t] = Number((await prisma.$queryRawUnsafe(`select count(*) as n from ${t}`))[0].n);
    } catch {
      out[t] = "n/a";
    }
  }
  return out;
};

async function main() {
  const before = await counts();
  const unlockRevenue = await prisma.transaction.aggregate({ where: { type: "contact_unlock", status: "succeeded" }, _sum: { netAmount: true }, _count: true });
  const platformWallet = await prisma.wallet.findFirst({ where: { providerId: null } });
  log(`Contact-unlock revenue to keep: ${unlockRevenue._sum.netAmount ?? 0} from ${unlockRevenue._count} payments; platform wallet holds ${platformWallet?.balance ?? "none"}.`);
  log(`Accounts to remove: ${await prisma.user.count({ where: { role: { in: ["provider", "user"] } } })} (admins and drivers are kept).`);
  if (!YES) {
    log("Dry run only. Re-run with --yes to apply.");
    log(JSON.stringify(before));
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      // Rows we keep must not point at accounts we are about to delete (older databases have no SET NULL on these links).
      await tx.transaction.updateMany({ where: { type: { in: ["contact_unlock", "ride_trip"] } }, data: { userId: null, providerId: null } });
      await tx.auditLog.updateMany({ where: { actor: { role: { in: ["provider", "user", "bus_operator"] } } }, data: { actorId: null } });
      // Children that older databases protect with RESTRICT go first, in dependency order.
      await tx.withdrawalRequest.deleteMany({});
      await tx.orderDocument.deleteMany({});
      await tx.order.deleteMany({});
      await tx.serviceBooking.deleteMany({});
      // Ads of providers are SetNull on provider delete, so remove them explicitly first.
      await tx.promotion.deleteMany({ where: { providerId: { not: null } } });
      // Deleting the user cascades the provider profile and everything it owns, plus a customer's own records
      // (bookings, unlock records, favourites, reviews, rides, bus bookings).
      await tx.user.deleteMany({ where: { role: { in: ["provider", "user", "bus_operator"] } } });
      // Safety net for anything not tied to a user row.
      await tx.busOperator.deleteMany({});
      await tx.busBooking.deleteMany({});
      // Payments: keep contact unlocks and rides, clear the rest.
      await tx.transaction.deleteMany({ where: { type: { notIn: ["contact_unlock", "ride_trip"] } } });
      // Wallets of deleted providers are gone with them; the platform wallet keeps exactly what unlocks earned.
      await tx.wallet.deleteMany({ where: { providerId: { not: null } } });
      if (platformWallet) {
        await tx.wallet.update({ where: { id: platformWallet.id }, data: { balance: unlockRevenue._sum.netAmount ?? 0 } });
      }
      // Browsing analytics that point at things that no longer exist.
      await tx.interestEvent.deleteMany({});
      await tx.searchEvent.deleteMany({});
    },
    { timeout: 120000, maxWait: 30000 }
  );

  const after = await counts();
  log("Before -> after:");
  for (const t of TABLES) if (before[t] !== after[t]) log(`  ${t}: ${before[t]} -> ${after[t]}`);
  log("Unchanged: " + TABLES.filter((t) => before[t] === after[t]).map((t) => `${t}=${after[t]}`).join(", "));
  const wallet = await prisma.wallet.findFirst({ where: { providerId: null } });
  log(`Platform wallet now: ${wallet?.balance}`);
}

main()
  .catch((e) => {
    process.stderr.write(`FAILED: ${e.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
