import { AppError } from "../utils/AppError.js";
import { prisma } from "../config/db.js";
import { findNearbyProviderIds } from "./geoProviderSearch.js";
import { haversineDistanceKm } from "../utils/geohash.js";

const GEOHASH_SAFE_RADIUS_KM = 20; // a 3x3 geohash5 cell grid covers ~15km across - beyond this,
// cell lookup would silently miss real matches, so wider radii fall back to a full provider scan
const MAX_GEO_PRODUCTS = 500; // secondary safety cap on the product fetch itself
const RADIUS_WIDEN_MULTIPLIER = 3;
const NATIONWIDE_RADIUS_KM = 900; // covers all of Uganda (~800km across) while still ranking by distance
const MAX_FILTER_CANDIDATES = 1500; // attribute filters match inside the customFields JSON, so they run in memory
const MAX_FACET_CANDIDATES = 3000;
const PROVIDER_CARD_SELECT = { id: true, businessName: true, onlinePaymentsEnabled: true, district: true };

// attrs arrive as a JSON string ({"brand":["Apple","Dell"],"condition":["Used"]}): OR within a
// key, AND across keys. Anything malformed is treated as "no attribute filter" rather than an error.
const parseAttrs = (raw) => {
  if (!raw) return {};
  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const attrs = {};
  for (const [key, values] of Object.entries(parsed)) {
    const list = (Array.isArray(values) ? values : [values]).map((v) => String(v)).filter(Boolean);
    if (list.length) attrs[key] = list;
  }
  return attrs;
};

const answerValues = (customFields, key) => {
  const raw = customFields?.[key];
  if (raw === undefined || raw === null || raw === "") return [];
  if (Array.isArray(raw)) return raw.map((v) => String(v));
  if (typeof raw === "object") return [];
  return [String(raw)];
};

const matchesAttrs = (customFields, attrs, skipKey) =>
  Object.entries(attrs).every(([key, wanted]) => {
    if (key === skipKey) return true;
    const have = answerValues(customFields, key);
    return wanted.some((w) => have.includes(w));
  });

