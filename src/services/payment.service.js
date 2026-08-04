import { AppError } from "../utils/AppError.js";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/db.js";
import { WalletService } from "./wallet.service.js";
import { TransactionService } from "./transaction.service.js";

const normalizeMoneyInput = (value) => {
  if (value instanceof Prisma.Decimal) return value.toString();
  if (typeof value === "number") return value.toFixed(2);
  return String(value ?? "").trim();
};

const parseMoneyToCents = (value) => {
  const s = normalizeMoneyInput(value);
  if (!/^\d+(\.\d{1,2})?$/.test(s)) {
    throw new AppError({ message: "Invalid amount", statusCode: 400, code: "INVALID_AMOUNT" });
  }
  const [w, f = ""] = s.split(".");
  const cents = (f + "00").slice(0, 2);
  return BigInt(w) * 100n + BigInt(cents);
};

const centsToDecimal = (cents) => {
  const sign = cents < 0n ? "-" : "";
  const abs = cents < 0n ? -cents : cents;
  const whole = abs / 100n;
  const frac = abs % 100n;
  const str = `${sign}${whole.toString()}.${frac.toString().padStart(2, "0")}`;
  return new Prisma.Decimal(str);
};

const feeFromPercentCents = ({ amountCents, percent }) => {
  const n = Number(percent ?? 0);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new AppError({ message: "Invalid fee percent", statusCode: 400, code: "INVALID_FEE_PERCENT" });
  }
  const basisPoints = BigInt(Math.round(n * 100));
  return (amountCents * basisPoints) / 10000n;
};

export class PaymentService {
  constructor({ walletService = new WalletService(), transactionService = new TransactionService() } = {}) {
    this.walletService = walletService;
    this.transactionService = transactionService;
  }

  async getMyWallet({ actorUserId }) {
    const provider = await prisma.provider.findUnique({ where: { userId: actorUserId } });
    if (!provider) {
      throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    }
    const wallet = await this.walletService.ensureWallet({ providerId: provider.id });
    return { providerId: provider.id, balance: wallet.balance.toString(), updatedAt: wallet.updatedAt };
  }

  async listMyTransactions({ actorUserId, page, limit, status, type }) {
    const provider = await prisma.provider.findUnique({ where: { userId: actorUserId } });
    if (!provider) {
      throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    }
    return this.transactionService.adminList({ page, limit, status, type, providerId: provider.id });
  }

  async listMyWithdrawals({ actorUserId, page = 1, limit = 50 }) {
    const provider = await prisma.provider.findUnique({ where: { userId: actorUserId } });
    if (!provider) {
      throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    }

    const normalizedPage = Math.max(1, Number(page) || 1);
    const normalizedLimit = Math.min(100, Math.max(1, Number(limit) || 50));

    const [items, total] = await Promise.all([
      prisma.withdrawalRequest.findMany({
        where: { providerId: provider.id },
        orderBy: { createdAt: "desc" },
        skip: (normalizedPage - 1) * normalizedLimit,
        take: normalizedLimit
      }),
      prisma.withdrawalRequest.count({ where: { providerId: provider.id } })
    ]);

    return {
      items: items.map((w) => ({
        id: w.id,
        amount: w.amount.toString(),
        fee: w.fee.toString(),
        netAmount: w.netAmount.toString(),
        status: w.status,
        note: w.note,
        createdAt: w.createdAt,
        approvedAt: w.approvedAt,
        rejectedAt: w.rejectedAt,
        paidAt: w.paidAt
      })),
      page: normalizedPage,
      limit: normalizedLimit,
      total
    };
  }

  async getSettings(session) {
    const tx = session ?? prisma;
    const settings = await tx.adminSettings.findFirst({ orderBy: { createdAt: "desc" } });
    return (
      settings ?? {
        enableSubscription: true,
        enableContactFee: true,
        enableWallet: true,
        enableEcommerce: true,
        subscriptionFee: new Prisma.Decimal("0.00"),
        contactFee: new Prisma.Decimal("0.00"),
        transactionFeePercent: 0,
        minimumWithdrawalAmount: new Prisma.Decimal("0.00")
      }
    );
  }

