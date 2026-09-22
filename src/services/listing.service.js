import { AppError } from "../utils/AppError.js";
import { prisma } from "../config/db.js";
import { geohashSearchCells, haversineDistanceKm } from "../utils/geohash.js";

const GEOHASH_PRECISION_FINE = 6; // ~1.2km x 0.6km cells - used for tight radii
const GEOHASH_PRECISION_COARSE = 5; // ~4.9km x 4.9km cells - used for wider radii

export class ListingService {
  async getProviderForUser(userId) {
    const provider = await prisma.provider.findUnique({ where: { userId } });
    if (!provider) {
      throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    }
    return provider;
  }

  // A listing's shop category is the provider's own (ShopCategory), never another provider's -
  // callers only ever pass an id they claim to own, so this is the one place that actually checks.
  async assertShopCategoryOwnership({ shopCategoryId, providerId }) {
    if (!shopCategoryId) return;
    const category = await prisma.shopCategory.findUnique({ where: { id: shopCategoryId } });
    if (!category || category.providerId !== providerId) {
      throw new AppError({ message: "Shop category not found", statusCode: 404, code: "SHOP_CATEGORY_NOT_FOUND" });
    }
  }

  // A product must be placed in the dedicated shop/product category tree (ProductCategory, not
  // the directory Category), and specifically at a leaf of it - if the chosen category has
  // subcategories, the provider has to drill into one of them (or add one via
  // /product-categories/mine) rather than leave the product sitting one level too high. Services
  // keep using the general directory category (optional, inherited from the provider), unaffected
  // by this rule.
  async assertProductCategory(productCategoryId) {
    if (!productCategoryId) {
      throw new AppError({ message: "Choose a category for this product", statusCode: 400, code: "CATEGORY_REQUIRED" });
    }
    const category = await prisma.productCategory.findUnique({ where: { id: productCategoryId } });
    if (!category) {
      throw new AppError({ message: "Category not found", statusCode: 404, code: "CATEGORY_NOT_FOUND" });
    }
    const childCount = await prisma.productCategory.count({ where: { parentId: productCategoryId } });
    if (childCount > 0) {
      throw new AppError({ message: "Choose a more specific subcategory", statusCode: 400, code: "CATEGORY_NOT_LEAF" });
    }
  }

  async createListing({ actorUserId, name, description, price = 0, type, categoryId, productCategoryId, shopCategoryId, media, customFields, featured, onlinePaymentEnabled, originalPrice, discountPercent, isNew, sku, inventory }) {
    const provider = await this.getProviderForUser(actorUserId);

    const normalizedType = String(type ?? "").toLowerCase();
    if (!["service", "product"].includes(normalizedType)) {
      throw new AppError({ message: "Invalid type", statusCode: 400, code: "INVALID_TYPE" });
    }
    await this.assertShopCategoryOwnership({ shopCategoryId, providerId: provider.id });
    if (normalizedType === "product") {
      await this.assertProductCategory(productCategoryId);
    }

    if (discountPercent !== undefined && discountPercent !== null) {
      const dp = Number(discountPercent);
      if (!Number.isInteger(dp) || dp < 1 || dp > 100) {
        throw new AppError({ message: "discountPercent must be an integer between 1 and 100", statusCode: 400, code: "INVALID_DISCOUNT_PERCENT" });
      }
      const op = Number(originalPrice ?? 0);
      const p = Number(price ?? 0);
      if (op <= 0 || op < p) {
        throw new AppError({ message: "originalPrice is required when setting a discount and must be >= price", statusCode: 400, code: "INVALID_ORIGINAL_PRICE" });
      }
    }

    const obj = await prisma.serviceProduct.create({
      data: {
        providerId: provider.id,
        categoryId: normalizedType === "product" ? null : (categoryId !== undefined ? categoryId : provider.categoryId),
        productCategoryId: normalizedType === "product" ? productCategoryId : null,
        shopCategoryId: shopCategoryId ?? null,
        name,
        description: description ?? "",
        price,
        type: normalizedType,
        status: "approved",
        featured: Boolean(featured),
        media: media ?? {},
        customFields: customFields ?? {},
        onlinePaymentEnabled: onlinePaymentEnabled === undefined ? true : Boolean(onlinePaymentEnabled),
        originalPrice: originalPrice ?? 0,
        discountPercent: discountPercent !== undefined ? (discountPercent === null ? null : Number(discountPercent)) : null,
        isNew: Boolean(isNew),
        sku: sku !== undefined ? (sku === null ? null : String(sku)) : null,
        inventory: inventory !== undefined ? (inventory === null ? null : Math.max(0, Number(inventory) | 0)) : null
      }
    });
    return this._toDto(obj);
  }

