import { AppError } from "../utils/AppError.js";
import { prisma } from "../config/db.js";
import { CategoryBehavior, CategoryModerationStatus, CategoryViewType } from "../constants/enums.js";

const uniqueError = (e) => e?.code === "P2002";

export class CategoryService {
  async createCategory({ name, behavior = "general", viewType = "directory", appView, providerFields = [], listingFields = [], settings = {}, isActive, imageUrl }) {
    try {
      const sortOrder = await this.getNextSortOrder(null);
      const created = await prisma.category.create({
        data: { name, parentId: null, behavior, viewType, appView: appView ?? viewType, providerFields, listingFields, settings, sortOrder, isActive: isActive ?? true, imageUrl: imageUrl ?? null }
      });
      return this.toDto(created);
    } catch (e) {
      if (uniqueError(e)) {
        throw new AppError({ message: "Category already exists", statusCode: 409, code: "CATEGORY_EXISTS" });
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

  async createFromProvider({ actorUserId, name, parentId, imageUrl }) {
    const provider = await this.getProviderForUser(actorUserId);

    let parent = null;
    if (parentId) {
      parent = await prisma.category.findUnique({ where: { id: parentId } });
      if (!parent) {
        throw new AppError({ message: "Parent category not found", statusCode: 404, code: "CATEGORY_NOT_FOUND" });
      }
    }

    try {
      const sortOrder = await this.getNextSortOrder(parentId ?? null);
      const created = await prisma.category.create({
        data: {
          name,
          parentId: parentId ?? null,
          behavior: parent?.behavior ?? CategoryBehavior.ONLINE_SHOP,
          viewType: parent?.viewType ?? CategoryViewType.ECOMMERCE,
          appView: parent?.appView ?? CategoryViewType.ECOMMERCE,
          settings: parent?.settings ?? {},
          isActive: true,
          moderationStatus: CategoryModerationStatus.PENDING,
          createdByProviderId: provider.id,
          sortOrder,
          imageUrl: imageUrl ?? parent?.imageUrl ?? null
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

  async createSubcategory({ name, parentId, behavior, viewType, appView, providerFields, listingFields, settings, isActive, imageUrl }) {
    if (!parentId) {
      throw new AppError({ message: "Invalid parentId", statusCode: 400, code: "INVALID_PARENT_ID" });
    }

    const parent = await prisma.category.findUnique({ where: { id: parentId } });
    if (!parent) {
      throw new AppError({ message: "Parent category not found", statusCode: 404, code: "CATEGORY_NOT_FOUND" });
    }

    try {
      const sortOrder = await this.getNextSortOrder(parentId);
      const created = await prisma.category.create({
        data: {
          name,
          parentId,
          behavior: behavior ?? parent.behavior ?? "general",
          viewType: viewType ?? parent.viewType ?? "directory",
          appView: appView ?? viewType ?? parent.appView ?? parent.viewType ?? "directory",
          providerFields: providerFields ?? [],
          listingFields: listingFields ?? [],
          settings: settings ?? parent.settings ?? {},
          isActive: isActive ?? true,
          sortOrder,
          imageUrl: imageUrl ?? parent.imageUrl ?? null
        }
      });
      return this.toDto(created);
    } catch (e) {
      if (uniqueError(e)) {
        throw new AppError({
          message: "Subcategory already exists",
          statusCode: 409,
          code: "SUBCATEGORY_EXISTS"
        });
      }
      throw e;
    }
  }

  async updateCategory({ id, name, parentId, behavior, viewType, appView, providerFields, listingFields, settings, isActive, moderationStatus, imageUrl }) {
    if (!id) {
      throw new AppError({ message: "Invalid id", statusCode: 400, code: "INVALID_CATEGORY_ID" });
    }

    const update = {};
    if (name !== undefined) update.name = name;
    if (behavior !== undefined) update.behavior = behavior;
    if (viewType !== undefined) update.viewType = viewType;
    if (appView !== undefined) update.appView = appView;
    if (providerFields !== undefined) update.providerFields = providerFields;
    if (listingFields !== undefined) update.listingFields = listingFields;
    if (settings !== undefined) update.settings = settings ?? {};
    if (isActive !== undefined) update.isActive = isActive;
    if (moderationStatus !== undefined) update.moderationStatus = moderationStatus;
    if (imageUrl !== undefined) update.imageUrl = imageUrl === null ? null : imageUrl;
    if (parentId !== undefined) {
      if (parentId !== null && parentId !== "" && typeof parentId !== "string") {
        throw new AppError({ message: "Invalid parentId", statusCode: 400, code: "INVALID_PARENT_ID" });
      }

      if (parentId) {
        if (parentId === id) {
          throw new AppError({ message: "Category cannot be its own parent", statusCode: 400, code: "INVALID_PARENT" });
        }
        const parent = await prisma.category.findUnique({ where: { id: parentId } });
        if (!parent) {
          throw new AppError({ message: "Parent category not found", statusCode: 404, code: "CATEGORY_NOT_FOUND" });
        }

        const pairs = await prisma.category.findMany({ select: { id: true, parentId: true } });
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
      const updated = await prisma.category.update({ where: { id }, data: update });
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

    const cat = await prisma.category.findUnique({ where: { id } });
    if (!cat) {
      throw new AppError({ message: "Category not found", statusCode: 404, code: "CATEGORY_NOT_FOUND" });
    }

    const subcategoryCount = await prisma.category.count({ where: { parentId: id } });
    if (subcategoryCount > 0) {
      throw new AppError({
        message: "This category has subcategories. Delete or move them first.",
        statusCode: 409,
        code: "CATEGORY_HAS_SUBCATEGORIES"
      });
    }

    await prisma.category.delete({ where: { id } });
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
    const siblings = await prisma.category.findMany({
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
      orderedIds.map((id, index) =>
        prisma.category.update({
          where: { id },
          data: { sortOrder: index }
        })
      )
    );

    return { reordered: true, parentId: normalizedParentId, orderedIds };
  }

  async getNestedCategories({ viewType } = {}) {
    // Public-facing tree: an inactive category is dropped along with its entire subtree, since
    // an inactive parent never makes it into `top` for its active children to be nested under.
    // A pending (provider-created) category is NOT excluded here - it's meant to be live for
    // users right away, only flagged for admin review elsewhere.
    const categories = await prisma.category.findMany({
      where: { isActive: true, ...(viewType ? { viewType } : {}) },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });

    const byId = new Map(categories.map((c) => [c.id, c]));
    const top = [];
    const childrenByParent = new Map();

    for (const c of categories) {
      if (c.parentId) {
        const pid = c.parentId;
        if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
        childrenByParent.get(pid).push(c);
      }
    }

    for (const c of categories) {
      if (!c.parentId) top.push(c);
    }

    // A field a subcategory defines with the same key as an ancestor's overrides that
    // ancestor's definition (e.g. to tighten `required` or change `options`) rather than
    // showing twice; a Map preserves the ancestor's original position when a later `set` on the
    // same key only updates its value, so inherited fields keep their order.
    const mergeFields = (inherited, own) => {
      const merged = new Map();
      for (const field of inherited) merged.set(field.key, field);
      for (const field of own) merged.set(field.key, field);
      return Array.from(merged.values());
    };

    const toDto = (c, inheritedProviderFields = [], inheritedListingFields = []) => {
      const id = c.id;
      const children = childrenByParent.get(id) ?? [];
      const ownProviderFields = Array.isArray(c.providerFields) ? c.providerFields : [];
      const ownListingFields = Array.isArray(c.listingFields) ? c.listingFields : [];
      const effectiveProviderFields = mergeFields(inheritedProviderFields, ownProviderFields);
      const effectiveListingFields = mergeFields(inheritedListingFields, ownListingFields);
      return {
        ...this.toDto(c),
        effectiveProviderFields,
        effectiveListingFields,
        children: children.map((child) => toDto(child, effectiveProviderFields, effectiveListingFields)),
      };
    };

    return {
      items: top.map((c) => toDto(c)),
      total: byId.size
    };
  }

  toDto(category) {
    return {
      id: category.id,
      name: category.name,
      parentId: category.parentId ?? null,
      behavior: category.behavior ?? "general",
      viewType: category.viewType ?? "directory",
      appView: category.appView ?? category.viewType ?? "directory",
      providerFields: category.providerFields ?? [],
      listingFields: category.listingFields ?? [],
      settings: category.settings ?? {},
      isActive: category.isActive ?? true,
      moderationStatus: category.moderationStatus ?? "approved",
      createdByProviderId: category.createdByProviderId ?? null,
      sortOrder: category.sortOrder ?? 0,
      imageUrl: category.imageUrl ?? null,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt
    };
  }

  async getNextSortOrder(parentId) {
    const currentMax = await prisma.category.aggregate({
      where: { parentId },
      _max: { sortOrder: true }
    });
    return (currentMax._max.sortOrder ?? -1) + 1;
  }

  async publicListEcommerce({ limit = 6 } = {}) {
    const normalizedLimit = Math.min(60, Math.max(1, Number(limit) || 6));
    const rows = await prisma.category.findMany({
      where: {
        parentId: null,
        viewType: CategoryViewType.ECOMMERCE,
        isActive: true,
        moderationStatus: CategoryModerationStatus.APPROVED
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: normalizedLimit
    });
    return {
      items: rows.map((r) => this.toDto(r)),
      total: rows.length
    };
  }
}