  computeEffectiveForProvider({ global, provider }) {
    const overrides = provider?.settingsOverrides ?? {};

    const enableSubscription =
      Boolean(global.enableSubscription) &&
      (overrides.enableSubscription === null || overrides.enableSubscription === undefined
        ? true
        : Boolean(overrides.enableSubscription));

    const enableContactFee =
      Boolean(global.enableContactFee) &&
      (overrides.enableContactFee === null || overrides.enableContactFee === undefined
        ? true
        : Boolean(overrides.enableContactFee));

    const enableEcommerce =
      Boolean(global.enableEcommerce) &&
      (overrides.enableEcommerce === null || overrides.enableEcommerce === undefined
        ? true
        : Boolean(overrides.enableEcommerce));

    const enableWallet =
      Boolean(global.enableWallet) &&
      (overrides.enableWallet === null || overrides.enableWallet === undefined
        ? Boolean(provider.walletEnabled)
        : Boolean(overrides.enableWallet));

    return {
      enableSubscription,
      enableContactFee,
      enableWallet,
      enableEcommerce,
      subscriptionFee: overrides.subscriptionFee ?? global.subscriptionFee,
      contactFee: overrides.contactFee ?? global.contactFee,
      transactionFeePercent:
        overrides.transactionFeePercent === null || overrides.transactionFeePercent === undefined
          ? global.transactionFeePercent
          : overrides.transactionFeePercent
    };
  }

  async activateSubscription({ actorUserId, amount, days = 30 }) {
    const provider = await prisma.provider.findUnique({ where: { userId: actorUserId } });
    if (!provider) {
      throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    }

    return prisma.$transaction(async (tx) => {
      const [settings, freshProvider] = await Promise.all([
        this.getSettings(tx),
        tx.provider.findUnique({ where: { id: provider.id } })
      ]);

      if (!freshProvider) {
        throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
      }

      const effective = this.computeEffectiveForProvider({ global: settings, provider: freshProvider });

      if (!effective.enableSubscription) {
        throw new AppError({ message: "Subscription disabled", statusCode: 400, code: "SUBSCRIPTION_DISABLED" });
      }

      const amountCents = amount !== undefined ? parseMoneyToCents(amount) : parseMoneyToCents(effective.subscriptionFee);
      const amountDec = centsToDecimal(amountCents);

      const expiresAt = new Date(Date.now() + Math.max(1, Number(days) || 30) * 24 * 60 * 60 * 1000);

      const subscription = await tx.subscription.create({
        data: {
          providerId: provider.id,
          amount: amountDec,
          expiresAt,
          status: "active"
        }
      });

      await tx.provider.update({ where: { id: provider.id }, data: { subscriptionStatus: "active" } });

      const transaction = await tx.transaction.create({
        data: {
          type: "subscription",
          userId: provider.userId,
          providerId: provider.id,
          amount: amountDec,
          fee: centsToDecimal(0n),
          netAmount: amountDec,
          status: "succeeded",
          metadata: { subscriptionId: subscription.id }
        }
      });

      return { subscriptionId: subscription.id, transactionId: transaction.id, providerId: provider.id, expiresAt };
    });
  }

  async unlockContact({ actorUserId, providerId }) {
    if (!providerId) {
      throw new AppError({ message: "Invalid providerId", statusCode: 400, code: "INVALID_PROVIDER_ID" });
    }

    return prisma.$transaction(async (tx) => {
      const [settings, provider] = await Promise.all([
        this.getSettings(tx),
        tx.provider.findUnique({ where: { id: providerId } })
      ]);

      if (!provider || !provider.isApproved || provider.moderationStatus !== "approved") {
        throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
      }

      const effective = this.computeEffectiveForProvider({ global: settings, provider });
      if (!effective.enableContactFee) {
        throw new AppError({ message: "Contact fee disabled", statusCode: 400, code: "CONTACT_FEE_DISABLED" });
      }

      const existing = await tx.contactUnlock.findUnique({
        where: { userId_providerId: { userId: actorUserId, providerId } }
      });
      if (existing?.paid) {
        throw new AppError({ message: "Already unlocked", statusCode: 409, code: "ALREADY_UNLOCKED" });
      }

      const feeCents = parseMoneyToCents(effective.contactFee);
      const feeDec = centsToDecimal(feeCents);

      const unlock = await tx.contactUnlock.upsert({
        where: { userId_providerId: { userId: actorUserId, providerId } },
        update: { paid: true },
        create: { userId: actorUserId, providerId, paid: true }
      });

      const transaction = await tx.transaction.create({
        data: {
          type: "contact_unlock",
          userId: actorUserId,
          providerId,
          amount: feeDec,
          fee: centsToDecimal(0n),
          netAmount: feeDec,
          status: "succeeded",
          metadata: { contactUnlockId: unlock.id }
        }
      });

      return { contactUnlockId: unlock.id, transactionId: transaction.id };
    });
  }

