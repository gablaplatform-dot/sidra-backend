import { AppError } from "../utils/AppError.js";
import { prisma } from "../config/db.js";
import { PromotionType } from "../constants/enums.js";

export class PromotionService {
  _toDto(p) {
    const now = Date.now();
    const endsAtMs = p.endsAt ? new Date(p.endsAt).getTime() : now;
    const startsAtMs = p.startsAt ? new Date(p.startsAt).getTime() : now;
    const remainingSecs = endsAtMs > now ? Math.max(0, Math.floor((endsAtMs - now) / 1000)) : 0;
    const startsInSecs = startsAtMs > now ? Math.max(0, Math.floor((startsAtMs - now) / 1000)) : 0;
    const isActiveNow = Boolean(p.isActive) && startsInSecs === 0 && remainingSecs > 0;
    return {
      id: p.id,
      title: p.title,
      subtitle: p.subtitle ?? null,
      type: p.type ?? PromotionType.BANNER,
      startsAt: p.startsAt,
      endsAt: p.endsAt,
      remainingSecs,
      startsInSecs,
      isActiveNow,
      discountPercent: p.discountPercent ?? null,
      imageUrl: p.imageUrl ?? null,
      ctaLabel: p.ctaLabel ?? null,
      ctaHref: p.ctaHref ?? null,
      listingIds: Array.isArray(p.listingIds) ? p.listingIds : [],
      categoryId: p.categoryId ?? null,
      providerId: p.providerId ?? null,
      isFeatured: Boolean(p.isFeatured),
      sortOrder: Number(p.sortOrder ?? 0),
      isActive: Boolean(p.isActive),
      metadata: p.metadata ?? {},
      createdAt: p.createdAt,
      updatedAt: p.updatedAt
    };
  }