  async updateListing({ actorUserId, listingId, updates }) {
    if (!listingId) {
      throw new AppError({ message: "Invalid listingId", statusCode: 400, code: "INVALID_LISTING_ID" });
    }

    const provider = await this.getProviderForUser(actorUserId);
    const listing = await prisma.serviceProduct.findFirst({ where: { id: listingId, providerId: provider.id } });
    if (!listing) {
      throw new AppError({ message: "Listing not found", statusCode: 404, code: "LISTING_NOT_FOUND" });
    }

    const update = {};
    if (updates.name !== undefined) update.name = updates.name;
    if (updates.description !== undefined) update.description = updates.description ?? "";
    if (updates.price !== undefined) update.price = updates.price;
    if (updates.categoryId !== undefined) update.categoryId = updates.categoryId;
    if (updates.productCategoryId !== undefined) update.productCategoryId = updates.productCategoryId;
    if (updates.shopCategoryId !== undefined) {
      await this.assertShopCategoryOwnership({ shopCategoryId: updates.shopCategoryId, providerId: provider.id });
      update.shopCategoryId = updates.shopCategoryId || null;
    }
    if (updates.media !== undefined) update.media = updates.media ?? {};
    if (updates.customFields !== undefined) update.customFields = updates.customFields ?? {};
    if (updates.featured !== undefined) update.featured = Boolean(updates.featured);
    if (updates.onlinePaymentEnabled !== undefined) update.onlinePaymentEnabled = Boolean(updates.onlinePaymentEnabled);
    if (updates.type !== undefined) {
      const normalizedType = String(updates.type ?? "").toLowerCase();
      if (!["service", "product"].includes(normalizedType)) {
        throw new AppError({ message: "Invalid type", statusCode: 400, code: "INVALID_TYPE" });
      }
      update.type = normalizedType;
    }
    if (updates.originalPrice !== undefined) update.originalPrice = updates.originalPrice ?? 0;
    if (updates.isNew !== undefined) update.isNew = Boolean(updates.isNew);
    if (updates.sku !== undefined) update.sku = updates.sku === null ? null : String(updates.sku);
    if (updates.inventory !== undefined) update.inventory = updates.inventory === null ? null : Math.max(0, Number(updates.inventory) | 0);
    if (updates.discountPercent !== undefined) {
      if (updates.discountPercent === null) {
        update.discountPercent = null;
      } else {
        const dp = Number(updates.discountPercent);
        if (!Number.isInteger(dp) || dp < 1 || dp > 100) {
          throw new AppError({ message: "discountPercent must be an integer between 1 and 100", statusCode: 400, code: "INVALID_DISCOUNT_PERCENT" });
        }
        const candidatePrice = Number(update.price ?? updates.originalPrice ?? listing.price ?? 0);
        const candidateOriginal = Number(update.originalPrice ?? updates.price ?? listing.originalPrice ?? 0);
        if (candidateOriginal <= 0 || candidateOriginal < candidatePrice) {
          throw new AppError({ message: "originalPrice is required when setting a discount and must be >= price", statusCode: 400, code: "INVALID_ORIGINAL_PRICE" });
        }
        update.discountPercent = dp;
      }
    }

    const effectiveType = update.type ?? listing.type;
    const productCategoryChanging = updates.productCategoryId !== undefined && updates.productCategoryId !== listing.productCategoryId;
    const becomingProduct = effectiveType === "product" && listing.type !== "product";
    const becomingService = effectiveType === "service" && listing.type !== "service";
    if (effectiveType === "product" && (productCategoryChanging || becomingProduct)) {
      await this.assertProductCategory(update.productCategoryId !== undefined ? update.productCategoryId : listing.productCategoryId);
    }
    if (becomingProduct) update.categoryId = null;
    if (becomingService) update.productCategoryId = null;

    const updated = await prisma.serviceProduct.update({ where: { id: listingId }, data: update });

    return this._toDto(updated);
  }

  async deleteListing({ actorUserId, listingId }) {
    if (!listingId) {
      throw new AppError({ message: "Invalid listingId", statusCode: 400, code: "INVALID_LISTING_ID" });
    }

    const provider = await this.getProviderForUser(actorUserId);
    const deleted = await prisma.serviceProduct.deleteMany({ where: { id: listingId, providerId: provider.id } });
    if (!deleted.count) {
      throw new AppError({ message: "Listing not found", statusCode: 404, code: "LISTING_NOT_FOUND" });
    }

    return { deleted: true };
  }

