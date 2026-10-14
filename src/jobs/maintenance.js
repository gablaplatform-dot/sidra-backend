import { prisma } from "../config/db.js";

const STALE_PENDING_MS = 45 * 60 * 1000;
const PAYMENT_TYPES = ["purchase", "cart_purchase", "service_booking", "contact_unlock", "subscription", "bus_ticket"];

// Housekeeping that must not depend on someone visiting a page: payment prompts nobody answered are closed
// (a USSD prompt can't be approved after a few minutes), and unanswered or unpaid bookings free their dates.
// A "failed" payment that the gateway later confirms is still honoured (see PaymentService#handleMobileMoneySuccess).
export const runMaintenance = async ({ serviceBookingService }) => {
  await prisma.transaction.updateMany({
    where: { status: "pending", type: { in: PAYMENT_TYPES }, createdAt: { lt: new Date(Date.now() - STALE_PENDING_MS) } },
    data: { status: "failed" }
  });
  await serviceBookingService?._expireStale();
};

export const startMaintenance = (run, { everyMs = 5 * 60 * 1000 } = {}) => {
  const tick = () => run().catch((error) => process.stderr.write(`[maintenance] ${error?.message ?? error}\n`));
  setTimeout(tick, 30 * 1000).unref();
  setInterval(tick, everyMs).unref();
};
