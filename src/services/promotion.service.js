import { AppError } from "../utils/AppError.js";
import { prisma } from "../config/db.js";
import { PromotionType } from "../constants/enums.js";
import { findNearbyProviderIds } from "./geoProviderSearch.js";

const RADIUS_WIDEN_MULTIPLIER = 3;
const NATIONWIDE_RADIUS_KM = 900; // covers all of Uganda (~800km across) while still ranking by distance
const GEOHASH_SAFE_RADIUS_KM = 20; // beyond this a geohash-cell lookup would miss real matches

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
      videoUrl: p.videoUrl ?? null,
      ctaLabel: p.ctaLabel ?? null,
      ctaHref: p.ctaHref ?? null,
      listingIds: Array.isArray(p.listingIds) ? p.listingIds : [],
      categoryId: p.categoryId ?? null,
      providerId: p.providerId ?? null,
      isFeatured: Boolean(p.isFeatured),
      sortOrder: Number(p.sortOrder ?? 0),
      isActive: Boolean(p.isActive),
      moderationStatus: p.moderationStatus ?? "approved",
      metadata: p.metadata ?? {},
      createdAt: p.createdAt,
      updatedAt: p.updatedAt
    };
  }

  // Same distance-first-then-nationwide-fallback shape as a promotion DTO, plus how far this ad's
  // provider is from the shopper - a hero carousel wants that for "near you" copy; nationwide-tier
  // results simply omit it (there is no meaningful "distance" once geo has given up).
  _toAdDto(p, distanceKm) {
    return { ...this._toDto(p), distanceKm: Number.isFinite(distanceKm) ? distanceKm : null };
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

  // A provider ad is live immediately - only flagged "pending" for later admin review, exactly
  // like a provider-submitted ProductCategory subcategory - so this deliberately does NOT filter
  // on moderationStatus, only isActive + the active-date-window.
  _adWindowWhere() {
    const now = new Date();
    return {
      type: PromotionType.PROVIDER_AD,
      isActive: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }]
    };
  }

  async _providerAdsByIds(providerIds) {
    if (!providerIds.length) return [];
    return prisma.promotion.findMany({
      where: { ...this._adWindowWhere(), providerId: { in: providerIds } },
      orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }]
    });
  }

  // Nearest-provider-first ad selection for the Shop hero carousel - mirrors
  // listing.service.js#publicList's exact three-tier ladder (requested radius -> x3 -> nationwide)
  // via the same shared findNearbyProviderIds, and the district exact-then-nationwide path,
  // so ad placement degrades exactly the way product search already does.
  async listNearbyAds({ lat, lng, radiusKm, district, limit = 8 } = {}) {
    const normalizedLimit = Math.min(30, Math.max(1, Number(limit) || 8));
    const hasGeo = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Number.isFinite(Number(radiusKm));

    if (hasGeo) {
      const requestedRadiusKm = Number(radiusKm);
      const tierRadii = [requestedRadiusKm, requestedRadiusKm * RADIUS_WIDEN_MULTIPLIER, NATIONWIDE_RADIUS_KM];

      for (let i = 0; i < tierRadii.length; i += 1) {
        const tierRadiusKm = tierRadii[i];
        const { orderedIds, distanceById } = await findNearbyProviderIds({
          lat: Number(lat),
          lng: Number(lng),
          radiusKm: tierRadiusKm,
          useGeohash: tierRadiusKm <= GEOHASH_SAFE_RADIUS_KM
        });
        if (!orderedIds.length) {
          if (i === tierRadii.length - 1) return { items: [], total: 0 };
          continue;
        }

        const ads = await this._providerAdsByIds(orderedIds);
        if (!ads.length) {
          if (i === tierRadii.length - 1) return { items: [], total: 0 };
          continue;
        }

        const ranked = ads
          .map((ad) => ({ ad, distanceKm: distanceById.get(ad.providerId) }))
          .sort((a, b) => a.distanceKm - b.distanceKm)
          .slice(0, normalizedLimit);
        return {
          items: ranked.map(({ ad, distanceKm }) => this._toAdDto(ad, distanceKm)),
          total: ranked.length
        };
      }
      return { items: [], total: 0 };
    }

    if (district) {
      const nearby = await prisma.promotion.findMany({
        where: { ...this._adWindowWhere(), provider: { district: String(district) } },
        orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
        take: normalizedLimit
      });
      if (nearby.length) {
        return { items: nearby.map((ad) => this._toAdDto(ad)), total: nearby.length };
      }
    }

    const nationwide = await prisma.promotion.findMany({
      where: this._adWindowWhere(),
      orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
      take: normalizedLimit
    });
    return { items: nationwide.map((ad) => this._toAdDto(ad)), total: nationwide.length };
  }

  async getProviderForUser(userId) {
    const provider = await prisma.provider.findUnique({ where: { userId } });
    if (!provider) {
      throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    }
    return provider;
  }

  async listMine({ actorUserId }) {
    const provider = await this.getProviderForUser(actorUserId);
    const rows = await prisma.promotion.findMany({
      where: { providerId: provider.id, type: PromotionType.PROVIDER_AD },
      orderBy: [{ createdAt: "desc" }]
    });
    return { items: rows.map((r) => this._toDto(r)), total: rows.length };
  }

  _validateAdMedia({ imageUrl, videoUrl }) {
    if (!imageUrl && !videoUrl) {
      throw new AppError({ message: "An image or video is required", statusCode: 400, code: "AD_MEDIA_REQUIRED" });
    }
  }

  // Providers may only ever create/touch their own provider_ad rows - never any other Promotion
  // type, and never someone else's - mirrors ProductCategoryService#createFromProvider.
  async createFromProvider({ actorUserId, title, subtitle, imageUrl, videoUrl, ctaLabel, ctaHref, startsAt, endsAt }) {
    if (!title || !String(title).trim()) {
      throw new AppError({ message: "title is required", statusCode: 400, code: "TITLE_REQUIRED" });
    }
    this._validateAdMedia({ imageUrl, videoUrl });
    this._validateDates({ startsAt, endsAt });
    const provider = await this.getProviderForUser(actorUserId);

    const created = await prisma.promotion.create({
      data: {
        title: String(title).trim(),
        subtitle: subtitle ? String(subtitle).trim() : null,
        type: PromotionType.PROVIDER_AD,
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
        imageUrl: imageUrl ? String(imageUrl) : null,
        videoUrl: videoUrl ? String(videoUrl) : null,
        ctaLabel: ctaLabel ? String(ctaLabel).trim() : null,
        ctaHref: ctaHref ? String(ctaHref).trim() : null,
        providerId: provider.id,
        isActive: true,
        moderationStatus: "pending"
      }
    });
    return this._toDto(created);
  }

  async _getOwnAd({ actorUserId, id }) {
    if (!id) throw new AppError({ message: "Invalid id", statusCode: 400, code: "INVALID_PROMOTION_ID" });
    const provider = await this.getProviderForUser(actorUserId);
    const existing = await prisma.promotion.findUnique({ where: { id } });
    if (!existing || existing.type !== PromotionType.PROVIDER_AD || existing.providerId !== provider.id) {
      throw new AppError({ message: "Ad not found", statusCode: 404, code: "PROMOTION_NOT_FOUND" });
    }
    return existing;
  }

  async updateMine({ actorUserId, id, updates }) {
    const existing = await this._getOwnAd({ actorUserId, id });

    const data = {};
    if (updates.title !== undefined) data.title = String(updates.title).trim();
    if (updates.subtitle !== undefined) data.subtitle = updates.subtitle ? String(updates.subtitle).trim() : null;
    if (updates.imageUrl !== undefined) data.imageUrl = updates.imageUrl ? String(updates.imageUrl) : null;
    if (updates.videoUrl !== undefined) data.videoUrl = updates.videoUrl ? String(updates.videoUrl) : null;
    if (updates.ctaLabel !== undefined) data.ctaLabel = updates.ctaLabel ? String(updates.ctaLabel).trim() : null;
    if (updates.ctaHref !== undefined) data.ctaHref = updates.ctaHref ? String(updates.ctaHref).trim() : null;
    if (updates.startsAt !== undefined) data.startsAt = updates.startsAt ? new Date(updates.startsAt) : null;
    if (updates.endsAt !== undefined) data.endsAt = updates.endsAt ? new Date(updates.endsAt) : null;
    if (updates.isActive !== undefined) data.isActive = Boolean(updates.isActive);

    const candidateImage = data.imageUrl !== undefined ? data.imageUrl : existing.imageUrl;
    const candidateVideo = data.videoUrl !== undefined ? data.videoUrl : existing.videoUrl;
    this._validateAdMedia({ imageUrl: candidateImage, videoUrl: candidateVideo });

    const candidateStarts = data.startsAt ?? existing.startsAt;
    const candidateEnds = data.endsAt ?? existing.endsAt;
    this._validateDates({ startsAt: candidateStarts, endsAt: candidateEnds });

    // An edit re-flags it for review - it's still live in the meantime, same as creation.
    data.moderationStatus = "pending";

    const updated = await prisma.promotion.update({ where: { id }, data });
    return this._toDto(updated);
  }

  async deleteMine({ actorUserId, id }) {
    await this._getOwnAd({ actorUserId, id });
    await prisma.promotion.delete({ where: { id } });
    return { deleted: true };
  }
}
