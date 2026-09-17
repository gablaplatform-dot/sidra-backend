import { AppError } from "../utils/AppError.js";
import { prisma } from "../config/db.js";

const uniqueError = (e) => e?.code === "P2002";

// The dedicated shop/product category tree - separate from the directory Category tree (which is
// service-provider business-type taxonomy) and from ShopCategory (each provider's own private
// storefront folders). Admin manages the whole tree; a provider can only add subcategories to it,
// never new top-level categories, when creating a product.
export class ProductCategoryService {
  async createCategory({ name, imageUrl, isActive }) {
    try {
      const sortOrder = await this.getNextSortOrder(null);
      const created = await prisma.productCategory.create({
        data: { name, parentId: null, imageUrl: imageUrl ?? null, isActive: isActive ?? true, sortOrder }
      });
      return this.toDto(created);
    } catch (e) {
      if (uniqueError(e)) {
        throw new AppError({ message: "Category already exists", statusCode: 409, code: "CATEGORY_EXISTS" });
      }
      throw e;
    }
  }

  async createSubcategory({ name, parentId, imageUrl, isActive }) {
    if (!parentId) {
      throw new AppError({ message: "Invalid parentId", statusCode: 400, code: "INVALID_PARENT_ID" });
    }
    const parent = await prisma.productCategory.findUnique({ where: { id: parentId } });
    if (!parent) {
      throw new AppError({ message: "Parent category not found", statusCode: 404, code: "CATEGORY_NOT_FOUND" });
    }

    try {
      const sortOrder = await this.getNextSortOrder(parentId);
      const created = await prisma.productCategory.create({
        data: { name, parentId, imageUrl: imageUrl ?? parent.imageUrl ?? null, isActive: isActive ?? true, sortOrder }
      });
      return this.toDto(created);
    } catch (e) {
      if (uniqueError(e)) {
        throw new AppError({ message: "Subcategory already exists", statusCode: 409, code: "SUBCATEGORY_EXISTS" });
      }
      throw e;
    }
  }

  async getProviderForUser(userId) {
    const provider = await prisma.provider.findUnique({ where: { userId } });
    if (!provider) {
      throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    }
    return provider;
  }

  // Providers may only extend the tree with a subcategory under an existing node - never a new
  // top-level shop category, which stays admin-only.
  async createFromProvider({ actorUserId, name, parentId, imageUrl }) {
    if (!parentId) {
      throw new AppError({ message: "Choose a parent category", statusCode: 400, code: "PARENT_ID_REQUIRED" });
    }
    const provider = await this.getProviderForUser(actorUserId);
    const parent = await prisma.productCategory.findUnique({ where: { id: parentId } });
    if (!parent) {
      throw new AppError({ message: "Parent category not found", statusCode: 404, code: "CATEGORY_NOT_FOUND" });
    }

    try {
      const sortOrder = await this.getNextSortOrder(parentId);
      const created = await prisma.productCategory.create({
        data: {
          name,
          parentId,
          imageUrl: imageUrl ?? parent.imageUrl ?? null,
          isActive: true,
          moderationStatus: "pending",
          createdByProviderId: provider.id,
          sortOrder
        }
      });
      return this.toDto(created);
    } catch (e) {
      if (uniqueError(e)) {
        throw new AppError({ message: "A category with this name already exists here", statusCode: 409, code: "CATEGORY_EXISTS" });
      }
      throw e;
    }
  }

  async updateCategory({ id, name, parentId, imageUrl, isActive, moderationStatus }) {
    if (!id) {
      throw new AppError({ message: "Invalid id", statusCode: 400, code: "INVALID_CATEGORY_ID" });
    }

    const update = {};
    if (name !== undefined) update.name = name;
    if (imageUrl !== undefined) update.imageUrl = imageUrl === null ? null : imageUrl;
    if (isActive !== undefined) update.isActive = isActive;
    if (moderationStatus !== undefined) update.moderationStatus = moderationStatus;
    if (parentId !== undefined) {
      if (parentId !== null && parentId !== "" && typeof parentId !== "string") {
        throw new AppError({ message: "Invalid parentId", statusCode: 400, code: "INVALID_PARENT_ID" });
      }
      if (parentId) {
        if (parentId === id) {
          throw new AppError({ message: "Category cannot be its own parent", statusCode: 400, code: "INVALID_PARENT" });
        }
        const parent = await prisma.productCategory.findUnique({ where: { id: parentId } });
        if (!parent) {
          throw new AppError({ message: "Parent category not found", statusCode: 404, code: "CATEGORY_NOT_FOUND" });
        }
        const pairs = await prisma.productCategory.findMany({ select: { id: true, parentId: true } });
        const parentById = new Map(pairs.map((c) => [c.id, c.parentId ?? null]));
        let current = parentId;
        while (current) {
          if (current === id) {
            throw new AppError({ message: "Invalid parent (cycle detected)", statusCode: 400, code: "INVALID_PARENT" });
          }
          current = parentById.get(current) ?? null;
        }
      }
      update.parentId = parentId;
    }

    try {
      const updated = await prisma.productCategory.update({ where: { id }, data: update });
      return this.toDto(updated);
    } catch (e) {
      if (e instanceof AppError) throw e;
      if (uniqueError(e)) {
        throw new AppError({ message: "Category already exists", statusCode: 409, code: "CATEGORY_EXISTS" });
      }
      if (e?.code === "P2025") {
        throw new AppError({ message: "Category not found", statusCode: 404, code: "CATEGORY_NOT_FOUND" });
      }
      throw e;
    }
  }