// Rounds to 2 significant digits so price buckets read as 35K / 140K / 700K, not 137,482.
const niceRound = (n) => {
  if (!(n > 0)) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(n));
  const step = magnitude / 10;
  return Math.round(n / step) * step;
};

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
      provider: provider
        ? {
            id: provider.id,
            businessName: provider.businessName,
            onlinePaymentsEnabled: provider.onlinePaymentsEnabled,
            district: provider.district ?? null,
            // Only present on the single-listing page, which selects the extra seller fields.
            ...(provider.ratingAvg !== undefined
              ? {
                  ratingAvg: provider.ratingAvg,
                  ratingCount: provider.ratingCount,
                  memberSince: provider.createdAt,
                  avatarUrl: provider.media?.avatarUrl ?? null,
                  productCount: provider.productCount
                }
              : {})
          }
        : undefined,
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

  // A provider's own ShopCategory subtree (browsing a parent shop category matches its children too).
  async _expandShopCategoryIds(shopCategoryId) {
    const rows = await prisma.shopCategory.findMany({ select: { id: true, parentId: true } });
    const childrenByParent = new Map();
    for (const row of rows) {
      if (!row.parentId) continue;
      if (!childrenByParent.has(row.parentId)) childrenByParent.set(row.parentId, []);
      childrenByParent.get(row.parentId).push(row.id);
    }
    const ids = [shopCategoryId];
    for (let i = 0; i < ids.length; i += 1) ids.push(...(childrenByParent.get(ids[i]) ?? []));
    return ids;
  }

  async _buildPublicFilter({ type, q, categoryId, productCategoryId, shopCategoryId, providerId, discountOnly, isNew, district, minPrice, maxPrice }) {
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
    if (shopCategoryId) filter.shopCategoryId = { in: await this._expandShopCategoryIds(shopCategoryId) };
    if (discountOnly === "true" || discountOnly === true) filter.discountPercent = { not: null };
    if (isNew === "true" || isNew === true) filter.isNew = true;
    const priceBounds = {};
    if (Number.isFinite(Number(minPrice)) && minPrice !== undefined && minPrice !== "") priceBounds.gte = Number(minPrice);
    if (Number.isFinite(Number(maxPrice)) && maxPrice !== undefined && maxPrice !== "") priceBounds.lte = Number(maxPrice);
    if (Object.keys(priceBounds).length) filter.price = priceBounds;

    const providerFilter = {
      isApproved: true,
      moderationStatus: "approved",
      ...(providerId ? { id: providerId } : {}),
      ...(district ? { district } : {})
    };
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

  // One radius attempt: nearby providers -> their products (capped, distance-ranked). Returns []
  // if nothing matches at this radius, so the caller can widen and retry.
  async _rankedProductsWithinRadius({ lat, lng, radiusKm, useGeohash, filterBase, providerId, attrs = {} }) {
    const { orderedIds, distanceById } = await findNearbyProviderIds({ lat, lng, radiusKm, useGeohash });
    const nearbyProviderIds = providerId ? orderedIds.filter((id) => id === providerId) : orderedIds;
    if (!nearbyProviderIds.length) return [];

    const filter = { ...filterBase, provider: { id: { in: nearbyProviderIds } } };
    const candidates = await prisma.serviceProduct.findMany({
      where: filter,
      orderBy: [{ createdAt: "desc" }], // tiebreak only - real ranking is the distance sort below
      take: MAX_GEO_PRODUCTS,
      include: { provider: { select: PROVIDER_CARD_SELECT } }
    });

    const hasAttrs = Object.keys(attrs).length > 0;
    return candidates
      .filter((item) => !hasAttrs || matchesAttrs(item.customFields, attrs))
      .map((item) => ({ item, distanceKm: distanceById.get(item.providerId) }))
      .sort((a, b) => a.distanceKm - b.distanceKm || new Date(b.item.createdAt) - new Date(a.item.createdAt));
  }

  // One page of products for a plain (non-geo) filter. Attribute answers live inside the
  // customFields JSON, so when any are requested the match runs in memory over a capped candidate
  // set (already ordered by the DB); otherwise it stays a straight indexed query.
  async _fetchPage({ filter, attrs, sort, skip, take }) {
    const include = { provider: { select: PROVIDER_CARD_SELECT } };
    const orderBy = this._orderByForSort(sort);
    if (!Object.keys(attrs).length) {
      const [items, total] = await Promise.all([
        prisma.serviceProduct.findMany({ where: filter, orderBy, skip, take, include }),
        prisma.serviceProduct.count({ where: filter })
      ]);
      return { items, total };
    }
    const candidates = await prisma.serviceProduct.findMany({ where: filter, orderBy, take: MAX_FILTER_CANDIDATES, include });
    const matched = candidates.filter((c) => matchesAttrs(c.customFields, attrs));
    return { items: matched.slice(skip, skip + take), total: matched.length };
  }

  async publicList({ page = 1, limit = 20, type, q, categoryId, productCategoryId, shopCategoryId, providerId, sort, discountOnly, isNew, lat, lng, radiusKm, district, minPrice, maxPrice, attrs: rawAttrs }) {
    const normalizedPage = Math.max(1, Number(page) || 1);
    const normalizedLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (normalizedPage - 1) * normalizedLimit;
    const attrs = parseAttrs(rawAttrs);
    const baseArgs = { type, q, categoryId, productCategoryId, shopCategoryId, providerId, discountOnly, isNew, minPrice, maxPrice };

    const hasGeo = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Number.isFinite(Number(radiusKm));

    // Geo takes precedence over district when both are somehow present - redundant, not
    // conflicting, so no validation error; just ignore district in that case.
    if (hasGeo) {
      const filterBase = await this._buildPublicFilter({ ...baseArgs, providerId: undefined });
      const requestedRadiusKm = Number(radiusKm);
      const tierRadii = [requestedRadiusKm, requestedRadiusKm * RADIUS_WIDEN_MULTIPLIER, NATIONWIDE_RADIUS_KM];

      let ranked = [];
      let effectiveRadiusKm = requestedRadiusKm;
      let widened = false;
      for (let i = 0; i < tierRadii.length; i += 1) {
        const tierRadiusKm = tierRadii[i];
        ranked = await this._rankedProductsWithinRadius({
          lat: Number(lat),
          lng: Number(lng),
          radiusKm: tierRadiusKm,
          useGeohash: tierRadiusKm <= GEOHASH_SAFE_RADIUS_KM,
          filterBase,
          providerId,
          attrs
        });
        effectiveRadiusKm = tierRadiusKm;
        widened = i > 0;
        if (ranked.length > 0 || i === tierRadii.length - 1) break;
      }

      const total = ranked.length;
      const pageItems = ranked.slice(skip, skip + normalizedLimit);

      return {
        items: pageItems.map(({ item, distanceKm }) => this._toDto(item, item.provider, distanceKm)),
        page: normalizedPage,
        limit: normalizedLimit,
        total,
        effectiveRadiusKm,
        effectiveDistrict: null,
        widened
      };
    }

    if (district) {
      let filter = await this._buildPublicFilter({ ...baseArgs, district });
      let result = await this._fetchPage({ filter, attrs, sort, skip, take: normalizedLimit });
      let effectiveDistrict = district;
      let widened = false;

      if (result.total === 0) {
        filter = await this._buildPublicFilter(baseArgs);
        result = await this._fetchPage({ filter, attrs, sort, skip, take: normalizedLimit });
        effectiveDistrict = null;
        widened = true;
      }

      return {
        items: result.items.map((i) => this._toDto(i, i.provider)),
        page: normalizedPage,
        limit: normalizedLimit,
        total: result.total,
        effectiveRadiusKm: null,
        effectiveDistrict,
        widened
      };
    }

    const filter = await this._buildPublicFilter(baseArgs);
    const result = await this._fetchPage({ filter, attrs, sort, skip, take: normalizedLimit });

    return {
      items: result.items.map((i) => this._toDto(i, i.provider)),
      page: normalizedPage,
      limit: normalizedLimit,
      total: result.total,
      effectiveRadiusKm: null,
      effectiveDistrict: null,
      widened: false
    };
  }

  // Sidebar data for the Jiji-style browse page: how many products each filter option would
  // return. Every group's counts ignore that group's OWN selection (so ticking "Apple" still shows
  // what "Dell" would add) but respect every other active filter, and all of it is scoped to the
  // chosen location, so numbers always match what the result grid would show.
  async facets({ type, q, categoryId, productCategoryId, shopCategoryId, providerId, discountOnly, isNew, lat, lng, radiusKm, district, minPrice, maxPrice, attrs: rawAttrs }) {
    const attrs = parseAttrs(rawAttrs);
    const hasGeo = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Number.isFinite(Number(radiusKm));
    const filter = await this._buildPublicFilter({ type, q, categoryId, productCategoryId, shopCategoryId, providerId, discountOnly, isNew });

    let geo = null;
    if (hasGeo) {
      const requestedRadiusKm = Number(radiusKm);
      const tierRadii = [requestedRadiusKm, requestedRadiusKm * RADIUS_WIDEN_MULTIPLIER, NATIONWIDE_RADIUS_KM];
      for (let i = 0; i < tierRadii.length; i += 1) {
        const found = await findNearbyProviderIds({
          lat: Number(lat),
          lng: Number(lng),
          radiusKm: tierRadii[i],
          useGeohash: tierRadii[i] <= GEOHASH_SAFE_RADIUS_KM
        });
        geo = { ids: new Set(found.orderedIds), effectiveRadiusKm: tierRadii[i], widened: i > 0 };
        if (found.orderedIds.length || i === tierRadii.length - 1) break;
      }
    }

    const rows = await prisma.serviceProduct.findMany({
      where: filter,
      select: {
        id: true,
        providerId: true,
        price: true,
        discountPercent: true,
        productCategoryId: true,
        shopCategoryId: true,
        customFields: true,
        provider: { select: { district: true } }
      },
      orderBy: [{ createdAt: "desc" }],
      take: MAX_FACET_CANDIDATES
    });

    const minP = Number.isFinite(Number(minPrice)) && minPrice !== undefined && minPrice !== "" ? Number(minPrice) : null;
    const maxP = Number.isFinite(Number(maxPrice)) && maxPrice !== undefined && maxPrice !== "" ? Number(maxPrice) : null;
    const wantDiscount = discountOnly === "true" || discountOnly === true;

    // `skip` names the one filter group to ignore for this particular count.
    const passes = (row, skip) => {
      if (geo && skip !== "district" && !geo.ids.has(row.providerId)) return false;
      if (!geo && district && skip !== "district" && row.provider?.district !== district) return false;
      const price = Number(row.price);
      if (skip !== "price" && ((minP !== null && price < minP) || (maxP !== null && price > maxP))) return false;
      if (skip !== "discount" && wantDiscount && row.discountPercent == null) return false;
      return matchesAttrs(row.customFields, attrs, skip?.startsWith("attr:") ? skip.slice(5) : undefined);
    };

    const matching = rows.filter((r) => passes(r));

    const countBy = (list, valuesOf) => {
      const counts = new Map();
      for (const row of list) for (const v of new Set(valuesOf(row))) counts.set(v, (counts.get(v) ?? 0) + 1);
      return counts;
    };

    const attributes = {};
    const attrKeys = new Set();
    for (const row of rows) for (const key of Object.keys(row.customFields ?? {})) attrKeys.add(key);
    for (const key of attrKeys) {
      const subset = rows.filter((r) => passes(r, `attr:${key}`));
      const counts = countBy(subset, (r) => {
        const raw = r.customFields?.[key];
        if (typeof raw === "boolean") return raw ? ["true"] : [];
        if (typeof raw === "number") return [];
        return answerValues(r.customFields, key).filter((v) => v.length <= 40);
      });
      if (counts.size) {
        attributes[key] = [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
      }
    }

    const priceSubset = rows.filter((r) => passes(r, "price")).map((r) => Number(r.price)).sort((a, b) => a - b);
    let buckets = [];
    if (priceSubset.length) {
      const edges = [];
      for (const q of [0.2, 0.4, 0.6, 0.8]) {
        const edge = niceRound(priceSubset[Math.min(priceSubset.length - 1, Math.floor(priceSubset.length * q))]);
        if (edge > 0 && edge > (edges[edges.length - 1] ?? 0)) edges.push(edge);
      }
      const bounds = [null, ...edges, null];
      buckets = bounds.slice(0, -1).map((lo, i) => {
        const hi = bounds[i + 1];
        const count = priceSubset.filter((p) => (lo === null || p >= lo) && (hi === null || p < hi)).length;
        return { min: lo, max: hi, count };
      }).filter((b) => b.count > 0);
    }

    // The location list always offers every district, whichever location is currently applied.
    const districtCounts = countBy(
      rows.filter((r) => passes(r, "district")),
      (r) => (r.provider?.district ? [r.provider.district] : [])
    );
    const categoryCounts = Object.fromEntries(countBy(matching, (r) => (r.productCategoryId ? [r.productCategoryId] : [])));

    return {
      total: matching.length,
      price: { min: priceSubset[0] ?? null, max: priceSubset[priceSubset.length - 1] ?? null, buckets },
      attributes,
      districts: [...districtCounts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
      categoryCounts,
      shopCategoryCounts: Object.fromEntries(countBy(matching, (r) => (r.shopCategoryId ? [r.shopCategoryId] : []))),
      discountCount: rows.filter((r) => passes(r, "discount") && r.discountPercent != null).length,
      truncated: rows.length >= MAX_FACET_CANDIDATES,
      ...(geo ? { effectiveRadiusKm: geo.effectiveRadiusKm, widened: geo.widened } : {})
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
      include: { provider: { select: PROVIDER_CARD_SELECT } }
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
      include: { provider: { select: PROVIDER_CARD_SELECT } }
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
      include: { provider: { select: PROVIDER_CARD_SELECT } }
    });
    return { items: rows.map((r) => this._toDto(r, r.provider)), total: rows.length };
  }

  async getPublicListing({ listingId }) {
    if (!listingId) {
      throw new AppError({ message: "Invalid listingId", statusCode: 400, code: "INVALID_LISTING_ID" });
    }
    const listing = await prisma.serviceProduct.findUnique({
      where: { id: listingId },
      include: {
        provider: {
          select: {
            id: true,
            businessName: true,
            isApproved: true,
            moderationStatus: true,
            onlinePaymentsEnabled: true,
            district: true,
            ratingAvg: true,
            ratingCount: true,
            createdAt: true,
            media: true
          }
        }
      }
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
    const productCount = await prisma.serviceProduct.count({
      where: { providerId: listing.providerId, status: "approved", type: listing.type }
    });
    return this._toDto(listing, { ...listing.provider, productCount });
  }

  // "Similar products": same leaf category first, widening to its siblings, ranked so the first few
  // really are alternatives a buyer would compare - same brand and matching specs, a comparable
  // price, and nearby sellers ahead of far ones. Everything else is a tiebreak on recency.
  async similar({ listingId, limit = 8 }) {
    if (!listingId) {
      throw new AppError({ message: "Invalid listingId", statusCode: 400, code: "INVALID_LISTING_ID" });
    }
    const take = Math.min(24, Math.max(1, Number(limit) || 8));
    const base = await prisma.serviceProduct.findUnique({
      where: { id: listingId },
      include: { provider: { select: { id: true, district: true, lat: true, lng: true } } }
    });
    if (!base || base.status !== "approved") {
      throw new AppError({ message: "Listing not found", statusCode: 404, code: "LISTING_NOT_FOUND" });
    }

    const where = {
      status: "approved",
      id: { not: base.id },
      type: base.type,
      provider: { isApproved: true, moderationStatus: "approved" }
    };
    if (base.productCategoryId) {
      const category = await prisma.productCategory.findUnique({ where: { id: base.productCategoryId }, select: { parentId: true } });
      where.productCategoryId = { in: await this._expandProductCategoryIds(category?.parentId ?? base.productCategoryId) };
    } else if (base.categoryId) {
      where.categoryId = base.categoryId;
    } else {
      where.providerId = base.providerId;
    }

    const candidates = await prisma.serviceProduct.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take: 150,
      include: { provider: { select: { ...PROVIDER_CARD_SELECT, lat: true, lng: true } } }
    });

    const basePrice = Number(base.price) || 0;
    const baseBrand = new Set([...answerValues(base.customFields, "brand"), ...answerValues(base.customFields, "make")]);
    const scored = candidates.map((item) => {
      let score = item.productCategoryId === base.productCategoryId ? 40 : 20;

      const brands = [...answerValues(item.customFields, "brand"), ...answerValues(item.customFields, "make")];
      if (brands.some((b) => baseBrand.has(b))) score += 15;

      let shared = 0;
      for (const key of Object.keys(base.customFields ?? {})) {
        if (key === "brand" || key === "make") continue;
        const mine = answerValues(base.customFields, key);
        if (mine.length && answerValues(item.customFields, key).some((v) => mine.includes(v))) shared += 1;
      }
      score += Math.min(shared, 5) * 2;

      const price = Number(item.price) || 0;
      if (basePrice > 0 && price > 0) {
        const ratio = Math.min(basePrice, price) / Math.max(basePrice, price);
        if (ratio >= 0.4) score += 20 * ratio;
      }

      let distanceKm;
      if (base.provider?.lat != null && item.provider?.lat != null) {
        distanceKm = haversineDistanceKm(base.provider.lat, base.provider.lng, item.provider.lat, item.provider.lng);
        score += distanceKm <= 5 ? 12 : distanceKm <= 25 ? 8 : distanceKm <= 100 ? 4 : 0;
      } else if (base.provider?.district && item.provider?.district === base.provider.district) {
        score += 8;
      }

      if (item.featured) score += 3;
      score += Math.min(Number(item.soldCount) || 0, 10) * 0.2;
      return { item, score, distanceKm };
    });

    scored.sort((a, b) => b.score - a.score || new Date(b.item.createdAt) - new Date(a.item.createdAt));
    const picked = scored.slice(0, take);
    return {
      items: picked.map(({ item, distanceKm }) => this._toDto(item, item.provider, distanceKm)),
      total: picked.length
    };
  }
}
