import { prisma } from "../config/db.js";
import { bestScore, textScore } from "../utils/search.js";

const CATEGORY_MATCH_THRESHOLD = 0.5;
const RESULT_THRESHOLD = 0.45;
const CATEGORY_INHERIT_BOOST = 0.5;

export class SearchService {
  async search({ q, limit = 8 }) {
    const query = String(q ?? "").trim();
    if (!query) {
      return { query: "", categories: [], providers: [], listings: [] };
    }

    const normalizedLimit = Math.min(20, Math.max(1, Number(limit) || 8));

    const [categories, providers, listings] = await Promise.all([
      prisma.category.findMany({
        where: { isActive: true },
        select: { id: true, name: true, parentId: true, viewType: true, settings: true }
      }),
      prisma.provider.findMany({
        where: { isApproved: true, moderationStatus: "approved" },
        select: {
          id: true,
          businessName: true,
          description: true,
          categoryId: true,
          media: true,
          ratingAvg: true,
          ratingCount: true
        }
      }),
      prisma.serviceProduct.findMany({
        where: { status: "approved" },
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          categoryId: true,
          providerId: true,
          media: true,
          provider: { select: { businessName: true, categoryId: true, isApproved: true, moderationStatus: true } }
        }
      })
    ]);

    // Categories match on their own name plus admin-configured search aliases (e.g. "wash my
    // car" -> the "Car Wash" category), which is how non-literal queries find the right shelf.
    const scoredCategories = categories
      .map((c) => {
        const aliases = Array.isArray(c.settings?.searchAliases) ? c.settings.searchAliases : [];
        return { ...c, score: Math.max(textScore(query, c.name), bestScore(query, aliases)) };
      })
      .filter((c) => c.score >= CATEGORY_MATCH_THRESHOLD)
      .sort((a, b) => b.score - a.score);

    // A matched category also pulls in its direct subcategories, so providers/listings filed
    // one level down still surface even though the subcategory name itself didn't match.
    const matchedCategoryIds = new Set(scoredCategories.map((c) => c.id));
    for (const c of categories) {
      if (c.parentId && matchedCategoryIds.has(c.parentId)) matchedCategoryIds.add(c.id);
    }

    const scoredProviders = providers
      .map((p) => {
        let score = Math.max(textScore(query, p.businessName), textScore(query, p.description) * 0.6);
        if (p.categoryId && matchedCategoryIds.has(p.categoryId)) score = Math.max(score, CATEGORY_INHERIT_BOOST);
        return { ...p, score };
      })
      .filter((p) => p.score >= RESULT_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, normalizedLimit);

    const scoredListings = listings
      .filter((l) => l.provider?.isApproved && l.provider?.moderationStatus === "approved")
      .map((l) => {
        let score = Math.max(textScore(query, l.name), textScore(query, l.description) * 0.6);
        const effectiveCategoryId = l.categoryId || l.provider?.categoryId;
        if (effectiveCategoryId && matchedCategoryIds.has(effectiveCategoryId)) score = Math.max(score, CATEGORY_INHERIT_BOOST);
        return { ...l, score };
      })
      .filter((l) => l.score >= RESULT_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, normalizedLimit);

    return {
      query,
      categories: scoredCategories.slice(0, normalizedLimit).map((c) => ({
        id: c.id,
        name: c.name,
        parentId: c.parentId ?? null,
        viewType: c.viewType
      })),
      providers: scoredProviders.map((p) => ({
        id: p.id,
        businessName: p.businessName,
        categoryId: p.categoryId ?? null,
        ratingAvg: p.ratingAvg,
        ratingCount: p.ratingCount,
        imageUrl: p.media?.coverUrl || p.media?.gallery?.[0] || null
      })),
      listings: scoredListings.map((l) => ({
        id: l.id,
        name: l.name,
        price: l.price,
        categoryId: l.categoryId ?? l.provider?.categoryId ?? null,
        providerId: l.providerId,
        providerName: l.provider?.businessName ?? null,
        imageUrl: l.media?.imageUrl || null
      }))
    };
  }
}
