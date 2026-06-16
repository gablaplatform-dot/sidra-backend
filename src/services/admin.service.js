import { AppError } from "../utils/AppError.js";
import { prisma } from "../config/db.js";
import { PaymentService } from "./payment.service.js";

const decimalToNumber = (value) => Number(value?.toString?.() ?? value ?? 0) || 0;
const moneyString = (value) => (value?.toString ? value.toString() : String(value ?? "0.00"));
const initials = (name) =>
  String(name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "NA";
const titleCase = (value) =>
  String(value ?? "")
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
const objectId = (id, code) => {
  if (!id) {
    throw new AppError({ message: "Invalid id", statusCode: 400, code });
  }
  return id;
};
const adminPermissions = [
  "users",
  "providers",
  "categories",
  "listings",
  "transactions",
  "wallets",
  "subscriptions",
  "reports",
  "settings",
  "adminroles",
  "reviews",
  "inquiries",
  "orders",
  "media"
];

export class AdminService {
  constructor({ hashPassword, paymentService = new PaymentService() }) {
    this.hashPassword = hashPassword;
    this.paymentService = paymentService;
  }

  async dashboard() {
    const [users, providers, pendingProviders, listings, txAgg, walletAgg, subscriptions, reviews, inquiries, orders] = await Promise.all([
      prisma.user.count({ where: { role: "user" } }),
      prisma.provider.count(),
      prisma.provider.count({ where: { moderationStatus: "pending" } }),
      prisma.serviceProduct.count(),
      prisma.transaction.aggregate({
        where: { status: "succeeded" },
        _sum: { amount: true, fee: true },
        _count: { _all: true }
      }),
      prisma.wallet.aggregate({ _sum: { balance: true } }),
      prisma.subscription.count({ where: { status: "active" } }),
      prisma.review.count(),
      prisma.inquiry.count({ where: { status: "new" } }),
      prisma.order.count({ where: { status: "pending" } })
    ]);

    return {
      cards: {
        users,
        providers,
        pendingProviders,
        listings,
        activeSubscriptions: subscriptions,
        transactions: txAgg._count?._all ?? 0,
        revenue: moneyString(txAgg._sum?.amount),
        fees: moneyString(txAgg._sum?.fee),
        walletBalance: moneyString(walletAgg._sum?.balance),
        reviews,
        newInquiries: inquiries,
        pendingOrders: orders
      }
    };
  }

  permissions() {
    return {
      items: adminPermissions.map((id) => ({ id, label: titleCase(id) }))
    };
  }

  async reports({ from, to } = {}) {
    const createdAt = {};
    if (from) createdAt.gte = new Date(from);
    if (to) createdAt.lte = new Date(to);
    const dateFilter = Object.keys(createdAt).length ? { createdAt } : {};
    const [dashboard, transactions, categoryCounts, providerStatuses, listingStatuses, reviewStatuses, inquiryStatuses, orderStatuses] = await Promise.all([
      this.dashboard(),
      prisma.transaction.findMany({ where: dateFilter, orderBy: { createdAt: "asc" }, take: 5000 }),
      prisma.provider.groupBy({ by: ["categoryId"], _count: { _all: true } }),
      prisma.provider.groupBy({ by: ["moderationStatus"], _count: { _all: true } }),
      prisma.serviceProduct.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.review.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.inquiry.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.order.groupBy({ by: ["status"], _count: { _all: true } })
    ]);
    const categories = await prisma.category.findMany({ where: { id: { in: categoryCounts.map((c) => c.categoryId).filter(Boolean) } } });
    const catMap = new Map(categories.map((c) => [c.id, c.name]));
    const daily = new Map();
    for (const tx of transactions) {
      const day = tx.createdAt.toISOString().slice(0, 10);
      const row = daily.get(day) ?? { date: day, transactions: 0, revenue: 0, fees: 0 };
      row.transactions += 1;
      if (tx.status === "succeeded") {
        row.revenue += decimalToNumber(tx.amount);
        row.fees += decimalToNumber(tx.fee);
      }
      daily.set(day, row);
    }
    const normalize = (rows, key) => rows.map((r) => ({ label: r[key] ?? "none", count: r._count._all }));
    return {
      cards: dashboard.cards,
      daily: Array.from(daily.values()).map((r) => ({ ...r, revenue: String(r.revenue), fees: String(r.fees) })),
      topCategories: categoryCounts
        .map((c) => ({ id: c.categoryId, name: catMap.get(c.categoryId) ?? "Uncategorized", providers: c._count._all }))
        .sort((a, b) => b.providers - a.providers)
        .slice(0, 10),
      providerStatuses: normalize(providerStatuses, "moderationStatus"),
      listingStatuses: normalize(listingStatuses, "status"),
      reviewStatuses: normalize(reviewStatuses, "status"),
      inquiryStatuses: normalize(inquiryStatuses, "status"),
      orderStatuses: normalize(orderStatuses, "status")
    };
  }

  async listUsers({ q, role, status, page = 1, limit = 50 }) {
    const filter = {};
    if (role) filter.role = role;
    if (status === "active") filter.isActive = true;
    if (status === "suspended") filter.isActive = false;
    if (q) {
      const term = String(q).trim();
      filter.OR = [
        { name: { contains: term } },
        { email: { contains: term } },
        { phone: { contains: term } }
      ];
    }
    const normalizedLimit = Math.min(200, Math.max(1, Number(limit) || 50));
    const normalizedPage = Math.max(1, Number(page) || 1);
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where: filter,
        orderBy: { createdAt: "desc" },
        skip: (normalizedPage - 1) * normalizedLimit,
        take: normalizedLimit
      }),
      prisma.user.count({ where: filter })
    ]);
    return { items: items.map((u) => this.userDto(u)), total, page: normalizedPage, limit: normalizedLimit };
  }

  async setUserStatus({ userId, isActive }) {
    let user;
    try {
      user = await prisma.user.update({ where: { id: objectId(userId, "INVALID_USER_ID") }, data: { isActive: Boolean(isActive) } });
    } catch (e) {
      if (e?.code === "P2025") throw new AppError({ message: "User not found", statusCode: 404, code: "USER_NOT_FOUND" });
      throw e;
    }
    return this.userDto(user);
  }

  async listProviders({ q, status, categoryId, subscriptionStatus, page = 1, limit = 50 }) {
    const filter = {};
    if (status) filter.moderationStatus = status;
    if (categoryId) filter.categoryId = categoryId;
    if (subscriptionStatus) filter.subscriptionStatus = subscriptionStatus;
    if (q) {
      const term = String(q).trim();
      filter.OR = [
        { businessName: { contains: term } },
        { description: { contains: term } }
      ];
    }
    const normalizedLimit = Math.min(200, Math.max(1, Number(limit) || 50));
    const normalizedPage = Math.max(1, Number(page) || 1);
    const [providers, total] = await Promise.all([
      prisma.provider.findMany({
        where: filter,
        orderBy: { createdAt: "desc" },
        skip: (normalizedPage - 1) * normalizedLimit,
        take: normalizedLimit
      }),
      prisma.provider.count({ where: filter })
    ]);
    const hydrated = await this.hydrateProviders(providers);
    return { items: hydrated, total, page: normalizedPage, limit: normalizedLimit };
  }

  async setProviderStatus({ providerId, status }) {
    if (!["pending", "approved", "rejected", "suspended"].includes(status)) {
      throw new AppError({ message: "Invalid provider status", statusCode: 400, code: "INVALID_PROVIDER_STATUS" });
    }
    let provider;
    try {
      provider = await prisma.provider.update({
        where: { id: objectId(providerId, "INVALID_PROVIDER_ID") },
        data: { moderationStatus: status, isApproved: status === "approved" }
      });
    } catch (e) {
      if (e?.code === "P2025") throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
      throw e;
    }
    return (await this.hydrateProviders([provider]))[0];
  }

  async deleteProvider({ providerId }) {
    if (!providerId) {
      throw new AppError({ message: "Invalid provider id", statusCode: 400, code: "INVALID_PROVIDER_ID" });
    }

    try {
      await prisma.provider.delete({ where: { id: objectId(providerId, "INVALID_PROVIDER_ID") } });
    } catch (e) {
      if (e?.code === "P2025") {
        throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
      }
      throw e;
    }

    return { deleted: true };
  }

  async listCategories() {
    const [categories, providerCounts, listingCounts] = await Promise.all([
      prisma.category.findMany({ orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }] }),
      prisma.provider.groupBy({ by: ["categoryId"], _count: { _all: true } }),
      prisma.$queryRaw`SELECT p.categoryId as categoryId, COUNT(sp.id) as count
        FROM service_products sp
        JOIN providers p ON p.id = sp.providerId
        GROUP BY p.categoryId`
    ]);
    const providerMap = new Map(providerCounts.map((c) => [String(c.categoryId), c._count._all]));
    const listingMap = new Map(listingCounts.map((c) => [String(c.categoryId), Number(c.count ?? 0)]));
    const children = new Map();
    for (const c of categories) {
      if (!c.parentId) continue;
      const pid = String(c.parentId);
      if (!children.has(pid)) children.set(pid, []);
      children.get(pid).push(c);
    }
    const toDto = (c) => ({
      id: c.id,
      name: c.name,
      parentId: c.parentId ? String(c.parentId) : null,
      behavior: c.behavior ?? "general",
      viewType: c.viewType ?? "directory",
      appView: c.appView ?? c.viewType ?? "directory",
      providerFields: c.providerFields ?? [],
      listingFields: c.listingFields ?? [],
      settings: c.settings ?? {},
      providers: providerMap.get(String(c.id)) ?? 0,
      listings: listingMap.get(String(c.id)) ?? 0,
      status: String(c.settings?.status ?? (c.isActive ? "active" : "paused")).toLowerCase(),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      children: (children.get(String(c.id)) ?? []).map(toDto)
    });
    const top = categories.filter((c) => !c.parentId).map(toDto);
    return { items: top, total: categories.length };
  }

  async listListings({ q, type, status, providerId, categoryId, page = 1, limit = 100 }) {
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (providerId) filter.providerId = providerId;
    if (q) filter.name = { contains: String(q).trim() };
    if (categoryId) {
      const providerIds = (await prisma.provider.findMany({ where: { categoryId }, select: { id: true } })).map((p) => p.id);
      filter.providerId = { in: providerIds };
    }
    const normalizedLimit = Math.min(200, Math.max(1, Number(limit) || 100));
    const normalizedPage = Math.max(1, Number(page) || 1);
    const [items, total] = await Promise.all([
      prisma.serviceProduct.findMany({
        where: filter,
        orderBy: { createdAt: "desc" },
        skip: (normalizedPage - 1) * normalizedLimit,
        take: normalizedLimit
      }),
      prisma.serviceProduct.count({ where: filter })
    ]);
    return { items: await this.hydrateListings(items), total, page: normalizedPage, limit: normalizedLimit };
  }

  async updateListing({ listingId, patch }) {
    const update = {};
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.description !== undefined) update.description = patch.description ?? "";
    if (patch.price !== undefined) update.price = patch.price;
    if (patch.type !== undefined) update.type = patch.type;
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.featured !== undefined) update.featured = Boolean(patch.featured);
    if (patch.media !== undefined) update.media = patch.media ?? {};
    if (patch.customFields !== undefined) update.customFields = patch.customFields ?? {};
    let listing;
    try {
      listing = await prisma.serviceProduct.update({ where: { id: objectId(listingId, "INVALID_LISTING_ID") }, data: update });
    } catch (e) {
      if (e?.code === "P2025") throw new AppError({ message: "Listing not found", statusCode: 404, code: "LISTING_NOT_FOUND" });
      throw e;
    }
    return (await this.hydrateListings([listing]))[0];
  }

  async createListing({ providerId, name, description, price = 0, type, status, featured, media, customFields }) {
    const provider = await prisma.provider.findUnique({ where: { id: objectId(providerId, "INVALID_PROVIDER_ID") } });
    if (!provider) throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    const created = await prisma.serviceProduct.create({
      data: {
        providerId,
        name,
        description: description ?? "",
        price,
        type,
        status: status ?? "approved",
        featured: Boolean(featured),
        media: media ?? {},
        customFields: customFields ?? {}
      }
    });
    return (await this.hydrateListings([created]))[0];
  }

  async deleteListing({ listingId }) {
    try {
      await prisma.serviceProduct.delete({ where: { id: objectId(listingId, "INVALID_LISTING_ID") } });
    } catch (e) {
      if (e?.code === "P2025") throw new AppError({ message: "Listing not found", statusCode: 404, code: "LISTING_NOT_FOUND" });
      throw e;
    }
    return { deleted: true };
  }

  async listTransactions(query) {
    const filter = {};
    if (query.type) filter.type = query.type;
    if (query.status) filter.status = query.status;
    if (query.providerId) filter.providerId = query.providerId;
    const take = Math.min(200, Number(query.limit) || 100);
    const [items, total] = await Promise.all([
      prisma.transaction.findMany({ where: filter, orderBy: { createdAt: "desc" }, take }),
      prisma.transaction.count({ where: filter })
    ]);
    return { items: await this.hydrateTransactions(items), total };
  }

  async listWithdrawals() {
    const requests = await prisma.withdrawalRequest.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    const providers = await this.hydrateProviders(
      await prisma.provider.findMany({ where: { id: { in: requests.map((r) => r.providerId) } } })
    );
    const users = await prisma.user.findMany({
      where: { id: { in: requests.flatMap((r) => [r.requestedBy, r.approvedBy, r.rejectedBy, r.paidBy].filter(Boolean)) } }
    });
    const providerMap = new Map(providers.map((p) => [p.id, p]));
    const userMap = new Map(users.map((u) => [u.id, u]));
    return {
      items: requests.map((r) => ({
        id: r.id,
        providerId: r.providerId,
        provider: providerMap.get(String(r.providerId))?.businessName ?? "Unknown provider",
        amount: moneyString(r.amount),
        fee: moneyString(r.fee),
        netAmount: moneyString(r.netAmount),
        status: r.status,
        transactionId: r.transactionId,
        requestedBy: userMap.get(String(r.requestedBy))?.name ?? null,
        approvedBy: r.approvedBy ? userMap.get(String(r.approvedBy))?.name ?? null : null,
        rejectedBy: r.rejectedBy ? userMap.get(String(r.rejectedBy))?.name ?? null : null,
        paidBy: r.paidBy ? userMap.get(String(r.paidBy))?.name ?? null : null,
        note: r.note,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        approvedAt: r.approvedAt,
        rejectedAt: r.rejectedAt,
        paidAt: r.paidAt
      }))
    };
  }

  async approveWithdrawal({ adminUserId, withdrawalRequestId, note }) {
    return this.paymentService.adminApproveWithdrawal({ adminUserId, withdrawalRequestId, note });
  }

  async rejectWithdrawal({ adminUserId, withdrawalRequestId, note }) {
    return this.paymentService.adminRejectWithdrawal({ adminUserId, withdrawalRequestId, note });
  }

  async markWithdrawalPaid({ adminUserId, withdrawalRequestId, note }) {
    return this.paymentService.adminMarkWithdrawalPaid({ adminUserId, withdrawalRequestId, note });
  }

  async listWallets() {
    const providers = await prisma.provider.findMany({ orderBy: { createdAt: "desc" } });
    const providerIds = providers.map((p) => p.id);
    const [wallets, transactions, withdrawals] = await Promise.all([
      prisma.wallet.findMany({ where: { providerId: { in: providerIds } } }),
      prisma.transaction.findMany({ where: { providerId: { in: providerIds } }, orderBy: { createdAt: "desc" }, take: 1000 }),
      prisma.withdrawalRequest.findMany({ where: { providerId: { in: providerIds } }, orderBy: { createdAt: "desc" }, take: 1000 })
    ]);
    const walletMap = new Map(wallets.map((w) => [String(w.providerId), w]));
    const txByProvider = new Map();
    for (const t of transactions) {
      const key = String(t.providerId);
      if (!txByProvider.has(key)) txByProvider.set(key, []);
      txByProvider.get(key).push(t);
    }
    const pendingByProvider = new Map();
    for (const w of withdrawals) {
      if (w.status !== "requested" && w.status !== "approved") continue;
      const key = String(w.providerId);
      pendingByProvider.set(key, (pendingByProvider.get(key) ?? 0) + decimalToNumber(w.amount));
    }
    const hydratedProviders = await this.hydrateProviders(providers);
    return {
      items: hydratedProviders.map((p) => {
        const tx = txByProvider.get(p.id) ?? [];
        return {
          providerId: p.id,
          provider: p.businessName,
          category: p.category?.name ?? null,
          avatar: p.media?.avatarUrl ?? null,
          initials: initials(p.businessName),
          status: p.walletEnabled ? "enabled" : "disabled",
          balance: moneyString(walletMap.get(p.id)?.balance),
          totalEarned: moneyString(tx.filter((t) => t.status === "succeeded" && t.type === "purchase").reduce((sum, t) => sum + decimalToNumber(t.netAmount), 0)),
          totalWithdrawn: moneyString(tx.filter((t) => t.type === "withdrawal").reduce((sum, t) => sum + decimalToNumber(t.amount), 0)),
          pendingWithdrawals: String(pendingByProvider.get(p.id) ?? 0),
          lastActivityAt: tx[0]?.createdAt ?? p.updatedAt,
          transactions: tx.map((t) => this.transactionDto(t))
        };
      })
    };
  }

  async listSubscriptions() {
    const subs = await prisma.subscription.findMany({ orderBy: { expiresAt: "desc" } });
    const providerIds = subs.map((s) => s.providerId);
    const providers = await prisma.provider.findMany({ where: { id: { in: providerIds } } });
    const providerMap = new Map((await this.hydrateProviders(providers)).map((p) => [p.id, p]));
    return {
      items: subs.map((s) => ({
        id: s.id,
        providerId: s.providerId,
        provider: providerMap.get(String(s.providerId))?.businessName ?? "Unknown provider",
        avatar: providerMap.get(String(s.providerId))?.media?.avatarUrl ?? null,
        plan: decimalToNumber(s.amount) >= 99000 ? "pro" : decimalToNumber(s.amount) >= 49000 ? "premium" : "basic",
        amount: moneyString(s.amount),
        expiresAt: s.expiresAt,
        status: s.expiresAt < new Date() ? "expired" : s.status,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt
      }))
    };
  }

  async listReviews({ status, providerId, page = 1, limit = 100 }) {
    const normalizedLimit = Math.min(200, Math.max(1, Number(limit) || 100));
    const normalizedPage = Math.max(1, Number(page) || 1);
    const where = { ...(status ? { status } : {}), ...(providerId ? { providerId } : {}) };
    const [items, total] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (normalizedPage - 1) * normalizedLimit,
        take: normalizedLimit
      }),
      prisma.review.count({ where })
    ]);
    const providers = await this.hydrateProviders(await prisma.provider.findMany({ where: { id: { in: items.map((i) => i.providerId) } } }));
    const users = await prisma.user.findMany({ where: { id: { in: items.map((i) => i.userId) } } });
    const providerMap = new Map(providers.map((p) => [p.id, p]));
    const userMap = new Map(users.map((u) => [u.id, u]));
    return {
      items: items.map((r) => ({
        id: r.id,
        providerId: r.providerId,
        provider: providerMap.get(r.providerId)?.businessName ?? "Unknown provider",
        userId: r.userId,
        user: userMap.get(r.userId)?.name ?? "Unknown user",
        rating: r.rating,
        comment: r.comment,
        status: r.status,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt
      })),
      total,
      page: normalizedPage,
      limit: normalizedLimit
    };
  }

  async updateReview({ reviewId, status }) {
    const review = await prisma.review.update({ where: { id: objectId(reviewId, "INVALID_REVIEW_ID") }, data: { status } });
    await this.recomputeProviderRating(review.providerId);
    return review;
  }

  async listInquiries({ status, providerId, page = 1, limit = 100 }) {
    const normalizedLimit = Math.min(200, Math.max(1, Number(limit) || 100));
    const normalizedPage = Math.max(1, Number(page) || 1);
    const where = { ...(status ? { status } : {}), ...(providerId ? { providerId } : {}) };
    const [items, total] = await Promise.all([
      prisma.inquiry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (normalizedPage - 1) * normalizedLimit,
        take: normalizedLimit
      }),
      prisma.inquiry.count({ where })
    ]);
    const providers = await this.hydrateProviders(await prisma.provider.findMany({ where: { id: { in: items.map((i) => i.providerId) } } }));
    const providerMap = new Map(providers.map((p) => [p.id, p]));
    return {
      items: items.map((i) => ({
        id: i.id,
        providerId: i.providerId,
        provider: providerMap.get(i.providerId)?.businessName ?? "Unknown provider",
        listingId: i.listingId,
        type: i.type,
        status: i.status,
        name: i.name,
        email: i.email,
        phone: i.phone,
        message: i.message,
        metadata: i.metadata ?? {},
        createdAt: i.createdAt,
        updatedAt: i.updatedAt
      })),
      total,
      page: normalizedPage,
      limit: normalizedLimit
    };
  }

  async updateInquiry({ inquiryId, status }) {
    return prisma.inquiry.update({ where: { id: objectId(inquiryId, "INVALID_INQUIRY_ID") }, data: { status } });
  }

  async listOrders({ status, providerId, page = 1, limit = 100 }) {
    const normalizedLimit = Math.min(200, Math.max(1, Number(limit) || 100));
    const normalizedPage = Math.max(1, Number(page) || 1);
    const where = { ...(status ? { status } : {}), ...(providerId ? { providerId } : {}) };
    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (normalizedPage - 1) * normalizedLimit,
        take: normalizedLimit,
        include: { items: true }
      }),
      prisma.order.count({ where })
    ]);
    const providers = await this.hydrateProviders(await prisma.provider.findMany({ where: { id: { in: items.map((i) => i.providerId) } } }));
    const users = await prisma.user.findMany({ where: { id: { in: items.map((i) => i.userId).filter(Boolean) } } });
    const providerMap = new Map(providers.map((p) => [p.id, p]));
    const userMap = new Map(users.map((u) => [u.id, u]));
    return {
      items: items.map((o) => ({
        id: o.id,
        providerId: o.providerId,
        provider: providerMap.get(o.providerId)?.businessName ?? "Unknown provider",
        userId: o.userId,
        user: o.userId ? userMap.get(o.userId)?.name ?? "Unknown user" : null,
        status: o.status,
        subtotal: moneyString(o.subtotal),
        fee: moneyString(o.fee),
        total: moneyString(o.total),
        customer: o.customer ?? {},
        fulfillment: o.fulfillment ?? {},
        itemCount: o.items.reduce((sum, item) => sum + item.quantity, 0),
        items: o.items,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt
      })),
      total,
      page: normalizedPage,
      limit: normalizedLimit
    };
  }

  async updateOrder({ orderId, status }) {
    return prisma.order.update({ where: { id: objectId(orderId, "INVALID_ORDER_ID") }, data: { status } });
  }

  async listMedia({ providerId, kind, page = 1, limit = 100 }) {
    const normalizedLimit = Math.min(200, Math.max(1, Number(limit) || 100));
    const normalizedPage = Math.max(1, Number(page) || 1);
    const where = { ...(providerId ? { providerId } : {}), ...(kind ? { kind } : {}) };
    const [items, total] = await Promise.all([
      prisma.mediaAsset.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (normalizedPage - 1) * normalizedLimit,
        take: normalizedLimit
      }),
      prisma.mediaAsset.count({ where })
    ]);
    const providers = await this.hydrateProviders(await prisma.provider.findMany({ where: { id: { in: items.map((i) => i.providerId).filter(Boolean) } } }));
    const providerMap = new Map(providers.map((p) => [p.id, p]));
    return {
      items: items.map((m) => ({
        id: m.id,
        providerId: m.providerId,
        provider: m.providerId ? providerMap.get(m.providerId)?.businessName ?? "Unknown provider" : null,
        ownerId: m.ownerId,
        key: m.key,
        url: m.url,
        mimeType: m.mimeType,
        size: m.size,
        kind: m.kind,
        metadata: m.metadata ?? {},
        createdAt: m.createdAt
      })),
      total,
      page: normalizedPage,
      limit: normalizedLimit
    };
  }

  async deleteMedia({ mediaId }) {
    await prisma.mediaAsset.delete({ where: { id: objectId(mediaId, "INVALID_MEDIA_ID") } });
    return { deleted: true };
  }

  async listAdmins() {
    const users = await prisma.user.findMany({ where: { role: "admin" }, orderBy: { createdAt: "desc" } });
    return { items: users.map((u) => this.adminDto(u)) };
  }

  async createAdmin({ name, email, phone, password, permissions = [] }) {
    const existing = await prisma.user.findFirst({ where: { email: String(email).trim().toLowerCase() }, select: { id: true } });
    if (existing) throw new AppError({ message: "Email already in use", statusCode: 409, code: "EMAIL_IN_USE" });
    const created = await prisma.user.create({
      data: {
        name,
        email: String(email).trim().toLowerCase(),
        phone: phone ?? null,
        passwordHash: await this.hashPassword(password),
        role: "admin",
        isActive: true,
        adminPermissions: Array.isArray(permissions) ? permissions : []
      }
    });
    return this.adminDto(created);
  }

  async updateAdmin({ adminId, patch }) {
    const update = {};
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.phone !== undefined) update.phone = patch.phone ?? null;
    if (patch.isActive !== undefined) update.isActive = Boolean(patch.isActive);
    if (patch.permissions !== undefined) update.adminPermissions = Array.isArray(patch.permissions) ? patch.permissions : [];
    const user = await prisma.user.findFirst({ where: { id: objectId(adminId, "INVALID_ADMIN_ID"), role: "admin" } });
    if (!user) throw new AppError({ message: "Admin not found", statusCode: 404, code: "ADMIN_NOT_FOUND" });
    const updated = await prisma.user.update({ where: { id: user.id }, data: update });
    return this.adminDto(updated);
  }

  userDto(u) {
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      status: u.isActive === false ? "suspended" : "active",
      isActive: u.isActive !== false,
      initials: initials(u.name),
      createdAt: u.createdAt,
      updatedAt: u.updatedAt
    };
  }

  adminDto(u) {
    return { ...this.userDto(u), permissions: Array.isArray(u.adminPermissions) ? u.adminPermissions : [] };
  }

  async hydrateProviders(providers) {
    const userIds = providers.map((p) => p.userId).filter(Boolean);
    const categoryIds = providers.map((p) => p.categoryId).filter(Boolean);
    const providerIds = providers.map((p) => p.id);
    const [users, categories, wallets, listingCounts] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: userIds } } }),
      prisma.category.findMany({ where: { id: { in: categoryIds } } }),
      prisma.wallet.findMany({ where: { providerId: { in: providerIds } } }),
      prisma.serviceProduct.groupBy({ by: ["providerId"], where: { providerId: { in: providerIds } }, _count: { _all: true } })
    ]);
    const userMap = new Map(users.map((u) => [u.id, u]));
    const catMap = new Map(categories.map((c) => [c.id, c]));
    const walletMap = new Map(wallets.map((w) => [String(w.providerId), w]));
    const countMap = new Map(listingCounts.map((c) => [String(c.providerId), c._count._all]));
    return providers.map((p) => {
      const user = userMap.get(String(p.userId));
      const category = p.categoryId ? catMap.get(String(p.categoryId)) : null;
      return {
        id: p.id,
        userId: p.userId,
        businessName: p.businessName,
        publicSlug: p.publicSlug,
        description: p.description,
        categoryId: p.categoryId ?? null,
        category: category ? { id: category.id, name: category.name, behavior: category.behavior } : null,
        contact: { ...(p.contact ?? {}), email: p.contact?.email ?? user?.email ?? null, phone: p.contact?.phone ?? user?.phone ?? null },
        owner: user ? this.userDto(user) : null,
        location: p.location,
        media: p.media ?? {},
        customFields: p.customFields ?? {},
        isApproved: Boolean(p.isApproved),
        moderationStatus: p.moderationStatus ?? (p.isApproved ? "approved" : "pending"),
        onboardingStatus: p.onboardingStatus ?? "draft",
        invitationSentAt: p.invitationSentAt,
        invitationAcceptedAt: p.invitationAcceptedAt,
        registeredAt: p.registeredAt,
        ratingAvg: p.ratingAvg ?? 0,
        ratingCount: p.ratingCount ?? 0,
        profileViews: p.profileViews ?? 0,
        contactClicks: p.contactClicks ?? 0,
        subscriptionStatus: p.subscriptionStatus,
        walletEnabled: Boolean(p.walletEnabled),
        walletBalance: moneyString(walletMap.get(String(p.id))?.balance),
        listingCount: countMap.get(String(p.id)) ?? 0,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      };
    });
  }

  async hydrateListings(items) {
    const providers = await this.hydrateProviders(
      await prisma.provider.findMany({ where: { id: { in: items.map((i) => i.providerId) } } })
    );
    const providerMap = new Map(providers.map((p) => [p.id, p]));
    return items.map((i) => {
      const provider = providerMap.get(String(i.providerId));
      return {
        id: i.id,
        providerId: i.providerId,
        provider: provider ? { id: provider.id, businessName: provider.businessName, category: provider.category } : null,
        name: i.name,
        description: i.description,
        price: moneyString(i.price),
        type: i.type,
        typeLabel: titleCase(i.type),
        status: i.status ?? "pending",
        featured: Boolean(i.featured),
        media: i.media ?? {},
        customFields: i.customFields ?? {},
        createdAt: i.createdAt,
        updatedAt: i.updatedAt
      };
    });
  }

  async hydrateTransactions(items) {
    const providers = await this.hydrateProviders(
      await prisma.provider.findMany({ where: { id: { in: items.map((i) => i.providerId).filter(Boolean) } } })
    );
    const users = await prisma.user.findMany({ where: { id: { in: items.map((i) => i.userId).filter(Boolean) } } });
    const providerMap = new Map(providers.map((p) => [p.id, p]));
    const userMap = new Map(users.map((u) => [u.id, u]));
    return items.map((t) => this.transactionDto(t, providerMap.get(String(t.providerId)), userMap.get(String(t.userId))));
  }

  transactionDto(t, provider, user) {
    return {
      id: t.id,
      type: t.type,
      kind: titleCase(t.type),
      status: t.status,
      userId: t.userId ?? null,
      providerId: t.providerId ?? null,
      provider: provider ? { id: provider.id, name: provider.businessName } : null,
      user: user ? { id: user.id, name: user.name, email: user.email } : null,
      amount: moneyString(t.amount),
      fee: moneyString(t.fee),
      netAmount: moneyString(t.netAmount),
      metadata: t.metadata ?? {},
      createdAt: t.createdAt,
      updatedAt: t.updatedAt
    };
  }

  async recomputeProviderRating(providerId) {
    const agg = await prisma.review.aggregate({
      where: { providerId, status: "approved" },
      _avg: { rating: true },
      _count: { _all: true }
    });
    await prisma.provider.update({
      where: { id: providerId },
      data: {
        ratingAvg: agg._avg.rating ?? 0,
        ratingCount: agg._count._all ?? 0
      }
    });
  }
}