  async deleteCategory({ id }) {
    if (!id) {
      throw new AppError({ message: "Invalid id", statusCode: 400, code: "INVALID_CATEGORY_ID" });
    }
    const cat = await prisma.productCategory.findUnique({ where: { id } });
    if (!cat) {
      throw new AppError({ message: "Category not found", statusCode: 404, code: "CATEGORY_NOT_FOUND" });
    }
    const subcategoryCount = await prisma.productCategory.count({ where: { parentId: id } });
    if (subcategoryCount > 0) {
      throw new AppError({
        message: "This category has subcategories. Delete or move them first.",
        statusCode: 409,
        code: "CATEGORY_HAS_SUBCATEGORIES"
      });
    }
    await prisma.productCategory.delete({ where: { id } });
    return { deleted: true };
  }

  async reorderCategories({ parentId = null, orderedIds = [] }) {
    if (!Array.isArray(orderedIds) || !orderedIds.length) {
      throw new AppError({ message: "orderedIds is required", statusCode: 400, code: "INVALID_ORDERED_IDS" });
    }
    if (parentId !== null && parentId !== "" && typeof parentId !== "string") {
      throw new AppError({ message: "Invalid parentId", statusCode: 400, code: "INVALID_PARENT_ID" });
    }

    const normalizedParentId = parentId || null;
    const siblings = await prisma.productCategory.findMany({
      where: { parentId: normalizedParentId },
      select: { id: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
    if (siblings.length !== orderedIds.length) {
      throw new AppError({ message: "Reorder payload does not match sibling count", statusCode: 400, code: "INVALID_REORDER_PAYLOAD" });
    }
    const siblingIds = siblings.map((item) => item.id).sort();
    const requestedIds = [...orderedIds].sort();
    if (JSON.stringify(siblingIds) !== JSON.stringify(requestedIds)) {
      throw new AppError({ message: "Reorder payload must contain the exact sibling set", statusCode: 400, code: "INVALID_REORDER_PAYLOAD" });
    }

    await prisma.$transaction(
      orderedIds.map((id, index) => prisma.productCategory.update({ where: { id }, data: { sortOrder: index } }))
    );
    return { reordered: true, parentId: normalizedParentId, orderedIds };
  }

  async getNestedCategories() {
    // Same shape as category.service.js#getNestedCategories: an inactive node drops its whole
    // subtree; a pending (provider-submitted) subcategory stays live, only flagged for review.
    const categories = await prisma.productCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });

    const top = [];
    const childrenByParent = new Map();
    for (const c of categories) {
      if (c.parentId) {
        if (!childrenByParent.has(c.parentId)) childrenByParent.set(c.parentId, []);
        childrenByParent.get(c.parentId).push(c);
      }
    }
    for (const c of categories) {
      if (!c.parentId) top.push(c);
    }

    const toDto = (c) => ({
      ...this.toDto(c),
      children: (childrenByParent.get(c.id) ?? []).map((child) => toDto(child))
    });

    return { items: top.map((c) => toDto(c)), total: categories.length };
  }

  async listRoots({ limit = 6 } = {}) {
    const normalizedLimit = Math.min(60, Math.max(1, Number(limit) || 6));
    const rows = await prisma.productCategory.findMany({
      where: { parentId: null, isActive: true, moderationStatus: "approved" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: normalizedLimit
    });
    return { items: rows.map((r) => this.toDto(r)), total: rows.length };
  }

  toDto(category) {
    return {
      id: category.id,
      name: category.name,
      parentId: category.parentId ?? null,
      imageUrl: category.imageUrl ?? null,
      isActive: category.isActive ?? true,
      moderationStatus: category.moderationStatus ?? "approved",
      createdByProviderId: category.createdByProviderId ?? null,
      sortOrder: category.sortOrder ?? 0,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt
    };
  }

  async getNextSortOrder(parentId) {
    const currentMax = await prisma.productCategory.aggregate({ where: { parentId }, _max: { sortOrder: true } });
    return (currentMax._max.sortOrder ?? -1) + 1;
  }
}
