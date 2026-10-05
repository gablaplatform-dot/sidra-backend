import { AppError } from "../utils/AppError.js";
import { prisma } from "../config/db.js";
import { haversineDistanceKm } from "../utils/geohash.js";

// Learns what a shopper cares about from what they actually do, and uses it to rank products for
// the "This can work for you" section. No ML dependency: it is a transparent, tunable scoring
// model over a short event history.
//
// Signals (weight): view 1, category browse 0.7, search 1.2, add to cart 3, order 5. Each is
// discounted by age (half-life 14 days) so recent interest wins, and everything older than 90
// days is ignored. A shopper's profile is: which categories (and parent categories), brands and
// search words they lean towards, and the price level they usually look at. Candidates are then
// scored on that plus popularity, freshness and nearness - and a per-category cap keeps the
// result from being twenty near-identical laptops.

const EVENT_TYPES = ["view", "category", "search", "cart", "order"];
const WEIGHTS = { view: 1, category: 0.7, search: 1.2, cart: 3, order: 5 };
const HALF_LIFE_DAYS = 14;
const WINDOW_DAYS = 90;
const MAX_EVENTS_READ = 600;
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_CATEGORY = 3;
const STOP_WORDS = new Set(["the", "and", "for", "with", "buy", "new", "used", "cheap", "best", "price", "near", "sale", "in", "of", "a", "to", "uganda", "kampala"]);

const decay = (createdAt) => 0.5 ** ((Date.now() - new Date(createdAt).getTime()) / 86400000 / HALF_LIFE_DAYS);
const bump = (map, key, value) => map.set(key, (map.get(key) ?? 0) + value);
const tokens = (text) =>
  String(text ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));

const actorWhere = ({ userId, deviceId }) => {
  const or = [];
  if (userId) or.push({ userId });
  if (deviceId) or.push({ deviceId });
  return or.length ? { OR: or } : null;
};

export class InterestService {
  constructor({ listingService }) {
    this.listingService = listingService;
  }

  async track({ userId, deviceId, type, listingId, productCategoryId, query }) {
    if (!userId && !deviceId) return { tracked: false };
    if (!EVENT_TYPES.includes(type)) {
      throw new AppError({ message: "Invalid event type", statusCode: 400, code: "INVALID_EVENT_TYPE" });
    }
    const actor = { userId, deviceId };

    let data = { userId: userId ?? null, deviceId: deviceId ?? null, type, meta: {} };
    if (listingId) {
      // Everything about the listing comes from the database, never from the client.
      const listing = await prisma.serviceProduct.findUnique({
        where: { id: listingId },
        include: { provider: { select: { id: true, district: true } } }
      });
      if (!listing || listing.status !== "approved") return { tracked: false };
      const brand = this._brandOf(listing.customFields);
      data = {
        ...data,
        listingId: listing.id,
        productCategoryId: listing.productCategoryId,
        providerId: listing.providerId,
        meta: { name: listing.name, price: Number(listing.price) || 0, ...(brand ? { brand } : {}), ...(listing.provider?.district ? { district: listing.provider.district } : {}) }
      };
    } else if (type === "category") {
      const category = productCategoryId ? await prisma.productCategory.findUnique({ where: { id: productCategoryId }, select: { id: true, name: true } }) : null;
      if (!category) return { tracked: false };
      data = { ...data, productCategoryId: category.id, meta: { name: category.name } };
    } else if (type === "search") {
      const text = String(query ?? "").trim().slice(0, 80);
      if (text.length < 2) return { tracked: false };
      data = { ...data, query: text };
    } else {
      return { tracked: false };
    }

    // The same thing repeated within minutes (refresh, back/forward) is one signal, not many.
    const recent = await prisma.interestEvent.findFirst({
      where: {
        ...actorWhere(actor),
        type,
        createdAt: { gte: new Date(Date.now() - DEDUPE_WINDOW_MS) },
        ...(data.listingId ? { listingId: data.listingId } : {}),
        ...(type === "category" ? { productCategoryId: data.productCategoryId } : {}),
        ...(type === "search" ? { query: data.query } : {})
      },
      select: { id: true }
    });
    if (recent) return { tracked: false, deduped: true };

    await prisma.interestEvent.create({ data });
    if (Math.random() < 0.05) this._prune(actor).catch(() => {});
    return { tracked: true };
  }

