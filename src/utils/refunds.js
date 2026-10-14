import { prisma } from "../config/db.js";

// A payment we hold but can't pass on (the order or booking was cancelled, expired or already paid) or one that
// must be returned after a cancellation is flagged here, so an admin sees it in the refund queue. `needsReversal`
// says the provider's wallet was already credited and must be debited when the refund is settled.
export const flagRefundDue = async ({ db = prisma, transactionId, reason, needsReversal = false }) => {
  const transaction = await db.transaction.findUnique({ where: { id: transactionId }, select: { metadata: true } });
  if (!transaction) return;
  const metadata = transaction.metadata ?? {};
  if (metadata.refundDue || metadata.refundedAt) return;
  await db.transaction.update({
    where: { id: transactionId },
    data: { metadata: { ...metadata, refundDue: true, refundReason: reason, needsReversal, refundFlaggedAt: new Date().toISOString() } }
  });
};