  async bumpSoldCounts(items) {
    if (!Array.isArray(items)) return;
    for (const { listingId, qty } of items) {
      if (!listingId || !qty) continue;
      await prisma.serviceProduct.updateMany({
        where: { id: listingId },
        data: { soldCount: { increment: Math.max(1, Number(qty) | 0) } }
      });
    }
  }

  _toDto(i, provider, distanceKm) {
    return {
      id: i.id,
      providerId: i.providerId,
      provider: provider ? { id: provider.id, businessName: provider.businessName, onlinePaymentsEnabled: provider.onlinePaymentsEnabled } : undefined,
      ...(distanceKm !== undefined ? { distanceKm: Math.round(distanceKm * 10) / 10 } : {}),
      categoryId: i.categoryId,
      productCategoryId: i.productCategoryId,
      shopCategoryId: i.shopCategoryId,
      name: i.name,
      description: i.description,
      price: i.price,
      originalPrice: i.originalPrice,
      discountPercent: i.discountPercent,
      isNew: Boolean(i.isNew),
      soldCount: Number(i.soldCount ?? 0),
      viewCount: Number(i.viewCount ?? 0),
      sku: i.sku ?? null,
      inventory: i.inventory ?? null,
      status: i.status,
      type: i.type,
      featured: i.featured,
      media: i.media,
      customFields: i.customFields,
      availability: i.availability,
      onlinePaymentEnabled: i.onlinePaymentEnabled,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt
    };
  }