  async _prune(actor) {
    const where = actorWhere(actor);
    if (!where) return;
    await prisma.interestEvent.deleteMany({ where: { ...where, createdAt: { lt: new Date(Date.now() - 120 * 86400000) } } });
    const total = await prisma.interestEvent.count({ where });
    if (total > 1500) {
      const cutoff = await prisma.interestEvent.findMany({ where, orderBy: { createdAt: "desc" }, skip: 1000, take: 1, select: { createdAt: true } });
      if (cutoff[0]) await prisma.interestEvent.deleteMany({ where: { ...where, createdAt: { lte: cutoff[0].createdAt } } });
    }
  }

  // Anonymous history becomes the account's history at sign-in.
  async claim({ userId, deviceId }) {
    if (!userId || !deviceId) return { claimed: 0 };
    const result = await prisma.interestEvent.updateMany({ where: { deviceId, userId: null }, data: { userId } });
    return { claimed: result.count };
  }

  async clear({ userId, deviceId }) {
    const where = actorWhere({ userId, deviceId });
    if (!where) return { cleared: 0 };
    const result = await prisma.interestEvent.deleteMany({ where });
    return { cleared: result.count };
  }

  _brandOf(customFields) {
    const raw = customFields?.brand ?? customFields?.make;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return typeof value === "string" && value.length <= 40 ? value : null;
  }

  async _categories() {
    const rows = await prisma.productCategory.findMany({ select: { id: true, name: true, parentId: true, imageUrl: true } });
    return new Map(rows.map((r) => [r.id, r]));
  }

  // Turns raw events into a taste profile.
  async buildProfile(actor) {
    const where = actorWhere(actor);
    if (!where) return this._emptyProfile();
    const events = await prisma.interestEvent.findMany({
      where: { ...where, createdAt: { gte: new Date(Date.now() - WINDOW_DAYS * 86400000) } },
      orderBy: { createdAt: "desc" },
      take: MAX_EVENTS_READ
    });
    if (!events.length) return this._emptyProfile();

    const categories = await this._categories();
    const categoryScore = new Map(); // direct interest in a category
    const rolledScore = new Map(); // same, shared up the tree so a parent reflects its children
    const brandScore = new Map();
    const wordScore = new Map();
    const prices = [];
    const searches = [];
    const viewed = [];
    const touched = new Set(); // listings already carted / ordered

    for (const event of events) {
      const weight = (WEIGHTS[event.type] ?? 0) * decay(event.createdAt);
      if (event.productCategoryId) {
        bump(categoryScore, event.productCategoryId, weight);
        let share = weight;
        for (let node = categories.get(event.productCategoryId); node; node = node.parentId ? categories.get(node.parentId) : null) {
          bump(rolledScore, node.id, share);
          share *= 0.5;
        }
      }
      if (event.meta?.brand) bump(brandScore, event.meta.brand, weight);
      if (event.type === "search" && event.query) {
        if (!searches.some((q) => q.toLowerCase() === event.query.toLowerCase())) searches.push(event.query);
        for (const word of tokens(event.query)) bump(wordScore, word, weight);
      }
      if (event.listingId && ["view", "cart", "order"].includes(event.type)) {
        if (event.meta?.price > 0) prices.push({ price: event.meta.price, weight });
        if (event.type === "view" && !viewed.includes(event.listingId)) viewed.push(event.listingId);
        if (event.type !== "view") touched.add(event.listingId);
      }
    }

    // Typical price level: a weighted geometric mean (so one very expensive glance doesn't drag it).
    let priceCenter = null;
    const priceWeight = prices.reduce((sum, p) => sum + p.weight, 0);
    if (priceWeight > 0) priceCenter = Math.exp(prices.reduce((sum, p) => sum + Math.log(p.price) * p.weight, 0) / priceWeight);

    return {
      hasSignals: true,
      eventCount: events.length,
      categoryScore,
      rolledScore,
      brandScore,
      wordScore,
      priceCenter,
      searches: searches.slice(0, 8),
      viewed: viewed.slice(0, 12),
      touched,
      categories
    };
  }