  async purchaseProduct({ actorUserId, listingId, quantity = 1 }) {
    if (!listingId) {
      throw new AppError({ message: "Invalid listingId", statusCode: 400, code: "INVALID_LISTING_ID" });
    }

    const q = Math.max(1, Math.min(99, Number(quantity) || 1));

    return prisma.$transaction(async (tx) => {
      const settings = await this.getSettings(tx);

      const listing = await tx.serviceProduct.findUnique({ where: { id: listingId } });
      if (!listing || listing.type !== "product" || listing.status !== "approved") {
        throw new AppError({ message: "Product not found", statusCode: 404, code: "PRODUCT_NOT_FOUND" });
      }

      const provider = await tx.provider.findUnique({ where: { id: listing.providerId } });
      if (!provider || !provider.isApproved || provider.moderationStatus !== "approved") {
        throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
      }

      const effective = this.computeEffectiveForProvider({ global: settings, provider });
      if (!effective.enableEcommerce) {
        throw new AppError({ message: "Ecommerce disabled", statusCode: 400, code: "ECOMMERCE_DISABLED" });
      }
      if (!effective.enableWallet) {
        throw new AppError({ message: "Wallet disabled", statusCode: 400, code: "WALLET_DISABLED" });
      }

      const unitCents = parseMoneyToCents(listing.price);
      const amountCents = unitCents * BigInt(q);
      const feeCents = feeFromPercentCents({ amountCents, percent: effective.transactionFeePercent });
      const netCents = amountCents - feeCents;

      const amountDec = centsToDecimal(amountCents);
      const feeDec = centsToDecimal(feeCents);
      const netDec = centsToDecimal(netCents);

      const transaction = await tx.transaction.create({
        data: {
          type: "purchase",
          userId: actorUserId,
          providerId: provider.id,
          amount: amountDec,
          fee: feeDec,
          netAmount: netDec,
          status: "succeeded",
          metadata: { listingId: listing.id, quantity: q }
        }
      });

      await this.walletService.creditBalance({ providerId: provider.id, amountDec: netDec, session: tx });

      return { transactionId: transaction.id, providerId: provider.id };
    });
  }

  async requestWithdrawal({ actorUserId, amount, note }) {
    const provider = await prisma.provider.findUnique({ where: { userId: actorUserId } });
    if (!provider) {
      throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    }

    return prisma.$transaction(async (tx) => {
      const [settings, freshProvider] = await Promise.all([
        this.getSettings(tx),
        tx.provider.findUnique({ where: { id: provider.id } })
      ]);

      if (!freshProvider) {
        throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
      }

      const effective = this.computeEffectiveForProvider({ global: settings, provider: freshProvider });
      if (!effective.enableWallet) {
        throw new AppError({ message: "Wallet disabled", statusCode: 400, code: "WALLET_DISABLED" });
      }

      const amountCents = parseMoneyToCents(amount);
      if (amountCents <= 0n) {
        throw new AppError({ message: "Invalid amount", statusCode: 400, code: "INVALID_AMOUNT" });
      }

      const minimumCents = parseMoneyToCents(settings.minimumWithdrawalAmount ?? "0.00");
      if (amountCents < minimumCents) {
        throw new AppError({
          message: "Below minimum withdrawal amount",
          statusCode: 400,
          code: "BELOW_MIN_WITHDRAWAL",
          details: { minimum: settings.minimumWithdrawalAmount?.toString?.() ?? "0.00" }
        });
      }

      const feeCents = feeFromPercentCents({ amountCents, percent: effective.transactionFeePercent });
      const netCents = amountCents - feeCents;

      const amountDec = centsToDecimal(amountCents);
      const feeDec = centsToDecimal(feeCents);
      const netDec = centsToDecimal(netCents);

      const wallet = await this.walletService.debitBalance({ providerId: provider.id, amountDec, session: tx });
      if (!wallet) {
        throw new AppError({ message: "Insufficient funds", statusCode: 409, code: "INSUFFICIENT_FUNDS" });
      }

      const transaction = await tx.transaction.create({
        data: {
          type: "withdrawal",
          userId: actorUserId,
          providerId: provider.id,
          amount: amountDec,
          fee: feeDec,
          netAmount: netDec,
          status: "pending",
          metadata: {}
        }
      });

      const request = await tx.withdrawalRequest.create({
        data: {
          providerId: provider.id,
          amount: amountDec,
          fee: feeDec,
          netAmount: netDec,
          status: "requested",
          transactionId: transaction.id,
          requestedBy: actorUserId,
          note: note ?? null
        }
      });

      await tx.transaction.update({
        where: { id: transaction.id },
        data: { metadata: { withdrawalRequestId: request.id } }
      });

      return { withdrawalRequestId: request.id, transactionId: transaction.id, providerId: provider.id };
    });
  }

