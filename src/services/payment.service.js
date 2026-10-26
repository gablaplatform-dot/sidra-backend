import crypto from "crypto";

import { AppError } from "../utils/AppError.js";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/db.js";
import { env } from "../config/env.js";
import { WalletService } from "./wallet.service.js";
import { TransactionService } from "./transaction.service.js";
import { MobileMoneyService, isAmbiguousPayoutError } from "./mobileMoney.service.js";
import { RideDriverWalletService } from "./rideDriverWallet.service.js";
import { OrderNotificationService } from "./orderNotification.service.js";
import { parseMoneyToCents, centsToDecimal, feeFromPercentCents } from "../utils/money.js";
import { flagRefundDue } from "../utils/refunds.js";
import { webhookKey } from "../utils/webhookKey.js";

const SUBSCRIPTION_PERIOD_DAYS = 30;

export class PaymentService {
  constructor({
    walletService = new WalletService(),
    transactionService = new TransactionService(),
    mobileMoneyService = new MobileMoneyService(),
    rideDriverWalletService = new RideDriverWalletService(),
    orderNotificationService = new OrderNotificationService()
  } = {}) {
    this.walletService = walletService;
    this.transactionService = transactionService;
    this.mobileMoneyService = mobileMoneyService;
    this.rideDriverWalletService = rideDriverWalletService;
    this.orderNotificationService = orderNotificationService;
    this.busBookingService = null;
    this.serviceBookingService = null;
    this.documentService = null;
  }

  // Quotations and receipts are wired in after construction (see app.js).
  attachDocuments(documentService) {
    this.documentService = documentService;
  }

  // Bus ticketing is wired in after construction (it needs this service's callback URLs).
  attachBusBooking(busBookingService) {
    this.busBookingService = busBookingService;
  }

  // Bookings are wired in after construction too (they need this service to take payments).
  attachServiceBooking(serviceBookingService) {
    this.serviceBookingService = serviceBookingService;
  }

  // The gateway posts payment results to these URLs. They carry a secret key (derived from JWT_SECRET) so that a
  // stranger who learns a transaction reference can't post a fake "paid" result; see verifyWebhookKey.
  webhookKey() {
    return webhookKey();
  }

  verifyWebhookKey(presented) {
    const expected = Buffer.from(this.webhookKey());
    const got = Buffer.from(String(presented ?? ""));
    return got.length === expected.length && crypto.timingSafeEqual(got, expected);
  }

  mobileMoneyCallbackUrls() {
    const key = this.webhookKey();
    return {
      successUrl: `${env.apiBaseUrl}/api/v1/payments/webhooks/mobilemoney/success?k=${key}`,
      failedUrl: `${env.apiBaseUrl}/api/v1/payments/webhooks/mobilemoney/failed?k=${key}`
    };
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
    // Contact-unlock fees are Gabla's revenue, not the provider's money, so they never show on a provider's own history.
    return this.transactionService.adminList({ page, limit, status, type, providerId: provider.id, excludeTypes: ["contact_unlock", "platform_withdrawal"] });
  }