  _emptyProfile() {
    return { hasSignals: false, eventCount: 0, categoryScore: new Map(), rolledScore: new Map(), brandScore: new Map(), wordScore: new Map(), priceCenter: null, searches: [], viewed: [], touched: new Set(), categories: new Map() };
  }

  _topEntries(map, n) {
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  }

  _descendants(categories, rootId) {
    const ids = [rootId];
    for (let i = 0; i < ids.length; i += 1) {
      for (const c of categories.values()) if (c.parentId === ids[i]) ids.push(c.id);
    }
    return ids;
  }

  async forYou({ userId, deviceId, district, lat, lng, limit = 12 }) {
    const take = Math.min(24, Math.max(1, Number(limit) || 12));
    const profile = await this.buildProfile({ userId, deviceId });
    const { categories } = profile.hasSignals ? profile : { categories: await this._categories() };

    // ---- candidate pool: interests first, then popular items to fill and to cover cold starts
    const interestCats = this._topEntries(profile.categoryScore, 4).map(([id]) => id);
    const scopeIds = new Set();
    for (const id of interestCats) {
      const parentId = categories.get(id)?.parentId;
      for (const x of this._descendants(categories, parentId ?? id)) scopeIds.add(x);
    }
    const topWords = this._topEntries(profile.wordScore, 3).map(([w]) => w);

    const baseWhere = { status: "approved", type: "product", provider: { isApproved: true, moderationStatus: "approved" } };
    const or = [];
    if (scopeIds.size) or.push({ productCategoryId: { in: [...scopeIds] } });
    for (const word of topWords) or.push({ name: { contains: word } });
    const include = { provider: { select: { id: true, businessName: true, onlinePaymentsEnabled: true, district: true, lat: true, lng: true } } };

    const [interestPool, popularPool] = await Promise.all([
      or.length ? prisma.serviceProduct.findMany({ where: { ...baseWhere, OR: or }, include, orderBy: [{ createdAt: "desc" }], take: 250 }) : [],
      prisma.serviceProduct.findMany({ where: baseWhere, include, orderBy: [{ soldCount: "desc" }, { viewCount: "desc" }], take: 80 })
    ]);
    const pool = new Map();
    for (const item of [...interestPool, ...popularPool]) pool.set(item.id, item);

    // ---- scoring
    const maxCat = Math.max(0.0001, ...profile.rolledScore.values(), 0);
    const maxBrand = Math.max(0.0001, ...profile.brandScore.values(), 0);
    const wordHits = (name) => topWords.filter((w) => name.toLowerCase().includes(w));
    const skip = new Set([...profile.viewed.slice(0, 12), ...profile.touched]);
    const origin = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) ? { lat: Number(lat), lng: Number(lng) } : null;

