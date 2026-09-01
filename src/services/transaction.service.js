import { AppError } from "../utils/AppError.js";
import { prisma } from "../config/db.js";

const normalizeStatusFilter = (status) => {
  if (!status) return null;
  const s = String(status).toLowerCase();
  if (s === "completed") return "succeeded";
  if (["pending", "succeeded", "failed", "canceled", "refunded"].includes(s)) return s;
  throw new AppError({ message: "Invalid status", statusCode: 400, code: "INVALID_STATUS" });
};

const normalizeTypeFilter = (type) => {
  if (!type) return null;
  const t = String(type).toLowerCase();
  if (["subscription", "contact_unlock", "purchase", "withdrawal", "platform_withdrawal", "cart_purchase", "ride_trip"].includes(t)) return t;
  throw new AppError({ message: "Invalid type", statusCode: 400, code: "INVALID_TYPE" });
};

const toDisplayStatus = (status) => {
  if (status === "succeeded") return "completed";
  return status;
};

const decToString = (v) => (v ? v.toString() : "0.00");

export class TransactionService {
  async adminList({
    page = 1,
    limit = 50,
    status,
    type,
    userId,
    providerId,
    from,
    to,
    sort = "newest"
  }) {
    const normalizedPage = Math.max(1, Number(page) || 1);
    const normalizedLimit = Math.min(200, Math.max(1, Number(limit) || 50));
    const skip = (normalizedPage - 1) * normalizedLimit;

    const filter = {};

    const statusFilter = normalizeStatusFilter(status);
    if (statusFilter) filter.status = statusFilter;

    const typeFilter = normalizeTypeFilter(type);
    if (typeFilter) filter.type = typeFilter;

    if (userId !== undefined) {
      if (userId === null || userId === "") {
        filter.userId = null;
      } else {
        filter.userId = userId;
      }
    }

    if (providerId !== undefined) {
      if (providerId === null || providerId === "") {
        filter.providerId = null;
      } else {
        filter.providerId = providerId;
      }
    }

    if (from || to) {
      const createdAt = {};
      if (from) {
        const d = new Date(from);
        if (Number.isNaN(d.getTime())) {
          throw new AppError({ message: "Invalid from", statusCode: 400, code: "INVALID_FROM" });
        }
        createdAt.gte = d;
      }
      if (to) {
        const d = new Date(to);
        if (Number.isNaN(d.getTime())) {
          throw new AppError({ message: "Invalid to", statusCode: 400, code: "INVALID_TO" });
        }
        createdAt.lte = d;
      }
      filter.createdAt = createdAt;
    }

    const normalizedSort = String(sort ?? "newest").toLowerCase();
    const orderBy =
      normalizedSort === "oldest"
        ? [{ createdAt: "asc" }]
        : normalizedSort === "amount"
          ? [{ amount: "desc" }, { createdAt: "desc" }]
          : [{ createdAt: "desc" }];

    const [items, total] = await Promise.all([
      prisma.transaction.findMany({ where: filter, orderBy, skip, take: normalizedLimit }),
      prisma.transaction.count({ where: filter })
    ]);

    return {
      items: items.map((t) => ({
        id: t.id,
        type: t.type,
        status: toDisplayStatus(t.status),
        rawStatus: t.status,
        userId: t.userId ?? null,
        providerId: t.providerId ?? null,
        amount: decToString(t.amount),
        fee: decToString(t.fee),
        netAmount: decToString(t.netAmount),
        metadata: t.metadata ?? {},
        createdAt: t.createdAt,
        updatedAt: t.updatedAt
      })),
      page: normalizedPage,
      limit: normalizedLimit,
      total
    };
  }
}
