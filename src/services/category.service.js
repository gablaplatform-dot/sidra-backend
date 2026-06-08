import { AppError } from "../utils/AppError.js";
import { prisma } from "../config/db.js";

const uniqueError = (e) => e?.code === "P2002";

export class CategoryService {
  async createCategory({ name, behavior = "general", viewType = "directory", appView, providerFields = [], listingFields = [], settings = {} }) {
    try {
      const sortOrder = await this.getNextSortOrder(null);
      const created = await prisma.category.create({
        data: { name, parentId: null, behavior, viewType, appView: appView ?? viewType, providerFields, listingFields, settings, sortOrder }
      });
      return this.toDto(created);
    } catch (e) {
      if (uniqueError(e)) {
        throw new AppError({ message: "Category already exists", statusCode: 409, code: "CATEGORY_EXISTS" });
      }
      throw e;
    }
  }

  async createSubcategory({ name, parentId, behavior, viewType, appView, providerFields, listingFields, settings }) {
    if (!parentId) {
      throw new AppError({ message: "Invalid parentId", statusCode: 400, code: "INVALID_PARENT_ID" });
    }

    const parent = await prisma.category.findUnique({ where: { id: parentId } });
    if (!parent) {
      throw new AppError({ message: "Parent category not found", statusCode: 404, code: "CATEGORY_NOT_FOUND" });
    }
    if (parent.parentId) {
      throw new AppError({ message: "Parent must be a top-level category", statusCode: 400, code: "INVALID_PARENT" });
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
          providerFields: providerFields ?? parent.providerFields ?? [],
          listingFields: listingFields ?? parent.listingFields ?? [],
          settings: settings ?? parent.settings ?? {},
          sortOrder
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

  async updateCategory({ id, name, parentId, behavior, viewType, appView, providerFields, listingFields, settings }) {
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
    if (parentId !== undefined) {
      if (parentId !== null && parentId !== "" && typeof parentId !== "string") {
        throw new AppError({ message: "Invalid parentId", statusCode: 400, code: "INVALID_PARENT_ID" });
      }

      if (parentId) {
        const parent = await prisma.category.findUnique({ where: { id: parentId } });
        if (!parent) {
          throw new AppError({ message: "Parent category not found", statusCode: 404, code: "CATEGORY_NOT_FOUND" });
        }
        if (parent.parentId) {
          throw new AppError({ message: "Parent must be a top-level category", statusCode: 400, code: "INVALID_PARENT" });
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

    await prisma.$transaction([
      prisma.category.deleteMany({ where: { parentId: id } }),
      prisma.category.delete({ where: { id } })
    ]);
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

  async getNestedCategories() {
    const categories = await prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });

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

    const toDto = (c) => {
      const id = c.id;
      const children = childrenByParent.get(id) ?? [];
      return {
        ...this.toDto(c),
        children: children.map(toDto),
      };
    };

    return {
      items: top.map(toDto),
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
      sortOrder: category.sortOrder ?? 0,
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
}
