import { prisma } from "../config/db.js";
import { bestScore, textScore } from "../utils/search.js";

const CATEGORY_MATCH_THRESHOLD = 0.5;
const RESULT_THRESHOLD = 0.45;
const CATEGORY_INHERIT_BOOST = 0.5;

export class SearchService {
  constructor({ aiSearchService } = {}) {
    this.aiSearchService = aiSearchService ?? null;
  }

  async search({ q, limit = 8 }) {
    const query = String(q ?? "").trim();
    if (!query) {
      return { query: "", categories: [], providers: [], listings: [] };
    }

    const normalizedLimit = Math.min(20, Math.max(1, Number(limit) || 8));

    // Loosely-worded queries ("I want to eat") rarely share a literal word with a listing
    // name; the AI expands them into object terms and specific category ids, scored below
    // alongside the literal match so a bad/slow AI call only ever loses the extra recall.
    const ai = await this.aiSearchService?.expand(query);
    const aiTerms = ai?.terms ?? [];
    const aiNameScore = (name) => (aiTerms.length ? Math.max(0, ...aiTerms.map((term) => textScore(term, name))) : 0);
    // "serviceCategoryIds"/"listingServiceCategoryIds" both resolve to directory Category ids
    // (provider.categoryId / listing.categoryId share that id space); "productCategoryIds" is
    // the separate product-category id space a listing's own productCategoryId lives in.
    const aiDirectoryCategoryIds = new Set([...(ai?.serviceCategoryIds ?? []), ...(ai?.listingServiceCategoryIds ?? [])]);
    const aiProductCategoryIds = new Set(ai?.productCategoryIds ?? []);

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
          productCategoryId: true,
          providerId: true,
          media: true,
          provider: { select: { businessName: true, categoryId: true, isApproved: true, moderationStatus: true } }
        }
      })
    ]);

    // Categories match on their own name, admin-configured search aliases (e.g. "wash my
    // car" -> the "Car Wash" category), or an AI-resolved term/category id - which is how
    // non-literal queries find the right shelf even with zero literal word overlap.
    const scoredCategories = categories
      .map((c) => {
        const aliases = Array.isArray(c.settings?.searchAliases) ? c.settings.searchAliases : [];
        const aiMatch = aiDirectoryCategoryIds.has(c.id) || aiProductCategoryIds.has(c.id) ? 1 : aiNameScore(c.name);
        return { ...c, score: Math.max(textScore(query, c.name), bestScore(query, aliases), aiMatch) };
      })
      .filter((c) => c.score >= CATEGORY_MATCH_THRESHOLD)
      .sort((a, b) => b.score - a.score);

    // A matched category also pulls in its direct subcategories, so providers/listings filed
    // one level down still surface even though the subcategory name itself didn't match.
    const matchedCategoryIds = new Set([...scoredCategories.map((c) => c.id), ...aiDirectoryCategoryIds]);
    for (const c of categories) {
      if (c.parentId && matchedCategoryIds.has(c.parentId)) matchedCategoryIds.add(c.id);
    }

    const scoredProviders = providers
      .map((p) => {
        let score = Math.max(textScore(query, p.businessName), textScore(query, p.description) * 0.6, aiNameScore(p.businessName));
        if (p.categoryId && matchedCategoryIds.has(p.categoryId)) score = Math.max(score, CATEGORY_INHERIT_BOOST);
        return { ...p, score };
      })
      .filter((p) => p.score >= RESULT_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, normalizedLimit);

    const scoredListings = listings
      .filter((l) => l.provider?.isApproved && l.provider?.moderationStatus === "approved")
      .map((l) => {
        let score = Math.max(textScore(query, l.name), textScore(query, l.description) * 0.6, aiNameScore(l.name));
        const effectiveCategoryId = l.categoryId || l.provider?.categoryId;
        if (effectiveCategoryId && matchedCategoryIds.has(effectiveCategoryId)) score = Math.max(score, CATEGORY_INHERIT_BOOST);
        if (l.productCategoryId && aiProductCategoryIds.has(l.productCategoryId)) score = Math.max(score, CATEGORY_INHERIT_BOOST);
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
