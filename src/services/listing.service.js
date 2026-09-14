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

  async createListing({ actorUserId, name, description, price = 0, type, categoryId, shopCategoryId, media, customFields, featured, onlinePaymentEnabled }) {
    const provider = await this.getProviderForUser(actorUserId);

    const normalizedType = String(type ?? "").toLowerCase();
    if (!["service", "product"].includes(normalizedType)) {
      throw new AppError({ message: "Invalid type", statusCode: 400, code: "INVALID_TYPE" });
    }
    await this.assertShopCategoryOwnership({ shopCategoryId, providerId: provider.id });
    if (normalizedType === "product") {
      await this.assertProductCategory(categoryId);
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
        // Providers go live immediately - no admin moderation gate on listing creation.
        status: "approved",
        featured: Boolean(featured),
        media: media ?? {},
        customFields: customFields ?? {},
        onlinePaymentEnabled: onlinePaymentEnabled === undefined ? true : Boolean(onlinePaymentEnabled)
      }
    });
    return {
      id: obj.id,
      providerId: obj.providerId,
      categoryId: obj.categoryId,
      shopCategoryId: obj.shopCategoryId,
      name: obj.name,
      description: obj.description,
      price: obj.price,
      type: obj.type,
      featured: obj.featured,
      media: obj.media,
      customFields: obj.customFields,
      onlinePaymentEnabled: obj.onlinePaymentEnabled,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt
    };
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

    // Only re-run the leaf/e-commerce category check when the category is actually being
    // changed, or the listing is being converted from a service into a product - not on every
    // save. The form always resends both `type` and `categoryId`, so gating on their mere
    // presence would trap any listing that predates this rule (e.g. no category, or a directory
    // category) into never being editable again until its category is fixed.
    const effectiveType = update.type ?? listing.type;
    const categoryChanging = updates.categoryId !== undefined && updates.categoryId !== listing.categoryId;
    const becomingProduct = effectiveType === "product" && listing.type !== "product";
    if (effectiveType === "product" && (categoryChanging || becomingProduct)) {
      await this.assertProductCategory(update.categoryId !== undefined ? update.categoryId : listing.categoryId);
    }

    const updated = await prisma.serviceProduct.update({ where: { id: listingId }, data: update });

    return {
      id: updated.id,
      providerId: updated.providerId,
      categoryId: updated.categoryId,
      shopCategoryId: updated.shopCategoryId,
      name: updated.name,
      description: updated.description,
      price: updated.price,
      type: updated.type,
      featured: updated.featured,
      media: updated.media,
      customFields: updated.customFields,
      onlinePaymentEnabled: updated.onlinePaymentEnabled,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    };
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
      items: items.map((i) => ({
        id: i.id,
        providerId: i.providerId,
        categoryId: i.categoryId,
        shopCategoryId: i.shopCategoryId,
        name: i.name,
        description: i.description,
        price: i.price,
        type: i.type,
        status: i.status,
        featured: i.featured,
        media: i.media,
        customFields: i.customFields,
        inventory: i.inventory,
        sku: i.sku,
        onlinePaymentEnabled: i.onlinePaymentEnabled,
        availability: i.availability,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt
      })),
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
      items: items.map((i) => ({
        id: i.id,
        providerId: i.providerId,
        categoryId: i.categoryId,
        shopCategoryId: i.shopCategoryId,
        name: i.name,
        description: i.description,
        price: i.price,
        type: i.type,
        featured: i.featured,
        media: i.media,
        customFields: i.customFields,
        onlinePaymentEnabled: i.onlinePaymentEnabled,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt
      })),
      page: normalizedPage,
      limit: normalizedLimit,
      total
    };
  }

  async publicList({ page = 1, limit = 20, type, q, categoryId, providerId }) {
    const normalizedPage = Math.max(1, Number(page) || 1);
    const normalizedLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (normalizedPage - 1) * normalizedLimit;

    const filter = { status: "approved" };

    if (type) {
      const normalizedType = String(type ?? "").toLowerCase();
      if (!["service", "product"].includes(normalizedType)) {
        throw new AppError({ message: "Invalid type", statusCode: 400, code: "INVALID_TYPE" });
      }
      filter.type = normalizedType;
    }

    if (q) {
      filter.name = { contains: String(q).trim() };
    }

    // A listing is only ever shown once its own provider is approved. categoryId matches the
    // listing's own category first; listings created before categoryId existed (null) fall back
    // to matching their provider's category, so older data stays browsable.
    const providerFilter = { isApproved: true, moderationStatus: "approved", ...(providerId ? { id: providerId } : {}) };
    if (categoryId) {
      filter.OR = [
        { categoryId, provider: providerFilter },
        { categoryId: null, provider: { ...providerFilter, categoryId } }
      ];
    } else {
      filter.provider = providerFilter;
    }

    const [items, total] = await Promise.all([
      prisma.serviceProduct.findMany({
        where: filter,
        orderBy: { createdAt: "desc" },
        skip,
        take: normalizedLimit,
        include: { provider: { select: { id: true, businessName: true, onlinePaymentsEnabled: true } } }
      }),
      prisma.serviceProduct.count({ where: filter })
    ]);

    return {
      items: items.map((i) => ({
        id: i.id,
        providerId: i.providerId,
        provider: i.provider ? { id: i.provider.id, businessName: i.provider.businessName, onlinePaymentsEnabled: i.provider.onlinePaymentsEnabled } : null,
        categoryId: i.categoryId,
        shopCategoryId: i.shopCategoryId,
        name: i.name,
        description: i.description,
        price: i.price,
        type: i.type,
        featured: i.featured,
        media: i.media,
        customFields: i.customFields,
        onlinePaymentEnabled: i.onlinePaymentEnabled,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt
      })),
      page: normalizedPage,
      limit: normalizedLimit,
      total
    };
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
    return {
      id: listing.id,
      providerId: listing.providerId,
      provider: { id: listing.provider.id, businessName: listing.provider.businessName, onlinePaymentsEnabled: listing.provider.onlinePaymentsEnabled },
      categoryId: listing.categoryId,
      shopCategoryId: listing.shopCategoryId,
      name: listing.name,
      description: listing.description,
      price: listing.price,
      type: listing.type,
      featured: listing.featured,
      media: listing.media,
      customFields: listing.customFields,
      onlinePaymentEnabled: listing.onlinePaymentEnabled,
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt
    };
  }
}
