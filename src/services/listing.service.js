import { AppError } from "../utils/AppError.js";
import { prisma } from "../config/db.js";
import { CategoryViewType } from "../constants/enums.js";

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

  // A product must be placed in the e-commerce category tree, and specifically at a leaf of it -
  // if the chosen category has subcategories, the provider has to drill into one of them (or
  // create a new one via /categories/mine) rather than leave the product sitting one level too
  // high. Services keep using the general directory category (optional, inherited from the
  // provider), unaffected by this rule.
  async assertProductCategory(categoryId) {
    if (!categoryId) {
      throw new AppError({ message: "Choose a category for this product", statusCode: 400, code: "CATEGORY_REQUIRED" });
    }
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      throw new AppError({ message: "Category not found", statusCode: 404, code: "CATEGORY_NOT_FOUND" });
    }
    if (category.viewType !== CategoryViewType.ECOMMERCE) {
      throw new AppError({ message: "Choose a product category", statusCode: 400, code: "INVALID_CATEGORY_TYPE" });
    }
    const childCount = await prisma.category.count({ where: { parentId: categoryId } });
    if (childCount > 0) {
      throw new AppError({ message: "Choose a more specific subcategory", statusCode: 400, code: "CATEGORY_NOT_LEAF" });
    }
  }

  async createListing({ actorUserId, name, description, price = 0, type, categoryId, shopCategoryId, media, customFields, featured, onlinePaymentEnabled, originalPrice, discountPercent, isNew, sku, inventory }) {
    const provider = await this.getProviderForUser(actorUserId);

    const normalizedType = String(type ?? "").toLowerCase();
    if (!["service", "product"].includes(normalizedType)) {
      throw new AppError({ message: "Invalid type", statusCode: 400, code: "INVALID_TYPE" });
    }
    await this.assertShopCategoryOwnership({ shopCategoryId, providerId: provider.id });
    if (normalizedType === "product") {
      await this.assertProductCategory(categoryId);
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
        categoryId: categoryId !== undefined ? categoryId : provider.categoryId,
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
        originalPrice: originalPrice !== undefined ? originalPrice : 0,
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
    if (updates.originalPrice !== undefined) update.originalPrice = updates.originalPrice;
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
    const categoryChanging = updates.categoryId !== undefined && updates.categoryId !== listing.categoryId;
    const becomingProduct = effectiveType === "product" && listing.type !== "product";
    if (effectiveType === "product" && (categoryChanging || becomingProduct)) {
      await this.assertProductCategory(update.categoryId !== undefined ? update.categoryId : listing.categoryId);
    }

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

  _toDto(i, provider) {
    return {
      id: i.id,
      providerId: i.providerId,
      provider: provider ? { id: provider.id, businessName: provider.businessName, onlinePaymentsEnabled: provider.onlinePaymentsEnabled } : undefined,
      categoryId: i.categoryId,
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

  _buildPublicFilter({ type, q, categoryId, providerId, discountOnly, isNew }) {
    const filter = { status: "approved" };

    if (type) {
      const normalizedType = String(type ?? "").toLowerCase();
      if (!["service", "product"].includes(normalizedType)) {
        throw new AppError({ message: "Invalid type", statusCode: 400, code: "INVALID_TYPE" });
      }
      filter.type = normalizedType;
    }

    if (q) filter.name = { contains: String(q).trim() };
    if (discountOnly === "true" || discountOnly === true) filter.discountPercent = { not: null };
    if (isNew === "true" || isNew === true) filter.isNew = true;

    const providerFilter = { isApproved: true, moderationStatus: "approved", ...(providerId ? { id: providerId } : {}) };
    if (categoryId) {
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

  async publicList({ page = 1, limit = 20, type, q, categoryId, providerId, sort, discountOnly, isNew }) {
    const normalizedPage = Math.max(1, Number(page) || 1);
    const normalizedLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (normalizedPage - 1) * normalizedLimit;

    const filter = this._buildPublicFilter({ type, q, categoryId, providerId, discountOnly, isNew });
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

  async listNewArrivals({ limit = 6, type }) {
    const normalizedLimit = Math.min(60, Math.max(1, Number(limit) || 6));
    const filter = this._buildPublicFilter({ type });
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
    const filter = this._buildPublicFilter({ type });
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
    const filter = this._buildPublicFilter({ type });
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