  async listAdmin({ page = 1, limit = 50, isActive, type } = {}) {
    const normalizedPage = Math.max(1, Number(page) || 1);
    const normalizedLimit = Math.min(100, Math.max(1, Number(limit) || 50));
    const skip = (normalizedPage - 1) * normalizedLimit;
    const where = {};
    if (isActive !== undefined) where.isActive = Boolean(isActive);
    if (type) where.type = String(type);

    const [rows, total] = await Promise.all([
      prisma.promotion.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        skip,
        take: normalizedLimit
      }),
      prisma.promotion.count({ where })
    ]);
    return {
      items: rows.map((r) => this._toDto(r)),
      page: normalizedPage,
      limit: normalizedLimit,
      total
    };
  }

  async listFeatured({ limit = 4, type } = {}) {
    const normalizedLimit = Math.min(60, Math.max(1, Number(limit) || 4));
    const now = new Date();
    const where = {
      isActive: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }]
    };
    if (type) where.type = String(type);

    const rows = await prisma.promotion.findMany({
      where,
      orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
      take: normalizedLimit
    });
    return {
      items: rows.map((r) => this._toDto(r)),
      total: rows.length
    };
  }

  async getById({ id }) {
    if (!id) throw new AppError({ message: "Invalid id", statusCode: 400, code: "INVALID_PROMOTION_ID" });
    const row = await prisma.promotion.findUnique({ where: { id } });
    if (!row) throw new AppError({ message: "Promotion not found", statusCode: 404, code: "PROMOTION_NOT_FOUND" });
    return this._toDto(row);
  }

  _validateDates({ startsAt, endsAt }) {
    const start = startsAt ? new Date(startsAt) : null;
    const end = endsAt ? new Date(endsAt) : null;
    if (start && isNaN(start.getTime())) {
      throw new AppError({ message: "Invalid startsAt", statusCode: 400, code: "INVALID_START_DATE" });
    }
    if (end && isNaN(end.getTime())) {
      throw new AppError({ message: "Invalid endsAt", statusCode: 400, code: "INVALID_END_DATE" });
    }
    if (start && end && end.getTime() <= start.getTime()) {
      throw new AppError({ message: "endsAt must be after startsAt", statusCode: 400, code: "INVALID_DATE_RANGE" });
    }
  }

  async create({ title, subtitle, type, startsAt, endsAt, discountPercent, imageUrl, ctaLabel, ctaHref, listingIds, categoryId, providerId, isFeatured, sortOrder, isActive, metadata }) {
    if (!title || !String(title).trim()) {
      throw new AppError({ message: "title is required", statusCode: 400, code: "TITLE_REQUIRED" });
    }
    const normalizedType = String(type ?? PromotionType.BANNER);
    if (!Object.values(PromotionType).includes(normalizedType)) {
      throw new AppError({ message: "Invalid promotion type", statusCode: 400, code: "INVALID_PROMOTION_TYPE" });
    }
    this._validateDates({ startsAt, endsAt });
    if (discountPercent !== undefined && discountPercent !== null) {
      const dp = Number(discountPercent);
      if (!Number.isInteger(dp) || dp < 1 || dp > 100) {
        throw new AppError({ message: "discountPercent must be 1..100", statusCode: 400, code: "INVALID_DISCOUNT_PERCENT" });
      }
    }

    const data = {
      title: String(title).trim(),
      subtitle: subtitle ? String(subtitle).trim() : null,
      type: normalizedType,
      startsAt: startsAt ? new Date(startsAt) : null,
      endsAt: endsAt ? new Date(endsAt) : null,
      discountPercent: discountPercent !== undefined && discountPercent !== null ? Number(discountPercent) : null,
      imageUrl: imageUrl ? String(imageUrl) : null,
      ctaLabel: ctaLabel ? String(ctaLabel).trim() : null,
      ctaHref: ctaHref ? String(ctaHref).trim() : null,
      listingIds: Array.isArray(listingIds) ? listingIds : [],
      categoryId: categoryId || null,
      providerId: providerId || null,
      isFeatured: Boolean(isFeatured),
      sortOrder: Number(sortOrder ?? 0),
      isActive: isActive === undefined ? true : Boolean(isActive),
      metadata: metadata && typeof metadata === "object" ? metadata : {}
    };

    const created = await prisma.promotion.create({ data });
    return this._toDto(created);
  }

  async update({ id, updates }) {
    if (!id) throw new AppError({ message: "Invalid id", statusCode: 400, code: "INVALID_PROMOTION_ID" });
    const existing = await prisma.promotion.findUnique({ where: { id } });
    if (!existing) throw new AppError({ message: "Promotion not found", statusCode: 404, code: "PROMOTION_NOT_FOUND" });

    const data = {};
    if (updates.title !== undefined) data.title = String(updates.title).trim();
    if (updates.subtitle !== undefined) data.subtitle = updates.subtitle ? String(updates.subtitle).trim() : null;
    if (updates.type !== undefined) {
      if (!Object.values(PromotionType).includes(String(updates.type))) {
        throw new AppError({ message: "Invalid promotion type", statusCode: 400, code: "INVALID_PROMOTION_TYPE" });
      }
      data.type = String(updates.type);
    }
    if (updates.startsAt !== undefined) data.startsAt = updates.startsAt ? new Date(updates.startsAt) : null;
    if (updates.endsAt !== undefined) data.endsAt = updates.endsAt ? new Date(updates.endsAt) : null;
    if (updates.discountPercent !== undefined) {
      if (updates.discountPercent === null) {
        data.discountPercent = null;
      } else {
        const dp = Number(updates.discountPercent);
        if (!Number.isInteger(dp) || dp < 1 || dp > 100) {
          throw new AppError({ message: "discountPercent must be 1..100", statusCode: 400, code: "INVALID_DISCOUNT_PERCENT" });
        }
        data.discountPercent = dp;
      }
    }
    if (updates.imageUrl !== undefined) data.imageUrl = updates.imageUrl ? String(updates.imageUrl) : null;
    if (updates.ctaLabel !== undefined) data.ctaLabel = updates.ctaLabel ? String(updates.ctaLabel).trim() : null;
    if (updates.ctaHref !== undefined) data.ctaHref = updates.ctaHref ? String(updates.ctaHref).trim() : null;
    if (updates.listingIds !== undefined) data.listingIds = Array.isArray(updates.listingIds) ? updates.listingIds : [];
    if (updates.categoryId !== undefined) data.categoryId = updates.categoryId || null;
    if (updates.providerId !== undefined) data.providerId = updates.providerId || null;
    if (updates.isFeatured !== undefined) data.isFeatured = Boolean(updates.isFeatured);
    if (updates.sortOrder !== undefined) data.sortOrder = Number(updates.sortOrder ?? 0);
    if (updates.isActive !== undefined) data.isActive = Boolean(updates.isActive);
    if (updates.metadata !== undefined) data.metadata = updates.metadata && typeof updates.metadata === "object" ? updates.metadata : {};

    const candidateStarts = data.startsAt ?? existing.startsAt;
    const candidateEnds = data.endsAt ?? existing.endsAt;
    this._validateDates({ startsAt: candidateStarts, endsAt: candidateEnds });

    const updated = await prisma.promotion.update({ where: { id }, data });
    return this._toDto(updated);
  }

  async remove({ id }) {
    if (!id) throw new AppError({ message: "Invalid id", statusCode: 400, code: "INVALID_PROMOTION_ID" });
    const existing = await prisma.promotion.findUnique({ where: { id } });
    if (!existing) throw new AppError({ message: "Promotion not found", statusCode: 404, code: "PROMOTION_NOT_FOUND" });
    await prisma.promotion.delete({ where: { id } });
    return { deleted: true };
  }
}
