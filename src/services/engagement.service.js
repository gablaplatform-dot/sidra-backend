import { Prisma } from "@prisma/client";

import { prisma } from "../config/db.js";
import { AppError } from "../utils/AppError.js";
import { OrderNotificationService } from "./orderNotification.service.js";
import { flagRefundDue } from "../utils/refunds.js";

const moneyString = (value) => (value?.toString ? value.toString() : String(value ?? "0.00"));
const toDecimal = (value) => new Prisma.Decimal(String(value ?? "0"));

// How an order is paid, derived so older orders need no migration: anything tied to a mobile-money
// transaction was paid online; everything else is a cash order (pay on delivery / pickup).
// An online order is paid only after the seller accepts it: awaiting_approval -> payable -> paid.
const orderPayment = (order) => {
  if (order.transactionId) return { paymentMethod: "mobile_money", paymentStatus: "paid" };
  if (order.metadata?.paymentMethod === "online") {
    const closed = ["rejected", "canceled"].includes(order.status);
    return { paymentMethod: "online", paymentStatus: closed ? "closed" : order.metadata?.paymentStatus ?? "awaiting_approval" };
  }
  return { paymentMethod: "cash", paymentStatus: order.metadata?.paymentStatus ?? "unpaid" };
};

export class EngagementService {
  constructor({ orderNotificationService = new OrderNotificationService() } = {}) {
    this.orderNotificationService = orderNotificationService;
    this.documentService = null;
  }

  // Quotations and receipts are wired in after construction (see app.js).
  attachDocuments(documentService) {
    this.documentService = documentService;
  }

  async recordProfileVisit({ actorUserId = null, providerId, source, sessionId, ipHash, userAgent, metadata }) {
    const provider = await prisma.provider.findUnique({ where: { id: providerId } });
    if (!provider || !provider.isApproved || provider.moderationStatus !== "approved") {
      throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    }
    const visit = await prisma.$transaction(async (tx) => {
      const created = await tx.profileVisit.create({
        data: {
          providerId,
          userId: actorUserId,
          source: source ?? null,
          sessionId: sessionId ?? null,
          ipHash: ipHash ?? null,
          userAgent: userAgent ?? null,
          metadata: metadata ?? {}
        }
      });
      await tx.provider.update({ where: { id: providerId }, data: { profileViews: { increment: 1 } } });
      return created;
    });
    return { id: visit.id, providerId: visit.providerId, createdAt: visit.createdAt };
  }