  // Lets the customer who initiated a deposit poll for its outcome while they approve the
  // USSD prompt on their phone (the real result only lands via the webhook).
  // actorUserId must be normalized to `null` (never left undefined) before this filter — an
  // anonymous poller (no session) must only ever match anonymous (userId: null) transactions,
  // never any transaction regardless of owner.
  async getTransactionStatus({ actorUserId, transactionId }) {
    const transaction = await prisma.transaction.findFirst({ where: { id: transactionId, userId: actorUserId ?? null } });
    if (!transaction) {
      throw new AppError({ message: "Transaction not found", statusCode: 404, code: "TRANSACTION_NOT_FOUND" });
    }
    const result = { id: transaction.id, type: transaction.type, status: transaction.status, amount: transaction.amount.toString() };
    if (transaction.type === "contact_unlock" && transaction.status === "succeeded") {
      const provider = await prisma.provider.findUnique({ where: { id: transaction.providerId } });
      if (provider) {
        result.contact = provider.contact;
        result.location = provider.location;
      }
    } else if (transaction.type === "cart_purchase") {
      const items = Array.isArray(transaction.metadata?.items) ? transaction.metadata.items : [];
      result.items = items.map((item) => ({
        listingId: item.listingId,
        providerId: item.providerId,
        name: item.name,
        quantity: item.quantity,
        amount: centsToDecimal(BigInt(item.amountCents ?? "0")).toString()
      }));
      const createdOrders = Array.isArray(transaction.metadata?.createdOrders) ? transaction.metadata.createdOrders : [];
      if (createdOrders.length) {
        const orderProviderIds = [...new Set(createdOrders.map((o) => o.providerId).filter(Boolean))];
        let providerNameById = {};
        if (orderProviderIds.length) {
          const providers = await prisma.provider.findMany({
            where: { id: { in: orderProviderIds } },
            select: { id: true, businessName: true }
          });
          providerNameById = Object.fromEntries(providers.map((p) => [p.id, p.businessName]));
        }
        result.createdOrders = createdOrders.map((o) => ({
          id: o.id,
          providerId: o.providerId,
          providerName: providerNameById[o.providerId] ?? null,
          status: o.status
        }));
      }
    }
    return result;
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

  async getMySubscription({ actorUserId }) {
    const provider = await prisma.provider.findUnique({ where: { userId: actorUserId } });
    if (!provider) {
      throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    }
    const [settings, activeSubscription] = await Promise.all([
      this.getSettings(),
      prisma.subscription.findFirst({
        where: { providerId: provider.id, status: "active", expiresAt: { gt: new Date() } },
        orderBy: { expiresAt: "desc" }
      })
    ]);
    const effective = this.computeEffectiveForProvider({ global: settings, provider });
    return {
      status: activeSubscription ? "active" : "inactive",
      expiresAt: activeSubscription?.expiresAt ?? null,
      fee: effective.subscriptionFee?.toString?.() ?? "0.00",
      enabled: effective.enableSubscription
    };
  }

  async activateSubscription({ actorUserId, phone }) {
    if (!phone) {
      throw new AppError({ message: "A phone number is required to pay by mobile money", statusCode: 400, code: "PHONE_REQUIRED" });
    }
    const provider = await prisma.provider.findUnique({ where: { userId: actorUserId } });
    if (!provider) {
      throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    }

    const { transactionId, reference, feeDec } = await prisma.$transaction(async (tx) => {
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

      const feeCents = parseMoneyToCents(effective.subscriptionFee);
      if (feeCents <= 0n) {
        throw new AppError({ message: "Subscription fee is not configured", statusCode: 400, code: "INVALID_SUBSCRIPTION_FEE" });
      }
      const feeDec = centsToDecimal(feeCents);

      const reference = `subscription-${crypto.randomUUID()}`;
      const transaction = await tx.transaction.create({
        data: {
          type: "subscription",
          userId: provider.userId,
          providerId: provider.id,
          amount: feeDec,
          fee: centsToDecimal(0n),
          netAmount: feeDec,
          status: "pending",
          reference,
          metadata: { days: SUBSCRIPTION_PERIOD_DAYS, phone }
        }
      });

      return { transactionId: transaction.id, reference, feeDec };
    });

    try {
      await this.mobileMoneyService.initiateDeposit({
        amount: feeDec,
        phone,
        reference,
        ...this.mobileMoneyCallbackUrls()
      });
    } catch (gatewayError) {
      await prisma.transaction.update({ where: { id: transactionId }, data: { status: "failed" } });
      throw gatewayError;
    }

    return {
      transactionId,
      providerId: provider.id,
      status: "pending",
      message: "Check your phone to approve the mobile money payment."
    };
  }

  // Contact-unlock revenue belongs entirely to the platform (no provider split), so it's
  // credited to the platform wallet (Wallet.providerId = null) once the mobile money
  // deposit actually succeeds via the webhook — not here.
  async unlockContact({ actorUserId, providerId, phone }) {
    if (!providerId) {
      throw new AppError({ message: "Invalid providerId", statusCode: 400, code: "INVALID_PROVIDER_ID" });
    }
    if (!phone) {
      throw new AppError({ message: "A phone number is required to pay by mobile money", statusCode: 400, code: "PHONE_REQUIRED" });
    }

    const { transactionId, unlockId, reference, feeDec } = await prisma.$transaction(async (tx) => {
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

      // Anonymous visitors (actorUserId null) have no account to key an "already unlocked"
      // check off of, so that check — and the upsert that relies on the userId+providerId
      // unique key — only applies to logged-in customers. Anonymous unlocks just get their own
      // plain row each time and will pay again on a future visit.
      let unlockId;
      if (actorUserId) {
        const existing = await tx.contactUnlock.findUnique({
          where: { userId_providerId: { userId: actorUserId, providerId } }
        });
        if (existing?.paid) {
          throw new AppError({ message: "Already unlocked", statusCode: 409, code: "ALREADY_UNLOCKED" });
        }
      }

      const feeCents = parseMoneyToCents(effective.contactFee);
      if (feeCents <= 0n) {
        throw new AppError({ message: "Contact fee is not configured", statusCode: 400, code: "INVALID_CONTACT_FEE" });
      }
      const feeDec = centsToDecimal(feeCents);

      if (actorUserId) {
        const unlock = await tx.contactUnlock.upsert({
          where: { userId_providerId: { userId: actorUserId, providerId } },
          update: {},
          create: { userId: actorUserId, providerId, paid: false }
        });
        unlockId = unlock.id;
      } else {
        const unlock = await tx.contactUnlock.create({ data: { userId: null, providerId, paid: false } });
        unlockId = unlock.id;
      }

      const reference = `contact-${crypto.randomUUID()}`;
      const transaction = await tx.transaction.create({
        data: {
          type: "contact_unlock",
          userId: actorUserId,
          providerId,
          amount: feeDec,
          fee: centsToDecimal(0n),
          netAmount: feeDec,
          status: "pending",
          reference,
          metadata: { contactUnlockId: unlockId, phone }
        }
      });

      return { transactionId: transaction.id, unlockId, reference, feeDec };
    });

    try {
      await this.mobileMoneyService.initiateDeposit({
        amount: feeDec,
        phone,
        reference,
        ...this.mobileMoneyCallbackUrls()
      });
    } catch (gatewayError) {
      await prisma.transaction.update({ where: { id: transactionId }, data: { status: "failed" } });
      throw gatewayError;
    }

    return {
      contactUnlockId: unlockId,
      transactionId,
      status: "pending",
      message: "Check your phone to approve the mobile money payment."
    };
  }

  // Charging happens only after the seller has accepted: the buyer places an order (EngagementService#createOrder),
  // the seller approves it, and only then can it be paid. That way nobody pays for something that turns out
  // not to be available.
  async payOrder({ actorUserId, orderId, phone }) {
    if (!phone) {
      throw new AppError({ message: "A phone number is required to pay by mobile money", statusCode: 400, code: "PHONE_REQUIRED" });
    }

    const prepared = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId, userId: actorUserId }, include: { items: true } });
      if (!order) throw new AppError({ message: "Order not found", statusCode: 404, code: "ORDER_NOT_FOUND" });
      if (order.transactionId || order.metadata?.paymentStatus === "paid") {
        throw new AppError({ message: "This order is already paid.", statusCode: 409, code: "ORDER_ALREADY_PAID" });
      }
      if (order.metadata?.paymentMethod !== "online" || order.metadata?.paymentStatus !== "payable" || order.status !== "accepted") {
        throw new AppError({ message: "You can pay once the seller has accepted your order.", statusCode: 409, code: "ORDER_NOT_PAYABLE" });
      }

      // One payment prompt at a time: a second tap just re-uses the one already waiting.
      const recent = await tx.transaction.findMany({ where: { userId: actorUserId, type: "purchase", status: "pending", createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) } } });
      const waiting = recent.find((t) => t.metadata?.orderId === order.id);
      if (waiting) return { reuse: waiting };

      const [settings, provider] = await Promise.all([this.getSettings(tx), tx.provider.findUnique({ where: { id: order.providerId } })]);
      if (!provider || !provider.isApproved || provider.moderationStatus !== "approved") {
        throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
      }
      const effective = this.computeEffectiveForProvider({ global: settings, provider });
      if (!effective.enableEcommerce || !effective.enableWallet || !provider.onlinePaymentsEnabled) {
        throw new AppError({ message: "This seller isn't taking online payments right now. Pay them directly.", statusCode: 400, code: "ONLINE_PAYMENTS_UNAVAILABLE" });
      }

      const amountCents = parseMoneyToCents(order.total);
      if (amountCents <= 0n) throw new AppError({ message: "This order has no amount to pay.", statusCode: 400, code: "INVALID_AMOUNT" });
      const feeCents = feeFromPercentCents({ amountCents, percent: effective.transactionFeePercent });
      const reference = `purchase-${crypto.randomUUID()}`;
      const transaction = await tx.transaction.create({
        data: {
          type: "purchase",
          userId: actorUserId,
          providerId: provider.id,
          amount: centsToDecimal(amountCents),
          fee: centsToDecimal(feeCents),
          netAmount: centsToDecimal(amountCents - feeCents),
          status: "pending",
          reference,
          metadata: { orderId: order.id, phone }
        }
      });
      return { transaction, reference, amountDec: centsToDecimal(amountCents) };
    });

    if (prepared.reuse) {
      return { transactionId: prepared.reuse.id, status: "pending", message: "Check your phone to approve the mobile money payment." };
    }

    try {
      await this.mobileMoneyService.initiateDeposit({ amount: prepared.amountDec, phone, reference: prepared.reference, ...this.mobileMoneyCallbackUrls() });
    } catch (gatewayError) {
      await prisma.transaction.update({ where: { id: prepared.transaction.id }, data: { status: "failed" } });
      throw gatewayError;
    }
    return { transactionId: prepared.transaction.id, status: "pending", message: "Check your phone to approve the mobile money payment." };
  }

  // Same rule for bookings: the guest pays the deposit (or the full amount) only once the provider has confirmed.
  async payServiceBooking({ actorUserId, bookingId, phone }) {
    if (!phone) {
      throw new AppError({ message: "A phone number is required to pay by mobile money", statusCode: 400, code: "PHONE_REQUIRED" });
    }

    const prepared = await prisma.$transaction(async (tx) => {
      const booking = await tx.serviceBooking.findFirst({ where: { id: bookingId, userId: actorUserId } });
      if (!booking) throw new AppError({ message: "Booking not found", statusCode: 404, code: "BOOKING_NOT_FOUND" });
      if (booking.paymentStatus === "paid") throw new AppError({ message: "This booking is already paid.", statusCode: 409, code: "BOOKING_ALREADY_PAID" });
      if (booking.status !== "confirmed" || booking.paymentStatus !== "payable") {
        throw new AppError({ message: "You can pay once the provider has confirmed your booking.", statusCode: 409, code: "BOOKING_NOT_PAYABLE" });
      }
      if (booking.payBy && booking.payBy < new Date()) {
        throw new AppError({ message: "The payment window for this booking has closed.", statusCode: 409, code: "PAYMENT_WINDOW_CLOSED" });
      }

      const recent = await tx.transaction.findMany({ where: { userId: actorUserId, type: "service_booking", status: "pending", createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) } } });
      const waiting = recent.find((t) => t.metadata?.bookingId === booking.id);
      if (waiting) return { reuse: waiting };

      const [settings, provider] = await Promise.all([this.getSettings(tx), tx.provider.findUnique({ where: { id: booking.providerId } })]);
      if (!provider) throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
      const effective = this.computeEffectiveForProvider({ global: settings, provider });
      if (!effective.enableWallet || !provider.onlinePaymentsEnabled) {
        throw new AppError({ message: "This provider isn't taking online payments right now. Pay them directly.", statusCode: 400, code: "ONLINE_PAYMENTS_UNAVAILABLE" });
      }

      const amountCents = parseMoneyToCents(booking.amountDue);
      if (amountCents <= 0n) throw new AppError({ message: "Nothing to pay online for this booking.", statusCode: 400, code: "INVALID_AMOUNT" });
      const feeCents = feeFromPercentCents({ amountCents, percent: effective.transactionFeePercent });
      const reference = `booking-${crypto.randomUUID()}`;
      const transaction = await tx.transaction.create({
        data: {
          type: "service_booking",
          userId: actorUserId,
          providerId: provider.id,
          amount: centsToDecimal(amountCents),
          fee: centsToDecimal(feeCents),
          netAmount: centsToDecimal(amountCents - feeCents),
          status: "pending",
          reference,
          metadata: { bookingId: booking.id, phone }
        }
      });
      return { transaction, reference, amountDec: centsToDecimal(amountCents) };
    });

    if (prepared.reuse) {
      return { transactionId: prepared.reuse.id, status: "pending", message: "Check your phone to approve the mobile money payment." };
    }

    try {
      await this.mobileMoneyService.initiateDeposit({ amount: prepared.amountDec, phone, reference: prepared.reference, ...this.mobileMoneyCallbackUrls() });
    } catch (gatewayError) {
      await prisma.transaction.update({ where: { id: prepared.transaction.id }, data: { status: "failed" } });
      throw gatewayError;
    }
    return { transactionId: prepared.transaction.id, status: "pending", message: "Check your phone to approve the mobile money payment." };
  }

  // Called from the mobile money webhook once a deposit actually completes. Credits the
  // provider's wallet for a purchase (plus the platform wallet for its cut), or the platform
  // wallet outright for a contact unlock.
  async handleMobileMoneySuccess(payload) {
    const reference = String(payload?.external_ref || "").trim();
    if (!reference) {
      throw new AppError({ message: "external_ref is required", statusCode: 400, code: "MISSING_EXTERNAL_REF" });
    }

    const newOrderIds = [];
    const paidOrderIds = [];
    const paidBookingIds = [];
    let busBookingToEmail = null;

    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findFirst({ where: { reference } });
      if (!transaction) {
        return { ok: false, reason: "unknown_reference" };
      }
      // A payment the gateway later confirms still counts after we marked it failed (a timeout can fail a
      // request that the gateway had in fact accepted), so "failed" is a valid state to succeed from.
      if (transaction.status !== "pending" && transaction.status !== "failed") {
        return { ok: true, reason: "already_processed" };
      }

      const networkMetadata = {
        networkRef: payload.network_ref ?? null,
        msisdn: payload.msisdn ?? null,
        payerNames: payload.payer_names ?? null,
        payerEmail: payload.payer_email ?? null,
        dateTime: payload.date_time ?? null,
        webhookPayload: JSON.stringify(payload).slice(0, 1500),
        ...(transaction.status === "failed" ? { lateSuccess: true } : {})
      };

      // Claimed with a conditional update, so two deliveries of the same callback can't both credit.
      const claim = await tx.transaction.updateMany({
        where: { id: transaction.id, status: { in: ["pending", "failed"] } },
        data: { status: "succeeded", metadata: { ...(transaction.metadata ?? {}), ...networkMetadata } }
      });
      if (claim.count === 0) return { ok: true, reason: "already_processed" };

      // A reported amount that differs from what we asked for is recorded. It only holds the payment for a person
      // to check when MOBILE_MONEY_ENFORCE_AMOUNT=true: until we've seen what the gateway reports for a real payment
      // (the figure may include its own charges), holding on it could park every genuine payment.
      const reportedAmount = Number(payload.amount ?? payload.amount_paid ?? payload.paid_amount);
      if (Number.isFinite(reportedAmount) && reportedAmount > 0 && Math.round(reportedAmount) !== Math.round(Number(transaction.amount))) {
        if (process.env.MOBILE_MONEY_ENFORCE_AMOUNT === "true") {
          await flagRefundDue({ db: tx, transactionId: transaction.id, reason: `amount_mismatch: paid ${reportedAmount}, expected ${transaction.amount}` });
          return { ok: true, transactionId: transaction.id, type: transaction.type, held: true };
        }
        process.stderr.write(`[webhook] amount differs for ${reference}: gateway ${reportedAmount}, expected ${transaction.amount}\n`);
      }

      if (transaction.type === "purchase") {
        // Paying an order the seller accepted: apply it only while the order is still payable; otherwise the
        // money is held and queued for a refund rather than credited to the seller.
        const payingOrderId = transaction.metadata?.orderId;
        if (payingOrderId) {
          const order = await tx.order.findUnique({ where: { id: payingOrderId }, include: { items: true } });
          const payable = order && !order.transactionId && order.status === "accepted" && order.metadata?.paymentStatus === "payable";
          if (!payable) {
            await flagRefundDue({ db: tx, transactionId: transaction.id, reason: !order ? "order_missing" : order.transactionId ? "order_already_paid" : `order_${order.status}` });
            return { ok: true, transactionId: transaction.id, type: transaction.type, held: true };
          }
          if (transaction.providerId) {
            await this.walletService.creditBalance({ providerId: transaction.providerId, amountDec: transaction.netAmount, session: tx });
          }
          if (Number(transaction.fee) > 0) {
            await this.walletService.creditBalance({ providerId: null, amountDec: transaction.fee, session: tx });
          }
          await tx.order.update({
            where: { id: order.id },
            data: {
              transactionId: transaction.id,
              fee: transaction.fee,
              metadata: { ...(order.metadata ?? {}), paymentMethod: "online", paymentStatus: "paid", paidAt: new Date().toISOString() }
            }
          });
          for (const item of order.items) {
            if (item.listingId) await tx.serviceProduct.update({ where: { id: item.listingId }, data: { soldCount: { increment: item.quantity } } });
          }
          paidOrderIds.push(order.id);
        } else {
          if (transaction.providerId) {
            await this.walletService.creditBalance({ providerId: transaction.providerId, amountDec: transaction.netAmount, session: tx });
          }
          if (Number(transaction.fee) > 0) {
            await this.walletService.creditBalance({ providerId: null, amountDec: transaction.fee, session: tx });
          }
        }
      } else if (transaction.type === "contact_unlock") {
        const contactUnlockId = transaction.metadata?.contactUnlockId;
        if (contactUnlockId) {
          await tx.contactUnlock.update({ where: { id: contactUnlockId }, data: { paid: true } });
        }
        await this.walletService.creditBalance({ providerId: null, amountDec: transaction.netAmount, session: tx });
      } else if (transaction.type === "subscription") {
        const days = Number(transaction.metadata?.days) || SUBSCRIPTION_PERIOD_DAYS;
        const now = new Date();
        const activeSubscription = await tx.subscription.findFirst({
          where: { providerId: transaction.providerId, status: "active", expiresAt: { gt: now } },
          orderBy: { expiresAt: "desc" }
        });
        const baseDate = activeSubscription?.expiresAt ?? now;
        const expiresAt = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

        await tx.subscription.create({
          data: { providerId: transaction.providerId, amount: transaction.netAmount, expiresAt, status: "active" }
        });
        await tx.provider.update({ where: { id: transaction.providerId }, data: { subscriptionStatus: "active" } });
        await this.walletService.creditBalance({ providerId: null, amountDec: transaction.netAmount, session: tx });
      } else if (transaction.type === "cart_purchase") {
        const items = Array.isArray(transaction.metadata?.items) ? transaction.metadata.items : [];
        const itemsByProvider = new Map();
        for (const item of items) {
          if (!itemsByProvider.has(item.providerId)) itemsByProvider.set(item.providerId, []);
          itemsByProvider.get(item.providerId).push(item);
        }

        const createdOrders = [];

        for (const [providerId, providerItems] of itemsByProvider) {
          const amountCents = providerItems.reduce((sum, i) => sum + BigInt(i.amountCents ?? "0"), 0n);
          const feeCents = providerItems.reduce((sum, i) => sum + BigInt(i.feeCents ?? "0"), 0n);
          const netCents = amountCents - feeCents;

          const childTx = await tx.transaction.create({
            data: {
              type: "purchase",
              userId: transaction.userId,
              providerId,
              amount: centsToDecimal(amountCents),
              fee: centsToDecimal(feeCents),
              netAmount: centsToDecimal(netCents),
              status: "succeeded",
              metadata: { cartTransactionId: transaction.id, items: providerItems }
            }
          });

          const orderItemsData = providerItems.map((item) => ({
            listingId: item.listingId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: centsToDecimal(BigInt(item.unitPriceCents ?? "0")),
            total: centsToDecimal(BigInt(item.amountCents ?? "0")),
            metadata: item.customFields ? { customFields: item.customFields } : {}
          }));

          const order = await tx.order.create({
            data: {
              userId: transaction.userId,
              providerId,
              transactionId: childTx.id,
              status: "pending",
              subtotal: centsToDecimal(amountCents),
              fee: centsToDecimal(feeCents),
              total: centsToDecimal(amountCents),
              customer: { phone: transaction.metadata?.phone ?? null },
              fulfillment: {},
              metadata: { cartTransactionId: transaction.id }
            }
          });

          for (const oi of orderItemsData) {
            await tx.orderItem.create({
              data: { ...oi, orderId: order.id }
            });
          }

          for (const item of providerItems) {
            await tx.serviceProduct.update({
              where: { id: item.listingId },
              data: { soldCount: { increment: item.quantity } }
            });
          }

          if (netCents > 0n) {
            await this.walletService.creditBalance({ providerId, amountDec: centsToDecimal(netCents), session: tx });
          }

          createdOrders.push({ id: order.id, providerId, status: order.status });
          newOrderIds.push(order.id);
        }

        if (createdOrders.length) {
          await tx.transaction.update({
            where: { id: transaction.id },
            data: { metadata: { ...(transaction.metadata ?? {}), createdOrders } }
          });
        }

        if (Number(transaction.fee) > 0) {
          await this.walletService.creditBalance({ providerId: null, amountDec: transaction.fee, session: tx });
        }
      } else if (transaction.type === "service_booking") {
        const bookingId = transaction.metadata?.bookingId;
        const booking = bookingId ? await tx.serviceBooking.findUnique({ where: { id: bookingId } }) : null;
        // Only a booking that is still confirmed and waiting for payment takes the money. A cancelled or expired
        // booking, or one already paid, holds it for a refund instead of crediting the provider.
        if (!booking || booking.status !== "confirmed" || booking.paymentStatus !== "payable") {
          await flagRefundDue({ db: tx, transactionId: transaction.id, reason: !booking ? "booking_missing" : booking.paymentStatus === "paid" ? "booking_already_paid" : `booking_${booking.status}` });
          return { ok: true, transactionId: transaction.id, type: transaction.type, held: true };
        }
        if (transaction.providerId) {
          await this.walletService.creditBalance({ providerId: transaction.providerId, amountDec: transaction.netAmount, session: tx });
        }
        if (Number(transaction.fee) > 0) {
          await this.walletService.creditBalance({ providerId: null, amountDec: transaction.fee, session: tx });
        }
        await tx.serviceBooking.update({
          where: { id: bookingId },
          data: { paymentStatus: "paid", amountPaid: transaction.amount, paidAt: new Date(), transactionId: transaction.id, payBy: null }
        });
        paidBookingIds.push(bookingId);
      } else if (transaction.type === "ride_trip") {
        const tripId = transaction.metadata?.tripId;
        const trip = tripId ? await tx.rideTrip.findUnique({ where: { id: tripId } }) : null;
        if (trip?.driverId) {
          await this.rideDriverWalletService.creditBalance({ rideDriverId: trip.driverId, amountDec: transaction.netAmount, session: tx });
          await tx.rideTrip.update({ where: { id: tripId }, data: { paymentStatus: "succeeded" } });
        }
        // Ride commission is platform revenue, same wallet as contact-unlock/purchase-fee/subscription.
        if (Number(transaction.fee) > 0) {
          await this.walletService.creditBalance({ providerId: null, amountDec: transaction.fee, session: tx });
        }
      } else if (transaction.type === "bus_ticket" && this.busBookingService) {
        const outcome = await this.busBookingService.confirmPayment({ tx, transaction, walletService: this.walletService });
        if (outcome?.confirmed) busBookingToEmail = outcome.bookingId;
        if (outcome?.refundDue) await flagRefundDue({ db: tx, transactionId: transaction.id, reason: "bus_seats_gone" });
      }

      return { ok: true, transactionId: transaction.id, type: transaction.type };
    });

    if (busBookingToEmail) {
      this.busBookingService.sendTicketEmail(busBookingToEmail).catch(() => {});
    }

    for (const orderId of paidOrderIds) {
      this.orderNotificationService.notifyProviderOrderPaid({ orderId }).catch(() => {});
      this.documentService?.issueReceipt({ orderId }).catch(() => {});
    }
    for (const bookingId of paidBookingIds) {
      this.serviceBookingService?.notifyPaid(bookingId).catch(() => {});
    }

    for (const orderId of newOrderIds) {
      this.orderNotificationService.notifyProviderNewOrder({ orderId }).catch(() => {});
      // Paid online: the buyer's receipt goes out right away.
      this.documentService?.issueReceipt({ orderId }).catch(() => {});
    }

    return result;
  }

  async handleMobileMoneyFailed(payload) {
    const reference = String(payload?.failed_transaction_reference || "").trim();
    if (!reference) {
      throw new AppError({ message: "failed_transaction_reference is required", statusCode: 400, code: "MISSING_REFERENCE" });
    }

    const transaction = await prisma.transaction.findFirst({ where: { reference } });
    if (!transaction) {
      return { ok: false, reason: "unknown_reference" };
    }
    if (transaction.status !== "pending") {
      return { ok: true, reason: "already_processed" };
    }

    const moved = await prisma.transaction.updateMany({ where: { id: transaction.id, status: "pending" }, data: { status: "failed" } });
    if (moved.count === 0) return { ok: true, reason: "already_processed" };
    if (transaction.type === "bus_ticket" && this.busBookingService) {
      await this.busBookingService.failPayment(transaction);
    }
    return { ok: true, transactionId: transaction.id };
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

  // Approving a withdrawal pays it out immediately: the gateway's withdraw call responds synchronously (no
  // webhook). The request is CLAIMED first with a conditional update, so two clicks or two admins can never
  // both pay it. A clear refusal from the gateway puts the money back; if the outcome is unknown (timeout,
  // dropped connection, gateway error) the request is parked as "payout_unknown" for a person to settle,
  // because refunding the wallet after a payout that did go through would pay the provider twice.
  async adminApproveWithdrawal({ adminUserId, withdrawalRequestId, note }) {
    if (!withdrawalRequestId) {
      throw new AppError({ message: "Invalid withdrawalRequestId", statusCode: 400, code: "INVALID_WITHDRAWAL_ID" });
    }

    const reqDoc = await prisma.withdrawalRequest.findUnique({ where: { id: withdrawalRequestId } });
    if (!reqDoc) {
      throw new AppError({ message: "Withdrawal not found", statusCode: 404, code: "WITHDRAWAL_NOT_FOUND" });
    }
    if (reqDoc.status !== "requested") {
      throw new AppError({ message: "This withdrawal has already been handled.", statusCode: 409, code: "INVALID_WITHDRAWAL_STATE" });
    }

    const provider = await prisma.provider.findUnique({ where: { id: reqDoc.providerId } });
    const phone = provider?.contact?.phone || provider?.contact?.whatsapp;
    if (!phone) {
      throw new AppError({ message: "This provider has no phone number on file for payout", statusCode: 400, code: "PROVIDER_PHONE_MISSING" });
    }

    const claim = await prisma.withdrawalRequest.updateMany({
      where: { id: withdrawalRequestId, status: "requested" },
      data: { status: "approved", approvedBy: adminUserId, approvedAt: new Date(), ...(note !== undefined ? { note } : {}) }
    });
    if (claim.count === 0) {
      throw new AppError({ message: "This withdrawal has already been handled.", statusCode: 409, code: "INVALID_WITHDRAWAL_STATE" });
    }

    try {
      await this.mobileMoneyService.initiateWithdrawal({
        amount: reqDoc.netAmount,
        phone,
        reference: `withdraw-${withdrawalRequestId}`,
        userId: reqDoc.providerId
      });
    } catch (payoutError) {
      if (isAmbiguousPayoutError(payoutError)) {
        await prisma.withdrawalRequest.updateMany({
          where: { id: withdrawalRequestId, status: "approved" },
          data: { status: "payout_unknown", note: "The payout may or may not have gone through. Check the gateway, then mark it paid or reject it." }
        });
        throw new AppError({
          message: "The payout's outcome is unknown. Check the gateway balance and statement, then mark it paid or reject it here.",
          statusCode: 502,
          code: "PAYOUT_OUTCOME_UNKNOWN"
        });
      }
      await prisma.$transaction(async (tx) => {
        const moved = await tx.withdrawalRequest.updateMany({
          where: { id: withdrawalRequestId, status: "approved" },
          data: { status: "rejected", rejectedBy: adminUserId, rejectedAt: new Date(), note: `Payout failed: ${payoutError.message}` }
        });
        if (moved.count === 0) return;
        await this.walletService.creditBalance({ providerId: reqDoc.providerId, amountDec: reqDoc.amount, session: tx });
        await tx.transaction.update({ where: { id: reqDoc.transactionId }, data: { status: "failed" } });
      });
      throw payoutError;
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.transaction.update({ where: { id: reqDoc.transactionId }, data: { status: "succeeded" } });
      await tx.withdrawalRequest.updateMany({ where: { id: withdrawalRequestId, status: "approved" }, data: { status: "paid", paidBy: adminUserId, paidAt: new Date() } });
      return tx.withdrawalRequest.findUnique({ where: { id: withdrawalRequestId } });
    });

    return { withdrawalRequestId: updated.id, status: updated.status };
  }

  // A request can be rejected only while it is waiting, or after an unknown payout once someone has checked
  // the gateway. Never while a payout is in flight.
  async adminRejectWithdrawal({ adminUserId, withdrawalRequestId, note }) {
    if (!withdrawalRequestId) {
      throw new AppError({ message: "Invalid withdrawalRequestId", statusCode: 400, code: "INVALID_WITHDRAWAL_ID" });
    }

    return prisma.$transaction(async (tx) => {
      const reqDoc = await tx.withdrawalRequest.findUnique({ where: { id: withdrawalRequestId } });
      if (!reqDoc) {
        throw new AppError({ message: "Withdrawal not found", statusCode: 404, code: "WITHDRAWAL_NOT_FOUND" });
      }
      const moved = await tx.withdrawalRequest.updateMany({
        where: { id: withdrawalRequestId, status: { in: ["requested", "payout_unknown"] } },
        data: { status: "rejected", rejectedBy: adminUserId, rejectedAt: new Date(), ...(note !== undefined ? { note } : {}) }
      });
      if (moved.count === 0) {
        throw new AppError({ message: "This withdrawal can't be rejected in its current state.", statusCode: 409, code: "INVALID_WITHDRAWAL_STATE" });
      }

      await this.walletService.creditBalance({ providerId: reqDoc.providerId, amountDec: reqDoc.amount, session: tx });
      await tx.transaction.update({ where: { id: reqDoc.transactionId }, data: { status: "canceled" } });

      return { withdrawalRequestId, status: "rejected" };
    });
  }

  // For a payout that went through but whose result we never saw (unknown outcome, or a crash mid-approval).
  async adminMarkWithdrawalPaid({ adminUserId, withdrawalRequestId, note }) {
    if (!withdrawalRequestId) {
      throw new AppError({ message: "Invalid withdrawalRequestId", statusCode: 400, code: "INVALID_WITHDRAWAL_ID" });
    }

    return prisma.$transaction(async (tx) => {
      const reqDoc = await tx.withdrawalRequest.findUnique({ where: { id: withdrawalRequestId } });
      if (!reqDoc) {
        throw new AppError({ message: "Withdrawal not found", statusCode: 404, code: "WITHDRAWAL_NOT_FOUND" });
      }
      const stuck = reqDoc.status === "approved" && reqDoc.approvedAt && reqDoc.approvedAt < new Date(Date.now() - 5 * 60 * 1000);
      if (reqDoc.status !== "payout_unknown" && !stuck) {
        throw new AppError({ message: "Only an unknown or stuck payout can be marked paid by hand.", statusCode: 409, code: "INVALID_WITHDRAWAL_STATE" });
      }
      const moved = await tx.withdrawalRequest.updateMany({
        where: { id: withdrawalRequestId, status: reqDoc.status },
        data: { status: "paid", paidBy: adminUserId, paidAt: new Date(), ...(note !== undefined ? { note } : {}) }
      });
      if (moved.count === 0) {
        throw new AppError({ message: "This withdrawal has already been handled.", statusCode: 409, code: "INVALID_WITHDRAWAL_STATE" });
      }
      await tx.transaction.update({ where: { id: reqDoc.transactionId }, data: { status: "succeeded" } });
      return { withdrawalRequestId, status: "paid" };
    });
  }

  // Payments we hold but could not pass on, or that must go back after a cancellation. The actual money is returned
  // outside the system (mobile money), then settled here.
  async listRefundQueue() {
    const rows = await prisma.transaction.findMany({
      where: { status: "succeeded", type: { in: ["purchase", "service_booking", "bus_ticket", "contact_unlock", "subscription"] } },
      orderBy: { createdAt: "desc" },
      take: 1500,
      include: { user: { select: { name: true, email: true, phone: true } }, provider: { select: { businessName: true } } }
    });
    const items = rows
      .filter((t) => t.metadata?.refundDue && !t.metadata?.refundedAt)
      .map((t) => ({
        transactionId: t.id,
        type: t.type,
        amount: t.amount.toString(),
        net: t.netAmount.toString(),
        fee: t.fee.toString(),
        reason: t.metadata.refundReason ?? "",
        needsReversal: Boolean(t.metadata.needsReversal),
        flaggedAt: t.metadata.refundFlaggedAt ?? t.updatedAt,
        payerPhone: t.metadata.msisdn ?? t.metadata.phone ?? t.user?.phone ?? null,
        payerName: t.metadata.payerNames ?? t.user?.name ?? null,
        payerEmail: t.user?.email ?? null,
        provider: t.provider?.businessName ?? null,
        reference: t.reference
      }));
    return { items };
  }

  // Marks a refund as paid back. If the provider had been credited, that credit is taken back from their wallet
  // first; when their balance is too low the admin must either wait or settle with the provider by hand (skipReversal).
  async resolveRefund({ adminUserId, transactionId, note, skipReversal = false }) {
    return prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({ where: { id: transactionId } });
      if (!transaction || !transaction.metadata?.refundDue || transaction.metadata?.refundedAt) {
        throw new AppError({ message: "This payment isn't waiting for a refund.", statusCode: 404, code: "REFUND_NOT_FOUND" });
      }
      if (transaction.metadata.needsReversal && !skipReversal) {
        if (transaction.providerId && Number(transaction.netAmount) > 0) {
          const debited = await this.walletService.debitBalance({ providerId: transaction.providerId, amountDec: transaction.netAmount, session: tx });
          if (!debited) {
            throw new AppError({ message: "The provider's wallet no longer holds this amount (they may have withdrawn it). Settle with them directly, then resolve with 'skip reversal'.", statusCode: 409, code: "PROVIDER_BALANCE_TOO_LOW" });
          }
        }
        if (Number(transaction.fee) > 0) {
          await this.walletService.debitBalance({ providerId: null, amountDec: transaction.fee, session: tx });
        }
      }
      await tx.transaction.update({
        where: { id: transaction.id },
        data: { status: "refunded", metadata: { ...transaction.metadata, refundedAt: new Date().toISOString(), refundedBy: adminUserId, refundNote: note ?? null, reversalSkipped: Boolean(skipReversal) } }
      });
      const orderId = transaction.metadata?.orderId;
      if (orderId) {
        const order = await tx.order.findUnique({ where: { id: orderId } });
        if (order) await tx.order.update({ where: { id: orderId }, data: { metadata: { ...(order.metadata ?? {}), paymentStatus: "refunded" } } });
      }
      const bookingId = transaction.metadata?.bookingId;
      if (bookingId && transaction.type === "service_booking") {
        await tx.serviceBooking.updateMany({ where: { id: bookingId, transactionId: transaction.id }, data: { paymentStatus: "refunded" } });
      }
      return { transactionId: transaction.id, status: "refunded" };
    });
  }

  async getPlatformWallet() {
    const wallet = await this.walletService.ensureWallet({ providerId: null });
    return { balance: wallet.balance.toString(), updatedAt: wallet.updatedAt };
  }

  // Revenue type isn't its own ledger — it's derived from which field of which transaction type
  // actually gets credited to the platform wallet (see handleMobileMoneySuccess): the full
  // netAmount for contact_unlock and subscription, but only the fee cut for purchase (the rest
  // goes to the provider). "Available" nets out prior platform withdrawals tagged to that type,
  // so a type can't be withdrawn against twice, and is capped at the real wallet balance so a
  // bookkeeping mismatch can never let anyone withdraw more than physically exists.
  async getPlatformRevenueByType() {
    const REVENUE_TYPES = [
      { type: "contact_unlock", field: "netAmount" },
      { type: "subscription", field: "netAmount" },
      { type: "purchase", field: "fee" },
      { type: "bus_ticket", field: "fee" },
      { type: "service_booking", field: "fee" }
    ];

    const [aggregates, platformWithdrawals, wallet] = await Promise.all([
      Promise.all(
        REVENUE_TYPES.map(({ type, field }) =>
          prisma.transaction.aggregate({ where: { type, status: "succeeded", NOT: { reference: { startsWith: "bus-demo-" } } }, _sum: { [field]: true } })
        )
      ),
      prisma.transaction.findMany({ where: { type: "platform_withdrawal", status: "succeeded" }, select: { amount: true, metadata: true } }),
      this.walletService.ensureWallet({ providerId: null })
    ]);

    const withdrawnCentsByType = new Map();
    for (const w of platformWithdrawals) {
      const sourceType = w.metadata?.sourceType;
      if (!sourceType) continue;
      const cents = parseMoneyToCents(w.amount);
      withdrawnCentsByType.set(sourceType, (withdrawnCentsByType.get(sourceType) ?? 0n) + cents);
    }

    const balanceCents = parseMoneyToCents(wallet.balance);

    const byType = REVENUE_TYPES.map(({ type, field }, index) => {
      const sumValue = aggregates[index]._sum[field];
      const earnedCents = sumValue ? parseMoneyToCents(sumValue) : 0n;
      const withdrawnCents = withdrawnCentsByType.get(type) ?? 0n;
      let availableCents = earnedCents - withdrawnCents;
      if (availableCents < 0n) availableCents = 0n;
      if (availableCents > balanceCents) availableCents = balanceCents;
      return {
        type,
        earned: centsToDecimal(earnedCents).toString(),
        withdrawn: centsToDecimal(withdrawnCents).toString(),
        available: centsToDecimal(availableCents).toString()
      };
    });

    return { balance: wallet.balance.toString(), byType };
  }

  async platformWithdraw({ adminUserId, amount, phone, type, note }) {
    if (!phone) {
      throw new AppError({ message: "A destination phone number is required", statusCode: 400, code: "PHONE_REQUIRED" });
    }
    const amountCents = parseMoneyToCents(amount);
    if (amountCents <= 0n) {
      throw new AppError({ message: "Invalid amount", statusCode: 400, code: "INVALID_AMOUNT" });
    }

    const normalizedType = type ? String(type).toLowerCase() : null;
    if (normalizedType && !["contact_unlock", "subscription", "purchase", "bus_ticket", "service_booking"].includes(normalizedType)) {
      throw new AppError({ message: "Invalid type", statusCode: 400, code: "INVALID_TYPE" });
    }

    const revenue = await this.getPlatformRevenueByType();
    const capDec = normalizedType ? revenue.byType.find((r) => r.type === normalizedType)?.available ?? "0.00" : revenue.balance;
    const capCents = parseMoneyToCents(capDec);
    if (amountCents > capCents) {
      throw new AppError({
        message: normalizedType ? "Amount exceeds available balance for this revenue type" : "Amount exceeds wallet balance",
        statusCode: 409,
        code: "INSUFFICIENT_FUNDS",
        details: { available: capDec }
      });
    }

    const amountDec = centsToDecimal(amountCents);

    const transactionId = await prisma.$transaction(async (tx) => {
      const wallet = await this.walletService.debitBalance({ providerId: null, amountDec, session: tx });
      if (!wallet) {
        throw new AppError({ message: "Insufficient funds", statusCode: 409, code: "INSUFFICIENT_FUNDS" });
      }
      const transaction = await tx.transaction.create({
        data: {
          type: "platform_withdrawal",
          userId: null,
          providerId: null,
          amount: amountDec,
          fee: centsToDecimal(0n),
          netAmount: amountDec,
          status: "pending",
          metadata: { sourceType: normalizedType, phone, note: note ?? null, initiatedBy: adminUserId }
        }
      });
      return transaction.id;
    });

    try {
      await this.mobileMoneyService.initiateWithdrawal({
        amount: amountDec,
        phone,
        reference: `platform-withdraw-${transactionId}`,
        userId: "platform"
      });
    } catch (payoutError) {
      if (isAmbiguousPayoutError(payoutError)) {
        // Left pending with the wallet still debited: the money may have gone out. Settle it by hand.
        const current = await prisma.transaction.findUnique({ where: { id: transactionId }, select: { metadata: true } });
        await prisma.transaction.update({ where: { id: transactionId }, data: { metadata: { ...(current?.metadata ?? {}), payoutUnknown: true } } });
        throw new AppError({ message: "The payout's outcome is unknown. Check the gateway statement before trying again.", statusCode: 502, code: "PAYOUT_OUTCOME_UNKNOWN" });
      }
      await prisma.$transaction(async (tx) => {
        await this.walletService.creditBalance({ providerId: null, amountDec, session: tx });
        await tx.transaction.update({ where: { id: transactionId }, data: { status: "failed" } });
      });
      throw payoutError;
    }

    const updated = await prisma.transaction.update({ where: { id: transactionId }, data: { status: "succeeded" } });
    return { transactionId: updated.id, status: updated.status, amount: updated.amount.toString() };
  }
}
