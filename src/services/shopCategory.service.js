import { AppError } from "../utils/AppError.js";
import { prisma } from "../config/db.js";

const uniqueError = (e) => e?.code === "P2002";

export class ShopCategoryService {
  async getProviderForUser(userId) {
    const provider = await prisma.provider.findUnique({ where: { userId } });
    if (!provider) {
      throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    }
    return provider;
  }

  async getNextSortOrder(providerId, parentId) {
    const currentMax = await prisma.shopCategory.aggregate({
      where: { providerId, parentId },
      _max: { sortOrder: true }
    });
    return (currentMax._max.sortOrder ?? -1) + 1;
  }

  buildTree(categories) {
    const byParent = new Map();
    for (const c of categories) {
      const pid = c.parentId ?? null;
      if (!byParent.has(pid)) byParent.set(pid, []);
      byParent.get(pid).push(c);
    }
    const toDto = (c) => ({
      ...this.toDto(c),
      children: (byParent.get(c.id) ?? []).map(toDto)
    });
    return (byParent.get(null) ?? []).map(toDto);
  }

  toDto(category) {
    return {
      id: category.id,
      providerId: category.providerId,
      parentId: category.parentId ?? null,
      name: category.name,
      sortOrder: category.sortOrder ?? 0,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt
    };
  }

  async listMine({ actorUserId }) {
    const provider = await this.getProviderForUser(actorUserId);
    const categories = await prisma.shopCategory.findMany({
      where: { providerId: provider.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
    return { items: this.buildTree(categories), total: categories.length };
  }

  async listForProvider({ providerId }) {
    if (!providerId) {
      throw new AppError({ message: "Invalid providerId", statusCode: 400, code: "INVALID_PROVIDER_ID" });
    }
    const provider = await prisma.provider.findUnique({ where: { id: providerId } });
    if (!provider || !provider.isApproved || provider.moderationStatus !== "approved") {
      throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    }
    const categories = await prisma.shopCategory.findMany({
      where: { providerId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
    return { items: this.buildTree(categories), total: categories.length };
  }

  async assertOwnedByProvider({ id, providerId }) {
    const category = await prisma.shopCategory.findUnique({ where: { id } });
    if (!category || category.providerId !== providerId) {
      throw new AppError({ message: "Shop category not found", statusCode: 404, code: "SHOP_CATEGORY_NOT_FOUND" });
    }
    return category;
  }

  async create({ actorUserId, name, parentId }) {
    const provider = await this.getProviderForUser(actorUserId);

    let normalizedParentId = null;
    if (parentId) {
      const parent = await this.assertOwnedByProvider({ id: parentId, providerId: provider.id });
      normalizedParentId = parent.id;
    }

    try {
      const sortOrder = await this.getNextSortOrder(provider.id, normalizedParentId);
      const created = await prisma.shopCategory.create({
        data: { providerId: provider.id, parentId: normalizedParentId, name, sortOrder }
      });
      return this.toDto(created);
    } catch (e) {
      if (uniqueError(e)) {
        throw new AppError({ message: "You already have a category with this name here", statusCode: 409, code: "SHOP_CATEGORY_EXISTS" });
      }
      throw e;
    }
  }

  async update({ actorUserId, id, name, parentId }) {
    const provider = await this.getProviderForUser(actorUserId);
    await this.assertOwnedByProvider({ id, providerId: provider.id });

    const update = {};
    if (name !== undefined) update.name = name;

    if (parentId !== undefined) {
      if (parentId === null || parentId === "") {
        update.parentId = null;
      } else {
        if (parentId === id) {
          throw new AppError({ message: "A category cannot be its own parent", statusCode: 400, code: "INVALID_PARENT" });
        }
        await this.assertOwnedByProvider({ id: parentId, providerId: provider.id });

        const siblings = await prisma.shopCategory.findMany({
          where: { providerId: provider.id },
          select: { id: true, parentId: true }
        });
        const parentById = new Map(siblings.map((c) => [c.id, c.parentId ?? null]));
        let current = parentId;
        while (current) {
          if (current === id) {
            throw new AppError({ message: "Invalid parent (cycle detected)", statusCode: 400, code: "INVALID_PARENT" });
          }
          current = parentById.get(current) ?? null;
        }
        update.parentId = parentId;
      }
    }

    try {
      const updated = await prisma.shopCategory.update({ where: { id }, data: update });
      return this.toDto(updated);
    } catch (e) {
      if (uniqueError(e)) {
        throw new AppError({ message: "You already have a category with this name here", statusCode: 409, code: "SHOP_CATEGORY_EXISTS" });
      }
      throw e;
    }
  }

  async remove({ actorUserId, id }) {
    const provider = await this.getProviderForUser(actorUserId);
    await this.assertOwnedByProvider({ id, providerId: provider.id });

    const childCount = await prisma.shopCategory.count({ where: { parentId: id } });
    if (childCount > 0) {
      throw new AppError({
        message: "This category has subcategories. Delete or move them first.",
        statusCode: 409,
        code: "SHOP_CATEGORY_HAS_CHILDREN"
      });
    }

    // SQLite's ON DELETE SET NULL only fires if the connection has foreign key enforcement
    // active, which Prisma's SQLite connector does not guarantee here - so this is done
    // explicitly rather than relying on the schema's onDelete: SetNull actually firing.
    await prisma.$transaction([
      prisma.serviceProduct.updateMany({ where: { shopCategoryId: id }, data: { shopCategoryId: null } }),
      prisma.shopCategory.delete({ where: { id } })
    ]);
    return { deleted: true };
  }

  async reorder({ actorUserId, parentId = null, orderedIds = [] }) {
    const provider = await this.getProviderForUser(actorUserId);
    if (!Array.isArray(orderedIds) || !orderedIds.length) {
      throw new AppError({ message: "orderedIds is required", statusCode: 400, code: "INVALID_ORDERED_IDS" });
    }

    const normalizedParentId = parentId || null;
    const siblings = await prisma.shopCategory.findMany({
      where: { providerId: provider.id, parentId: normalizedParentId },
      select: { id: true }
    });

    if (siblings.length !== orderedIds.length) {
      throw new AppError({ message: "Reorder payload does not match sibling count", statusCode: 400, code: "INVALID_REORDER_PAYLOAD" });
    }
    const siblingIds = siblings.map((c) => c.id).sort();
    const requestedIds = [...orderedIds].sort();
    if (JSON.stringify(siblingIds) !== JSON.stringify(requestedIds)) {
      throw new AppError({ message: "Reorder payload must contain the exact sibling set", statusCode: 400, code: "INVALID_REORDER_PAYLOAD" });
    }

    await prisma.$transaction(
      orderedIds.map((id, index) => prisma.shopCategory.update({ where: { id }, data: { sortOrder: index } }))
    );

    return { reordered: true, parentId: normalizedParentId, orderedIds };
  }
}