  async listMine({ actorUserId, page = 1, limit = 50, type, status, shopCategoryId }) {
    const provider = await this.getProviderForUser(actorUserId);
    const normalizedPage = Math.max(1, Number(page) || 1);
    const normalizedLimit = Math.min(100, Math.max(1, Number(limit) || 50));
    const where = { providerId: provider.id };
    if (type) where.type = String(type).toLowerCase();
    if (status) where.status = String(status).toLowerCase();
    if (shopCategoryId) where.shopCategoryId = shopCategoryId;

    const [items, total] = await Promise.all([
      prisma.serviceProduct.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (normalizedPage - 1) * normalizedLimit,
        take: normalizedLimit
      }),
      prisma.serviceProduct.count({ where })
    ]);

    return {
      items: items.map((i) => this._toDto(i)),
      page: normalizedPage,
      limit: normalizedLimit,
      total
    };
  }

  async listByProvider({ providerId, page = 1, limit = 20, type, shopCategoryId }) {
    if (!providerId) {
      throw new AppError({ message: "Invalid providerId", statusCode: 400, code: "INVALID_PROVIDER_ID" });
    }

    const provider = await prisma.provider.findUnique({ where: { id: providerId } });
    if (!provider || !provider.isApproved || provider.moderationStatus !== "approved") {
      throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    }

    const normalizedPage = Math.max(1, Number(page) || 1);
    const normalizedLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (normalizedPage - 1) * normalizedLimit;

    const filter = { providerId: provider.id, status: "approved" };
    if (type) {
      const normalizedType = String(type ?? "").toLowerCase();
      if (!["service", "product"].includes(normalizedType)) {
        throw new AppError({ message: "Invalid type", statusCode: 400, code: "INVALID_TYPE" });
      }
      filter.type = normalizedType;
    }
    if (shopCategoryId) filter.shopCategoryId = shopCategoryId;

    const [items, total] = await Promise.all([
      prisma.serviceProduct.findMany({
        where: filter,
        orderBy: { createdAt: "desc" },
        skip,
        take: normalizedLimit
      }),
      prisma.serviceProduct.count({ where: filter })
    ]);

    return {
      items: items.map((i) => this._toDto(i)),
      page: normalizedPage,
      limit: normalizedLimit,
      total
    };
  }

  // A product's productCategoryId is always a leaf (assertProductCategory), but a shop category
  // page can be clicked on any ancestor of that leaf - so browsing "Electronics" has to match
  // every product filed under any of its descendant subcategories, not just
  // productCategoryId === "Electronics" itself.
  async _expandProductCategoryIds(productCategoryId) {
    const rows = await prisma.productCategory.findMany({ select: { id: true, parentId: true } });
    const childrenByParent = new Map();
    for (const row of rows) {
      if (!row.parentId) continue;
      if (!childrenByParent.has(row.parentId)) childrenByParent.set(row.parentId, []);
      childrenByParent.get(row.parentId).push(row.id);
    }
    const ids = [productCategoryId];
    const queue = [productCategoryId];
    while (queue.length) {
      const current = queue.shift();
      for (const childId of childrenByParent.get(current) ?? []) {
        ids.push(childId);
        queue.push(childId);
      }
    }
    return ids;
  }

  async _buildPublicFilter({ type, q, categoryId, productCategoryId, providerId, discountOnly, isNew }) {
    const filter = { status: "approved" };

    let normalizedType = null;
    if (type) {
      normalizedType = String(type ?? "").toLowerCase();
      if (!["service", "product"].includes(normalizedType)) {
        throw new AppError({ message: "Invalid type", statusCode: 400, code: "INVALID_TYPE" });
      }
      filter.type = normalizedType;
    }

    if (q) filter.name = { contains: String(q).trim() };
    if (discountOnly === "true" || discountOnly === true) filter.discountPercent = { not: null };
    if (isNew === "true" || isNew === true) filter.isNew = true;

    const providerFilter = { isApproved: true, moderationStatus: "approved", ...(providerId ? { id: providerId } : {}) };
    if (normalizedType === "product" && productCategoryId) {
      const categoryIds = await this._expandProductCategoryIds(productCategoryId);
      filter.productCategoryId = { in: categoryIds };
      filter.provider = providerFilter;
    } else if (categoryId) {
      filter.OR = [
        { categoryId, provider: providerFilter },
        { categoryId: null, provider: { ...providerFilter, categoryId } }
      ];
    } else {
      filter.provider = providerFilter;
    }

    return filter;
  }

  _orderByForSort(sort) {
    switch (sort) {
      case "newest": return [{ createdAt: "desc" }];
      case "price_asc": return [{ price: "asc" }];
      case "price_desc": return [{ price: "desc" }];
      case "bestsellers": return [{ soldCount: "desc" }, { createdAt: "desc" }];
      case "featured": return [{ featured: "desc" }, { createdAt: "desc" }];
      default: return [{ createdAt: "desc" }];
    }
  }

  // A product has no location of its own - it inherits its provider's. So "nearby products"
  // means: find providers near this point (an indexed geohash-cell lookup, mirroring
  // RideService#findNearestDriver), then list products from just that small provider set.
  async _findNearbyProviderIds({ lat, lng, radiusKm }) {
    const precision = radiusKm <= 2 ? GEOHASH_PRECISION_FINE : GEOHASH_PRECISION_COARSE;
    const geohashField = precision === GEOHASH_PRECISION_FINE ? "geohash6" : "geohash5";
    const cells = geohashSearchCells(lat, lng, precision);

    const candidates = await prisma.provider.findMany({
      where: {
        isApproved: true,
        moderationStatus: "approved",
        [geohashField]: { in: cells },
        lat: { not: null },
        lng: { not: null }
      },
      select: { id: true, lat: true, lng: true }
    });

    const distanceById = new Map();
    for (const candidate of candidates) {
      const distanceKm = haversineDistanceKm(lat, lng, candidate.lat, candidate.lng);
      if (distanceKm <= radiusKm) distanceById.set(candidate.id, distanceKm);
    }

    return distanceById;
  }

  async publicList({ page = 1, limit = 20, type, q, categoryId, productCategoryId, providerId, sort, discountOnly, isNew, lat, lng, radiusKm }) {
    const normalizedPage = Math.max(1, Number(page) || 1);
    const normalizedLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (normalizedPage - 1) * normalizedLimit;

    const hasGeo = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Number.isFinite(Number(radiusKm));

    if (!hasGeo) {
      const filter = await this._buildPublicFilter({ type, q, categoryId, productCategoryId, providerId, discountOnly, isNew });
      const orderBy = this._orderByForSort(sort);

      const [items, total] = await Promise.all([
        prisma.serviceProduct.findMany({
          where: filter,
          orderBy,
          skip,
          take: normalizedLimit,
          include: { provider: { select: { id: true, businessName: true, onlinePaymentsEnabled: true } } }
        }),
        prisma.serviceProduct.count({ where: filter })
      ]);

      return {
        items: items.map((i) => this._toDto(i, i.provider)),
        page: normalizedPage,
        limit: normalizedLimit,
        total
      };
    }

    const distanceById = await this._findNearbyProviderIds({ lat: Number(lat), lng: Number(lng), radiusKm: Number(radiusKm) });
    const nearbyProviderIds = providerId
      ? Array.from(distanceById.keys()).filter((id) => id === providerId)
      : Array.from(distanceById.keys());
    if (!nearbyProviderIds.length) {
      return { items: [], page: normalizedPage, limit: normalizedLimit, total: 0 };
    }

    const filter = await this._buildPublicFilter({ type, q, categoryId, productCategoryId, discountOnly, isNew });
    filter.provider = { id: { in: nearbyProviderIds } };

    const candidates = await prisma.serviceProduct.findMany({
      where: filter,
      include: { provider: { select: { id: true, businessName: true, onlinePaymentsEnabled: true } } }
    });

    const ranked = candidates
      .map((i) => ({ item: i, distanceKm: distanceById.get(i.providerId) }))
      .sort((a, b) => a.distanceKm - b.distanceKm || new Date(b.item.createdAt) - new Date(a.item.createdAt));

    const total = ranked.length;
    const pageItems = ranked.slice(skip, skip + normalizedLimit);

    return {
      items: pageItems.map(({ item, distanceKm }) => this._toDto(item, item.provider, distanceKm)),
      page: normalizedPage,
      limit: normalizedLimit,
      total
    };
  }

  async listNewArrivals({ limit = 6, type }) {
    const normalizedLimit = Math.min(60, Math.max(1, Number(limit) || 6));
    const filter = await this._buildPublicFilter({ type });
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    filter.OR = [
      { ...filter, isNew: true },
      { ...filter, createdAt: { gte: thirtyDaysAgo } }
    ];
    delete filter.isNew;
    delete filter.createdAt;
    const rows = await prisma.serviceProduct.findMany({
      where: {
        status: "approved",
        provider: filter.provider,
        OR: [
          { isNew: true, ...(type ? { type } : {}) },
          { createdAt: { gte: thirtyDaysAgo }, ...(type ? { type } : {}) }
        ]
      },
      orderBy: [{ createdAt: "desc" }],
      take: normalizedLimit,
      include: { provider: { select: { id: true, businessName: true, onlinePaymentsEnabled: true } } }
    });
    return { items: rows.map((r) => this._toDto(r, r.provider)), total: rows.length };
  }

  async listBestSellers({ limit = 3, type }) {
    const normalizedLimit = Math.min(60, Math.max(1, Number(limit) || 3));
    const filter = await this._buildPublicFilter({ type });
    const rows = await prisma.serviceProduct.findMany({
      where: {
        status: "approved",
        provider: filter.provider,
        ...(type ? { type } : {})
      },
      orderBy: [{ soldCount: "desc" }, { createdAt: "desc" }],
      take: normalizedLimit,
      include: { provider: { select: { id: true, businessName: true, onlinePaymentsEnabled: true } } }
    });
    return { items: rows.map((r) => this._toDto(r, r.provider)), total: rows.length };
  }

  async listFeatured({ limit = 4, type }) {
    const normalizedLimit = Math.min(60, Math.max(1, Number(limit) || 4));
    const filter = await this._buildPublicFilter({ type });
    const rows = await prisma.serviceProduct.findMany({
      where: {
        status: "approved",
        featured: true,
        provider: filter.provider,
        ...(type ? { type } : {})
      },
      orderBy: [{ createdAt: "desc" }],
      take: normalizedLimit,
      include: { provider: { select: { id: true, businessName: true, onlinePaymentsEnabled: true } } }
    });
    return { items: rows.map((r) => this._toDto(r, r.provider)), total: rows.length };
  }

  async getPublicListing({ listingId }) {
    if (!listingId) {
      throw new AppError({ message: "Invalid listingId", statusCode: 400, code: "INVALID_LISTING_ID" });
    }
    const listing = await prisma.serviceProduct.findUnique({
      where: { id: listingId },
      include: { provider: { select: { id: true, businessName: true, isApproved: true, moderationStatus: true, onlinePaymentsEnabled: true } } }
    });
    if (
      !listing ||
      listing.status !== "approved" ||
      !listing.provider?.isApproved ||
      listing.provider.moderationStatus !== "approved"
    ) {
      throw new AppError({ message: "Listing not found", statusCode: 404, code: "LISTING_NOT_FOUND" });
    }
    prisma.serviceProduct.update({ where: { id: listingId }, data: { viewCount: { increment: 1 } } })
      .catch(() => {});
    return this._toDto(listing, listing.provider);
  }
}