  async adminApproveWithdrawal({ adminUserId, withdrawalRequestId, note }) {
    if (!withdrawalRequestId) {
      throw new AppError({ message: "Invalid withdrawalRequestId", statusCode: 400, code: "INVALID_WITHDRAWAL_ID" });
    }

    return prisma.$transaction(async (tx) => {
      const reqDoc = await tx.withdrawalRequest.findUnique({ where: { id: withdrawalRequestId } });
      if (!reqDoc) {
        throw new AppError({ message: "Withdrawal not found", statusCode: 404, code: "WITHDRAWAL_NOT_FOUND" });
      }
      if (reqDoc.status !== "requested") {
        throw new AppError({ message: "Invalid state", statusCode: 409, code: "INVALID_WITHDRAWAL_STATE" });
      }

      const updated = await tx.withdrawalRequest.update({
        where: { id: withdrawalRequestId },
        data: { status: "approved", approvedBy: adminUserId, approvedAt: new Date(), ...(note !== undefined ? { note } : {}) }
      });

      return { withdrawalRequestId: updated.id, status: updated.status };
    });
  }

  async adminRejectWithdrawal({ adminUserId, withdrawalRequestId, note }) {
    if (!withdrawalRequestId) {
      throw new AppError({ message: "Invalid withdrawalRequestId", statusCode: 400, code: "INVALID_WITHDRAWAL_ID" });
    }

    return prisma.$transaction(async (tx) => {
      const reqDoc = await tx.withdrawalRequest.findUnique({ where: { id: withdrawalRequestId } });
      if (!reqDoc) {
        throw new AppError({ message: "Withdrawal not found", statusCode: 404, code: "WITHDRAWAL_NOT_FOUND" });
      }
      if (reqDoc.status !== "requested" && reqDoc.status !== "approved") {
        throw new AppError({ message: "Invalid state", statusCode: 409, code: "INVALID_WITHDRAWAL_STATE" });
      }

      await this.walletService.creditBalance({ providerId: reqDoc.providerId, amountDec: reqDoc.amount, session: tx });
      await tx.transaction.update({ where: { id: reqDoc.transactionId }, data: { status: "canceled" } });

      const updated = await tx.withdrawalRequest.update({
        where: { id: withdrawalRequestId },
        data: { status: "rejected", rejectedBy: adminUserId, rejectedAt: new Date(), ...(note !== undefined ? { note } : {}) }
      });

      return { withdrawalRequestId: updated.id, status: updated.status };
    });
  }

  async adminMarkWithdrawalPaid({ adminUserId, withdrawalRequestId, note }) {
    if (!withdrawalRequestId) {
      throw new AppError({ message: "Invalid withdrawalRequestId", statusCode: 400, code: "INVALID_WITHDRAWAL_ID" });
    }

    return prisma.$transaction(async (tx) => {
      const reqDoc = await tx.withdrawalRequest.findUnique({ where: { id: withdrawalRequestId } });
      if (!reqDoc) {
        throw new AppError({ message: "Withdrawal not found", statusCode: 404, code: "WITHDRAWAL_NOT_FOUND" });
      }
      if (reqDoc.status !== "approved") {
        throw new AppError({ message: "Invalid state", statusCode: 409, code: "INVALID_WITHDRAWAL_STATE" });
      }

      await tx.transaction.update({ where: { id: reqDoc.transactionId }, data: { status: "succeeded" } });

      const updated = await tx.withdrawalRequest.update({
        where: { id: withdrawalRequestId },
        data: { status: "paid", paidBy: adminUserId, paidAt: new Date(), ...(note !== undefined ? { note } : {}) }
      });

      return { withdrawalRequestId: updated.id, status: updated.status };
    });
  }
}