    const scored = [];
    for (const item of pool.values()) {
      if (skip.has(item.id)) continue;
      const parts = [];
      const add = (kind, value, label) => value > 0 && parts.push({ kind, value, label });

      const catValue = (profile.rolledScore.get(item.productCategoryId) ?? 0) / maxCat;
      const catName = categories.get(item.productCategoryId)?.name;
      add("category", catValue * 40, catName ? `Because you looked at ${catName}` : null);

      const brand = this._brandOf(item.customFields);
      if (brand && profile.brandScore.has(brand)) add("brand", (profile.brandScore.get(brand) / maxBrand) * 15, `More ${brand}`);

      const hits = wordHits(item.name);
      if (hits.length) add("search", 12, `Matches your search for "${hits[0]}"`);

      const price = Number(item.price) || 0;
      if (profile.priceCenter && price > 0) {
        const off = Math.abs(Math.log(price / profile.priceCenter)) / Math.log(3);
        add("price", Math.max(0, 1 - off) * 15, "In your usual price range");
      }

      add("popular", Math.min(Number(item.soldCount) || 0, 50) / 50 * 6 + Math.min(Number(item.viewCount) || 0, 1000) / 1000 * 4 + (item.featured ? 3 : 0), null);
      if (Date.now() - new Date(item.createdAt).getTime() < 14 * 86400000) add("fresh", 4, "New this fortnight");

      const sellerDistrict = item.provider?.district;
      if (district && sellerDistrict === district) add("near", 10, `Popular in ${district}`);
      else if (origin && item.provider?.lat != null) {
        const km = haversineDistanceKm(origin.lat, origin.lng, item.provider.lat, item.provider.lng);
        add("near", km <= 25 ? 8 : km <= 100 ? 4 : 0, "Near you");
      }

      const score = parts.reduce((sum, p) => sum + p.value, 0);
      const reasoned = parts.filter((p) => p.label).sort((a, b) => b.value - a.value)[0];
      scored.push({ item, score, reason: reasoned?.label ?? (district ? `Popular in ${district}` : "Popular right now") });
    }
    scored.sort((a, b) => b.score - a.score || new Date(b.item.createdAt) - new Date(a.item.createdAt));

    // ---- diversity: at most N per category in the picks, then top up with whatever is left
    const perCategory = new Map();
    const picked = [];
    const leftovers = [];
    for (const entry of scored) {
      const key = entry.item.productCategoryId ?? "none";
      if ((perCategory.get(key) ?? 0) < MAX_PER_CATEGORY) {
        perCategory.set(key, (perCategory.get(key) ?? 0) + 1);
        picked.push(entry);
      } else leftovers.push(entry);
      if (picked.length >= take) break;
    }
    for (const entry of leftovers) {
      if (picked.length >= take) break;
      picked.push(entry);
    }

    // ---- the other parts of the section
    const topCategories = this._topEntries(profile.categoryScore, 6).map(([id]) => {
      const c = categories.get(id);
      const parent = c?.parentId ? categories.get(c.parentId) : null;
      return c ? { id: c.id, name: c.name, parentName: parent?.name ?? null, imageUrl: c.imageUrl ?? null } : null;
    }).filter(Boolean);

    const viewedRows = profile.viewed.length
      ? await prisma.serviceProduct.findMany({
          where: { id: { in: profile.viewed }, status: "approved", provider: { isApproved: true, moderationStatus: "approved" } },
          include
        })
      : [];
    const recentlyViewed = profile.viewed.map((id) => viewedRows.find((r) => r.id === id)).filter(Boolean).slice(0, 10);

    return {
      personalized: profile.hasSignals,
      headline: this._headline(topCategories, profile.searches),
      items: picked.map(({ item, reason }) => ({ ...this.listingService.toDto(item, item.provider), reason })),
      categories: topCategories,
      recentSearches: profile.searches,
      recentlyViewed: recentlyViewed.map((item) => this.listingService.toDto(item, item.provider))
    };
  }

  _headline(categories, searches) {
    if (!categories.length && !searches.length) return null;
    const names = categories.slice(0, 3).map((c) => c.name);
    if (names.length) return `Based on your interest in ${names.slice(0, -1).join(", ")}${names.length > 1 ? " and " : ""}${names[names.length - 1]}`;
    return `Based on your search for "${searches[0]}"`;
  }
}