  async recordContactEvent({ actorUserId = null, providerId, type, value, paid = false, source, sessionId, metadata }) {
    const provider = await prisma.provider.findUnique({ where: { id: providerId } });
    if (!provider || !provider.isApproved || provider.moderationStatus !== "approved") {
      throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    }
    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.contactEvent.create({
        data: {
          providerId,
          userId: actorUserId,
          type,
          value: value ?? null,
          paid: Boolean(paid),
          source: source ?? null,
          sessionId: sessionId ?? null,
          metadata: metadata ?? {}
        }
      });
      await tx.provider.update({ where: { id: providerId }, data: { contactClicks: { increment: 1 } } });
      return created;
    });
    return { id: event.id, providerId: event.providerId, type: event.type, createdAt: event.createdAt };
  }

  async recordSearchEvent({ actorUserId = null, query, categoryId, filters, resultCount, sessionId }) {
    const event = await prisma.searchEvent.create({
      data: {
        userId: actorUserId,
        query: query ?? null,
        categoryId: categoryId ?? null,
        filters: filters ?? {},
        resultCount: Number(resultCount) || 0,
        sessionId: sessionId ?? null
      }
    });
    return { id: event.id, createdAt: event.createdAt };
  }

  async listFavorites({ actorUserId }) {
    const items = await prisma.favorite.findMany({
      where: { userId: actorUserId },
      orderBy: { createdAt: "desc" },
      include: { provider: true }
    });

    return {
      items: items.map((item) => ({
        id: item.id,
        providerId: item.providerId,
        createdAt: item.createdAt,
        provider: {
          id: item.provider.id,
          businessName: item.provider.businessName,
          description: item.provider.description,
          categoryId: item.provider.categoryId,
          media: item.provider.media ?? {},
          ratingAvg: item.provider.ratingAvg ?? 0,
          ratingCount: item.provider.ratingCount ?? 0
        }
      }))
    };
  }

  async addFavorite({ actorUserId, providerId }) {
    const provider = await prisma.provider.findUnique({ where: { id: providerId } });
    if (!provider || !provider.isApproved || provider.moderationStatus !== "approved") {
      throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    }

    const favorite = await prisma.favorite.upsert({
      where: { userId_providerId: { userId: actorUserId, providerId } },
      update: {},
      create: { userId: actorUserId, providerId }
    });

    return { id: favorite.id, providerId: favorite.providerId, createdAt: favorite.createdAt };
  }

  async removeFavorite({ actorUserId, providerId }) {
    await prisma.favorite.deleteMany({ where: { userId: actorUserId, providerId } });
    return { deleted: true };
  }

  async listProviderReviews({ providerId, page = 1, limit = 20, includePending = false }) {
    const normalizedPage = Math.max(1, Number(page) || 1);
    const normalizedLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const where = { providerId, ...(includePending ? {} : { status: "approved" }) };
    const [items, total] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (normalizedPage - 1) * normalizedLimit,
        take: normalizedLimit,
        include: { user: true }
      }),
      prisma.review.count({ where })
    ]);

    return {
      items: items.map((review) => ({
        id: review.id,
        providerId: review.providerId,
        userId: review.userId,
        user: { id: review.user.id, name: review.user.name },
        rating: review.rating,
        comment: review.comment,
        status: review.status,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt
      })),
      page: normalizedPage,
      limit: normalizedLimit,
      total
    };
  }

  async createReview({ actorUserId, providerId, rating, comment }) {
    const provider = await prisma.provider.findUnique({ where: { id: providerId } });
    if (!provider || !provider.isApproved || provider.moderationStatus !== "approved") {
      throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    }

    const review = await prisma.review.upsert({
      where: { userId_providerId: { userId: actorUserId, providerId } },
      update: { rating, comment: comment ?? "", status: "pending" },
      create: { userId: actorUserId, providerId, rating, comment: comment ?? "", status: "pending" }
    });

    return {
      id: review.id,
      providerId: review.providerId,
      rating: review.rating,
      comment: review.comment,
      status: review.status,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt
    };
  }

  async createInquiry({ actorUserId = null, providerId, listingId, type = "general", name, email, phone, message, metadata }) {
    const provider = await prisma.provider.findUnique({ where: { id: providerId } });
    if (!provider || !provider.isApproved || provider.moderationStatus !== "approved") {
      throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    }

    const inquiry = await prisma.inquiry.create({
      data: {
        userId: actorUserId,
        providerId,
        listingId: listingId ?? null,
        type,
        name: name ?? null,
        email: email ?? null,
        phone: phone ?? null,
        message: message ?? "",
        metadata: metadata ?? {}
      }
    });

    return {
      id: inquiry.id,
      providerId: inquiry.providerId,
      listingId: inquiry.listingId,
      type: inquiry.type,
      status: inquiry.status,
      createdAt: inquiry.createdAt
    };
  }

  async listProviderInquiries({ actorUserId, status, page = 1, limit = 50 }) {
    const provider = await prisma.provider.findUnique({ where: { userId: actorUserId } });
    if (!provider) throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });

    const normalizedPage = Math.max(1, Number(page) || 1);
    const normalizedLimit = Math.min(100, Math.max(1, Number(limit) || 50));
    const where = { providerId: provider.id, ...(status ? { status } : {}) };
    const [items, total] = await Promise.all([
      prisma.inquiry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (normalizedPage - 1) * normalizedLimit,
        take: normalizedLimit
      }),
      prisma.inquiry.count({ where })
    ]);

    return { items, page: normalizedPage, limit: normalizedLimit, total };
  }

  async updateProviderInquiry({ actorUserId, inquiryId, status }) {
    const provider = await prisma.provider.findUnique({ where: { userId: actorUserId } });
    if (!provider) throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });

    const inquiry = await prisma.inquiry.findFirst({ where: { id: inquiryId, providerId: provider.id } });
    if (!inquiry) throw new AppError({ message: "Inquiry not found", statusCode: 404, code: "INQUIRY_NOT_FOUND" });

    return prisma.inquiry.update({ where: { id: inquiry.id }, data: { status } });
  }

  // An order placed through here is always a "cash" order: nothing is charged online and the buyer
  // pays the seller directly on delivery or pickup. (Orders paid by mobile money are created by the
  // payment service when the transaction succeeds, and carry a transactionId instead.)
  async createOrder({ actorUserId, providerId, items, customer, fulfillment, metadata, paymentMethod = "cash" }) {
    if (!Array.isArray(items) || !items.length) {
      throw new AppError({ message: "Order items are required", statusCode: 400, code: "ORDER_ITEMS_REQUIRED" });
    }

    const cleanCustomer = {
      name: String(customer?.name ?? "").trim().slice(0, 120),
      phone: String(customer?.phone ?? "").trim().slice(0, 32),
      ...(customer?.email ? { email: String(customer.email).trim().slice(0, 254) } : {}),
      ...(customer?.notes ? { notes: String(customer.notes).trim().slice(0, 1000) } : {})
    };
    if (!cleanCustomer.name) {
      throw new AppError({ message: "Your name is required", statusCode: 400, code: "ORDER_NAME_REQUIRED" });
    }
    if (cleanCustomer.phone.replace(/\D/g, "").length < 7) {
      throw new AppError({ message: "A valid phone number is required so the seller can reach you", statusCode: 400, code: "ORDER_PHONE_REQUIRED" });
    }
    const method = ["delivery", "pickup"].includes(fulfillment?.method) ? fulfillment.method : null;
    const address = String(fulfillment?.address ?? "").trim().slice(0, 500);
    if (method === "delivery" && !address) {
      throw new AppError({ message: "Enter a delivery address", statusCode: 400, code: "ORDER_ADDRESS_REQUIRED" });
    }
    // Where the buyer picked on the map or chose from the suggestions. The coordinates are kept
    // for the seller's directions; they are never shown to the buyer as numbers.
    const lat = Number(fulfillment?.lat);
    const lng = Number(fulfillment?.lng);
    const hasPoint = method === "delivery" && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    const locationSource = ["map", "search"].includes(fulfillment?.locationSource) ? fulfillment.locationSource : undefined;
    const cleanFulfillment = method
      ? { method, ...(method === "delivery" ? { address } : {}), ...(hasPoint ? { lat, lng, ...(locationSource ? { locationSource } : {}) } : {}) }
      : {};

    const provider = await prisma.provider.findUnique({ where: { id: providerId } });
    if (!provider || !provider.isApproved || provider.moderationStatus !== "approved") {
      throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    }

    const listingIds = items.map((item) => item.listingId).filter(Boolean);
    const listings = await prisma.serviceProduct.findMany({ where: { id: { in: listingIds }, providerId, status: "approved" } });
    const listingMap = new Map(listings.map((listing) => [listing.id, listing]));

    const normalizedItems = items.map((item) => {
      const listing = item.listingId ? listingMap.get(item.listingId) : null;
      if (item.listingId && !listing) {
        throw new AppError({ message: "Listing not found", statusCode: 404, code: "LISTING_NOT_FOUND" });
      }
      // Services aren't ordered: guests unlock the provider's contact, or book when the service takes bookings.
      if (listing?.type === "service") {
        throw new AppError({ message: "Services can't be ordered. Unlock the provider's contact, or book if bookings are open.", statusCode: 400, code: "SERVICE_NOT_ORDERABLE" });
      }
      const quantity = Math.max(1, Math.min(99, Number(item.quantity) || 1));
      // For a real listing the price is always the listing's own: the client's unitPrice is only
      // trusted for free-form lines that have no listing behind them.
      const unitPrice = toDecimal(listing ? listing.price : item.unitPrice ?? 0);
      const total = unitPrice.mul(quantity);
      return {
        listingId: listing?.id ?? null,
        name: listing?.name ?? item.name ?? "Item",
        quantity,
        unitPrice,
        total,
        metadata: item.metadata ?? {}
      };
    });

    const subtotal = normalizedItems.reduce((sum, item) => sum.add(item.total), new Prisma.Decimal("0"));

    // Paying online is offered only where the seller and every item allow it; the charge itself waits for the seller's approval.
    const online = paymentMethod === "online";
    if (online) {
      if (!provider.onlinePaymentsEnabled || listings.some((l) => l.onlinePaymentEnabled === false)) {
        throw new AppError({ message: "This seller isn't taking online payments. Choose pay on delivery.", statusCode: 400, code: "ONLINE_PAYMENTS_UNAVAILABLE" });
      }
      if (subtotal.lte(0)) {
        throw new AppError({ message: "This order has no price to pay online.", statusCode: 400, code: "INVALID_AMOUNT" });
      }
    }

    const order = await prisma.order.create({
      data: {
        userId: actorUserId,
        providerId,
        subtotal,
        total: subtotal,
        customer: cleanCustomer,
        fulfillment: cleanFulfillment,
        metadata: { ...(metadata ?? {}), ...(online ? { paymentMethod: "online", paymentStatus: "awaiting_approval" } : { paymentMethod: "cash", paymentStatus: "unpaid" }) },
        items: { create: normalizedItems }
      },
      include: { items: true }
    });

    this.orderNotificationService.notifyProviderNewOrder({ orderId: order.id }).catch(() => {});
    // The buyer has not paid yet, so they get the seller's quotation by email.
    this.documentService?.issueQuotation({ orderId: order.id }).catch(() => {});

    return {
      id: order.id,
      providerId: order.providerId,
      providerName: provider.businessName,
      status: order.status,
      paymentMethod: online ? "online" : "cash",
      paymentStatus: online ? "awaiting_approval" : "unpaid",
      subtotal: moneyString(order.subtotal),
      total: moneyString(order.total),
      fulfillment: order.fulfillment,
      items: order.items.map((item) => ({
        id: item.id,
        listingId: item.listingId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: moneyString(item.unitPrice),
        total: moneyString(item.total)
      })),
      createdAt: order.createdAt
    };
  }

  providerOrderDto(order, documents) {
    return {
      documents: documents.get(order.id) ?? [],
      id: order.id,
      status: order.status,
      subtotal: moneyString(order.subtotal),
      fee: moneyString(order.fee),
      total: moneyString(order.total),
      customer: order.customer,
      fulfillment: order.fulfillment,
      ...orderPayment(order),
      items: order.items,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    };
  }

  async listProviderOrders({ actorUserId, status, q, from, to, page = 1, limit = 50 }) {
    const provider = await prisma.provider.findUnique({ where: { userId: actorUserId } });
    if (!provider) throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });

    const normalizedPage = Math.max(1, Number(page) || 1);
    const normalizedLimit = Math.min(100, Math.max(1, Number(limit) || 50));
    const statuses = String(status ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const created = {};
    if (from) created.gte = new Date(`${String(from).slice(0, 10)}T00:00:00.000Z`);
    if (to) created.lte = new Date(`${String(to).slice(0, 10)}T23:59:59.999Z`);
    const where = {
      providerId: provider.id,
      ...(statuses.length ? { status: { in: statuses } } : {}),
      ...(created.gte || created.lte ? { createdAt: created } : {})
    };
    const needle = String(q ?? "").trim().toLowerCase();

    let items;
    let total;
    if (needle) {
      // Buyer details live in JSON, so the text search runs over the (already status/date filtered) orders in memory.
      const all = await prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, take: 2000, include: { items: true } });
      const hit = all.filter((o) => {
        const c = o.customer ?? {};
        const hay = [o.id, o.id.slice(-6), c.name, c.phone, c.email, c.notes, o.fulfillment?.address, ...o.items.map((i) => i.name)].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(needle);
      });
      total = hit.length;
      items = hit.slice((normalizedPage - 1) * normalizedLimit, normalizedPage * normalizedLimit);
    } else {
      [items, total] = await Promise.all([
        prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (normalizedPage - 1) * normalizedLimit, take: normalizedLimit, include: { items: true } }),
        prisma.order.count({ where })
      ]);
    }

    const documents = this.documentService ? await this.documentService.forOrders(items.map((o) => o.id)) : new Map();
    return { items: items.map((order) => this.providerOrderDto(order, documents)), page: normalizedPage, limit: normalizedLimit, total };
  }

  async getProviderOrder({ actorUserId, orderId }) {
    const provider = await prisma.provider.findUnique({ where: { userId: actorUserId } });
    if (!provider) throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    const order = await prisma.order.findFirst({ where: { id: orderId, providerId: provider.id }, include: { items: true } });
    if (!order) throw new AppError({ message: "Order not found", statusCode: 404, code: "ORDER_NOT_FOUND" });
    const documents = this.documentService ? await this.documentService.forOrders([order.id]) : new Map();
    return this.providerOrderDto(order, documents);
  }

  async updateProviderOrder({ actorUserId, orderId, status }) {
    const provider = await prisma.provider.findUnique({ where: { userId: actorUserId } });
    if (!provider) throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });

    const order = await prisma.order.findFirst({ where: { id: orderId, providerId: provider.id } });
    if (!order) throw new AppError({ message: "Order not found", statusCode: 404, code: "ORDER_NOT_FOUND" });
    if (order.status === status) return order;
    if (["fulfilled", "canceled", "rejected"].includes(order.status)) {
      throw new AppError({ message: "This order is already closed.", statusCode: 409, code: "ORDER_CLOSED" });
    }

    const payment = orderPayment(order);
    const data = { status };
    if (payment.paymentMethod === "online" && !order.transactionId) {
      // Online orders: accepting opens payment; delivering or completing needs the money in; declining closes it.
      if (status === "accepted") data.metadata = { ...(order.metadata ?? {}), paymentStatus: "payable", approvedAt: new Date().toISOString() };
      else if (status === "delivering" || status === "fulfilled") throw new AppError({ message: "This order hasn't been paid yet. You can deliver it once the buyer pays.", statusCode: 409, code: "ORDER_NOT_PAID" });
      else if (status === "pending") data.metadata = { ...(order.metadata ?? {}), paymentStatus: "awaiting_approval" };
    } else if (status === "fulfilled" && payment.paymentMethod === "cash") {
      data.metadata = { ...(order.metadata ?? {}), paymentStatus: "paid_cash" };
    }
    const updated = await prisma.order.update({ where: { id: order.id }, data });
    // A paid order that is cancelled or rejected goes to the refund queue; the provider's credit is reversed when it's settled.
    if (order.transactionId && ["canceled", "rejected"].includes(status)) {
      await flagRefundDue({ transactionId: order.transactionId, reason: `order_${status}`, needsReversal: true });
    }
    // Cash collected on delivery: the buyer gets their receipt now.
    if (data.metadata?.paymentStatus === "paid_cash") this.documentService?.issueReceipt({ orderId: order.id }).catch(() => {});
    // The buyer hears about every change: accepted (online orders also learn they can pay now), delivering, delivered, declined, cancelled.
    if (status === "accepted" && data.metadata?.paymentStatus === "payable") this.orderNotificationService.notifyBuyerOrderApproved({ orderId: order.id }).catch(() => {});
    else if (["accepted", "delivering", "fulfilled", "rejected", "canceled"].includes(status)) this.orderNotificationService.notifyBuyerOrderStatus({ orderId: order.id, status }).catch(() => {});
    return updated;
  }

  // The buyer's own orders with what was ordered, how it stands, and the quotations and receipts tied to each.
  async listMyOrders({ actorUserId, status, page = 1, limit = 20 }) {
    const take = Math.min(50, Math.max(1, Number(limit) || 20));
    const skip = (Math.max(1, Number(page) || 1) - 1) * take;
    const where = { userId: actorUserId, ...(status ? { status } : {}) };
    const [rows, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: { items: true, provider: { select: { id: true, businessName: true, media: true } } }
      }),
      prisma.order.count({ where })
    ]);
    const documents = this.documentService ? await this.documentService.forOrders(rows.map((o) => o.id)) : new Map();
    return {
      total,
      page: Number(page) || 1,
      items: rows.map((order) => ({
        id: order.id,
        status: order.status,
        subtotal: moneyString(order.subtotal),
        total: moneyString(order.total),
        fulfillment: { method: order.fulfillment?.method ?? null, address: order.fulfillment?.address ?? null },
        ...orderPayment(order),
        provider: {
          id: order.provider.id,
          businessName: order.provider.businessName,
          avatarUrl: order.provider.media?.avatarUrl ?? null
        },
        items: order.items.map((i) => ({ id: i.id, listingId: i.listingId, name: i.name, quantity: i.quantity, unitPrice: moneyString(i.unitPrice), total: moneyString(i.total) })),
        documents: documents.get(order.id) ?? [],
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      }))
    };
  }

  // Lifetime totals reuse the running counters already maintained on Provider (profileViews,
  // contactClicks) rather than re-counting ProfileVisit/ContactEvent rows - cheaper, and those
  // counters ARE the lifetime total by construction (see recordProfileVisit/recordContactEvent).
  // Only the chart + week-over-week trend look at a bounded recent window.
  async getProviderAnalytics({ actorUserId, days = 30 }) {
    const provider = await prisma.provider.findUnique({ where: { userId: actorUserId } });
    if (!provider) throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });

    const normalizedDays = Math.min(90, Math.max(7, Number(days) || 30));
    // Built and walked entirely in UTC calendar days, to match dayKey()'s UTC-based
    // toISOString().slice(0,10) below - mixing local-time date math (setDate/setHours) with a
    // UTC-formatted key silently drops or duplicates boundary days whenever the server's local
    // timezone isn't UTC.
    const now = new Date();
    const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    since.setUTCDate(since.getUTCDate() - (normalizedDays - 1));

    const [
      visitsInRange,
      contactUnlockCount,
      unlockRevenue,
      contactEventsByType,
      listingTotals,
      topListings,
      orderTotals,
      favoriteCount
    ] = await Promise.all([
      prisma.profileVisit.findMany({
        where: { providerId: provider.id, createdAt: { gte: since } },
        select: { createdAt: true }
      }),
      prisma.contactUnlock.count({ where: { providerId: provider.id, paid: true } }),
      prisma.transaction.aggregate({
        where: { providerId: provider.id, type: "contact_unlock", status: "succeeded" },
        _sum: { netAmount: true }
      }),
      prisma.contactEvent.groupBy({ by: ["type"], where: { providerId: provider.id }, _count: { _all: true } }),
      prisma.serviceProduct.aggregate({
        where: { providerId: provider.id },
        _sum: { viewCount: true, soldCount: true }
      }),
      prisma.serviceProduct.findMany({
        where: { providerId: provider.id },
        orderBy: { viewCount: "desc" },
        take: 5,
        select: { id: true, name: true, type: true, viewCount: true, soldCount: true }
      }),
      prisma.order.aggregate({
        where: { providerId: provider.id },
        _count: { _all: true }
      }),
      prisma.favorite.count({ where: { providerId: provider.id } })
    ]);

    const fulfilledRevenue = await prisma.order.aggregate({
      where: { providerId: provider.id, status: "fulfilled" },
      _sum: { total: true }
    });

    // Zero-fill every day in the window - a chart with gaps for quiet days looks broken, not quiet.
    const dayKey = (date) => date.toISOString().slice(0, 10);
    const countsByDay = new Map();
    for (const visit of visitsInRange) {
      const key = dayKey(visit.createdAt);
      countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1);
    }
    const dailyVisits = [];
    for (let i = 0; i < normalizedDays; i += 1) {
      const date = new Date(since);
      date.setUTCDate(date.getUTCDate() + i);
      const key = dayKey(date);
      dailyVisits.push({ date: key, count: countsByDay.get(key) ?? 0 });
    }

    let trend = null;
    if (dailyVisits.length >= 14) {
      const last7 = dailyVisits.slice(-7).reduce((sum, d) => sum + d.count, 0);
      const prev7 = dailyVisits.slice(-14, -7).reduce((sum, d) => sum + d.count, 0);
      const changePercent = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : (last7 > 0 ? 100 : 0);
      trend = { last7, prev7, changePercent };
    }

    return {
      totals: {
        profileViews: provider.profileViews,
        contactClicks: provider.contactClicks,
        contactUnlocks: contactUnlockCount,
        contactUnlockRevenue: moneyString(unlockRevenue._sum.netAmount ?? 0),
        listingViews: listingTotals._sum.viewCount ?? 0,
        listingsSold: listingTotals._sum.soldCount ?? 0,
        orders: orderTotals._count._all,
        orderRevenue: moneyString(fulfilledRevenue._sum.total ?? 0),
        favorites: favoriteCount,
        ratingAvg: provider.ratingAvg,
        ratingCount: provider.ratingCount
      },
      trend,
      dailyVisits,
      contactEventsByType: contactEventsByType.map((row) => ({ type: row.type, count: row._count._all })),
      topListings: topListings.map((listing) => ({
        id: listing.id,
        name: listing.name,
        type: listing.type,
        viewCount: listing.viewCount,
        soldCount: listing.soldCount
      }))
    };
  }
}
