import { Prisma } from "@prisma/client";

import { prisma } from "../config/db.js";
import { AppError } from "../utils/AppError.js";

const moneyString = (value) => (value?.toString ? value.toString() : String(value ?? "0.00"));
const toDecimal = (value) => new Prisma.Decimal(String(value ?? "0"));

export class EngagementService {
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
          location: item.provider.location ?? {},
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

  async createOrder({ actorUserId, providerId, items, customer, fulfillment, metadata }) {
    if (!Array.isArray(items) || !items.length) {
      throw new AppError({ message: "Order items are required", statusCode: 400, code: "ORDER_ITEMS_REQUIRED" });
    }

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
      const quantity = Math.max(1, Math.min(99, Number(item.quantity) || 1));
      const unitPrice = toDecimal(item.unitPrice ?? listing?.price ?? 0);
      const total = unitPrice.mul(quantity);
      return {
        listingId: listing?.id ?? null,
        name: item.name ?? listing?.name ?? "Item",
        quantity,
        unitPrice,
        total,
        metadata: item.metadata ?? {}
      };
    });

    const subtotal = normalizedItems.reduce((sum, item) => sum.add(item.total), new Prisma.Decimal("0"));

    const order = await prisma.order.create({
      data: {
        userId: actorUserId,
        providerId,
        subtotal,
        total: subtotal,
        customer: customer ?? {},
        fulfillment: fulfillment ?? {},
        metadata: metadata ?? {},
        items: { create: normalizedItems }
      },
      include: { items: true }
    });

    return {
      id: order.id,
      providerId: order.providerId,
      status: order.status,
      subtotal: moneyString(order.subtotal),
      total: moneyString(order.total),
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

  async listProviderOrders({ actorUserId, status, page = 1, limit = 50 }) {
    const provider = await prisma.provider.findUnique({ where: { userId: actorUserId } });
    if (!provider) throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });

    const normalizedPage = Math.max(1, Number(page) || 1);
    const normalizedLimit = Math.min(100, Math.max(1, Number(limit) || 50));
    const where = { providerId: provider.id, ...(status ? { status } : {}) };
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

    return {
      items: items.map((order) => ({
        id: order.id,
        status: order.status,
        subtotal: moneyString(order.subtotal),
        fee: moneyString(order.fee),
        total: moneyString(order.total),
        customer: order.customer,
        fulfillment: order.fulfillment,
        items: order.items,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      })),
      page: normalizedPage,
      limit: normalizedLimit,
      total
    };
  }

  async updateProviderOrder({ actorUserId, orderId, status }) {
    const provider = await prisma.provider.findUnique({ where: { userId: actorUserId } });
    if (!provider) throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });

    const order = await prisma.order.findFirst({ where: { id: orderId, providerId: provider.id } });
    if (!order) throw new AppError({ message: "Order not found", statusCode: 404, code: "ORDER_NOT_FOUND" });

    return prisma.order.update({ where: { id: order.id }, data: { status } });
  }
}
