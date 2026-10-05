// Seeds 10 demo providers with ~140 approved product listings (real photos, per-category custom
// fields, spread across 8 districts) plus a few hero ads, for presenting/testing the Jiji-style
// Shop browse page. Everything is owned by users on the DEMO_EMAIL_DOMAIN, so:
//
//   node scripts/seed-demo-marketplace.js            seed (replaces any previous demo data)
//   node scripts/seed-demo-marketplace.js --dry-run  validate the catalog against the category
//                                                    field options, write nothing
//   node scripts/seed-demo-marketplace.js --clear    remove every demo provider, listing and ad
//
// Requires the ProductCategory tree to exist first (scripts/seed-jiji-product-categories.js).
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

import { geohashEncode } from "../src/utils/geohash.js";
import { PromotionType } from "../src/constants/enums.js";
import { ADS, DEMO_EMAIL_DOMAIN, PROVIDERS } from "./demo-marketplace/catalog.js";
import { imageUrl, pickImages } from "./demo-marketplace/images.js";

dotenv.config();
const prisma = new PrismaClient();

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const CLEAR_ONLY = args.has("--clear");

const log = (message) => process.stdout.write(`${message}\n`);

const demoEmail = (key) => `demo-${key}@${DEMO_EMAIL_DOMAIN}`;

// Small deterministic generator so re-seeding yields identical data (same ages, counts, stock).
const rng = (seed) => {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

async function clearDemoData() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } },
    select: { id: true, provider: { select: { id: true } } }
  });
  const providerIds = users.map((u) => u.provider?.id).filter(Boolean);
  // Promotion.providerId is onDelete SetNull, so ads must be removed explicitly or they would linger orphaned.
  const ads = await prisma.promotion.deleteMany({ where: { providerId: { in: providerIds } } });
  const listings = await prisma.serviceProduct.deleteMany({ where: { providerId: { in: providerIds } } });
  const removed = await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } }); // cascades provider
  log(`Cleared demo data: ${removed.count} users/providers, ${listings.count} listings, ${ads.count} ads.`);
}

async function loadCategoryIndex() {
  const rows = await prisma.productCategory.findMany();
  const byId = new Map(rows.map((c) => [c.id, c]));
  const childrenOf = (parentId, name) => rows.find((c) => c.parentId === parentId && c.name === name);

  const resolve = (path) => {
    let node = null;
    for (const [i, name] of path.split(" > ").entries()) {
      node = childrenOf(i === 0 ? null : node.id, name);
      if (!node) return null;
    }
    return node;
  };

  // A leaf inherits every ancestor's fields; a same-key field on the leaf overrides the ancestor's.
  const effectiveFields = (node) => {
    const chain = [];
    for (let n = node; n; n = n.parentId ? byId.get(n.parentId) : null) chain.unshift(n);
    const merged = new Map();
    for (const n of chain) for (const f of Array.isArray(n.listingFields) ? n.listingFields : []) merged.set(f.key, f);
    return merged;
  };
  // The node whose own listingFields declares `key` closest to the leaf (that's the definition the
  // form actually uses, so it is the one whose options must grow).
  const definingNode = (node, key) => {
    for (let n = node; n; n = n.parentId ? byId.get(n.parentId) : null) {
      if ((Array.isArray(n.listingFields) ? n.listingFields : []).some((f) => f.key === key)) return n;
    }
    return null;
  };
  return { resolve, effectiveFields, definingNode };
}

// Keeps only answers the category's own form would accept, so seeded listings render and filter
// exactly like ones a provider created by hand. Anything dropped is reported.
function cleanFields(fields, effective, problems, label) {
  const out = {};
  for (const [key, value] of Object.entries(fields)) {
    const def = effective.get(key);
    if (!def) {
      problems.push(`${label}: unknown field "${key}"`);
      continue;
    }
    if (Array.isArray(value) && value.length === 0) continue;
    if (def.type === "select" || def.type === "multi_select") {
      const options = def.options || [];
      const values = Array.isArray(value) ? value : [value];
      const ok = options.length === 0 ? values : values.filter((v) => options.includes(v));
      const bad = values.filter((v) => options.length && !options.includes(v));
      if (bad.length) problems.push(`${label}: "${key}" has no option ${JSON.stringify(bad)} (valid: ${options.slice(0, 8).join(", ")}${options.length > 8 ? ", ..." : ""})`);
      if (!ok.length) continue;
      out[key] = def.type === "multi_select" ? ok : ok[0];
    } else {
      out[key] = value;
    }
  }
  return out;
}

// The seeded category option lists are short starter samples (see seed-jiji-product-categories.js:
// no Samsung/HP/Dell brand, no "Living Room", ...), so a realistic catalog needs a few extra values.
// They're added to the owning category's field options - additive and idempotent, and genuinely
// useful to real providers, so --clear deliberately leaves them in place.
async function topUpOptions(rows, { effectiveFields, definingNode }) {
  const additions = new Map(); // `${nodeId}:${key}` -> { node, key, values:Set }
  for (const row of rows) {
    const effective = effectiveFields(row.category);
    for (const [key, value] of Object.entries(row.rawFields)) {
      const def = effective.get(key);
      if (!def || !(def.type === "select" || def.type === "multi_select") || !def.options?.length) continue;
      for (const v of Array.isArray(value) ? value : [value]) {
        if (def.options.includes(v)) continue;
        const node = definingNode(row.category, key);
        const id = `${node.id}:${key}`;
        if (!additions.has(id)) additions.set(id, { node, key, values: new Set() });
        additions.get(id).values.add(v);
      }
    }
  }
  let added = 0;
  // One write per category node: several fields on the same node must be merged into a single update.
  const byNode = new Map();
  for (const entry of additions.values()) {
    added += entry.values.size;
    if (!byNode.has(entry.node.id)) byNode.set(entry.node.id, { node: entry.node, entries: [] });
    byNode.get(entry.node.id).entries.push(entry);
  }
  if (!DRY_RUN) {
    for (const { node, entries } of byNode.values()) {
      const extra = new Map(entries.map((e) => [e.key, e.values]));
      const fields = (node.listingFields || []).map((f) => (extra.has(f.key) ? { ...f, options: [...f.options, ...extra.get(f.key)] } : f));
      await prisma.productCategory.update({ where: { id: node.id }, data: { listingFields: fields } });
    }
  }
  log(`${DRY_RUN ? "Would add" : "Added"} ${added} option value(s) across ${additions.size} category field(s).`);
}

async function seed() {
  let index = await loadCategoryIndex();
  const problems = [];

  // Resolve everything before writing a single row.
  const raw = PROVIDERS.map((provider) => ({
    provider,
    rows: provider.products.map(([path, name, price, pool, fields, extra], idx) => {
      const category = index.resolve(path);
      if (!category) throw new Error(`Category not found: "${path}" (seed the product category tree first)`);
      return { path, name, price, pool, extra: extra || {}, index: idx, category, rawFields: fields };
    })
  }));
  await topUpOptions(raw.flatMap((p) => p.rows), index);
  if (!DRY_RUN) index = await loadCategoryIndex(); // pick up the extended options

  const plan = raw.map(({ provider, rows }) => ({
    provider,
    rows: rows.map((r) => ({
      ...r,
      fields: cleanFields(r.rawFields, index.effectiveFields(index.resolve(r.path)), problems, `${provider.key} / ${r.name}`)
    }))
  }));

  if (problems.length && !DRY_RUN) {
    log(`\n${problems.length} field value(s) not in the category's options:`);
    for (const p of problems) log("  - " + p);
  }
  const total = plan.reduce((n, p) => n + p.rows.length, 0);
  log(`\nCatalog: ${plan.length} providers, ${total} listings, ${ADS.length} ads.`);
  if (DRY_RUN) return;

  await clearDemoData();

  const providerIdByKey = new Map();
  let created = 0;
  for (const { provider, rows } of plan) {
    const user = await prisma.user.create({
      data: { name: `${provider.businessName} (demo)`, email: demoEmail(provider.key), role: "provider", authProvider: "password" }
    });
    const avatar = imageUrl(pickImages(provider.avatar, provider.businessName.length, 1)[0], 300);
    const cover = imageUrl(pickImages(provider.avatar, provider.businessName.length + 2, 1)[0], 1400);
    const row = await prisma.provider.create({
      data: {
        userId: user.id,
        businessName: provider.businessName,
        description: provider.description,
        contact: { phone: provider.phone, whatsapp: provider.phone, email: demoEmail(provider.key) },
        media: { avatarUrl: avatar, coverUrl: cover, gallery: [] },
        location: {
          address: `${provider.area}, ${provider.district}`,
          city: provider.area,
          region: provider.district,
          country: "Uganda",
          geo: { type: "Point", coordinates: [provider.lng, provider.lat] }
        },
        lat: provider.lat,
        lng: provider.lng,
        geohash5: geohashEncode(provider.lat, provider.lng, 5),
        geohash6: geohashEncode(provider.lat, provider.lng, 6),
        district: provider.district,
        isApproved: true,
        moderationStatus: "approved",
        onboardingStatus: "completed",
        ratingAvg: 4 + Math.round(rng(provider.businessName.length)() * 9) / 10,
        ratingCount: 12 + Math.round(rng(provider.businessName.length + 1)() * 90)
      }
    });
    providerIdByKey.set(provider.key, row.id);

    for (const p of rows) {
      const random = rng(provider.businessName.length * 1000 + p.index);
      const daysOld = Math.floor(random() * 28);
      const was = p.extra.was && p.extra.was > p.price ? p.extra.was : null;
      const images = pickImages(p.pool, provider.businessName.length + p.index, 3).map((id) => imageUrl(id));
      await prisma.serviceProduct.create({
        data: {
          providerId: row.id,
          productCategoryId: p.category.id,
          name: p.name,
          description: p.extra.desc || `${p.name} in ${(p.fields.condition?.[0] ?? p.fields.condition ?? "good").toString().toLowerCase()} condition. Available now at our ${provider.area} shop, with delivery arranged countrywide.`,
          price: p.price,
          originalPrice: was ?? 0,
          discountPercent: was ? Math.round(((was - p.price) / was) * 100) : null,
          type: "product",
          status: "approved",
          featured: random() < 0.12,
          isNew: daysOld < 10,
          soldCount: Math.floor(random() * 40),
          viewCount: 20 + Math.floor(random() * 900),
          inventory: 1 + Math.floor(random() * 15),
          media: { imageUrl: images[0], gallery: images },
          customFields: p.fields,
          createdAt: new Date(Date.now() - (daysOld * 24 + Math.floor(random() * 20)) * 3600 * 1000)
        }
      });
      created += 1;
    }
  }

  for (const ad of ADS) {
    await prisma.promotion.create({
      data: {
        title: ad.title,
        subtitle: ad.subtitle,
        type: PromotionType.PROVIDER_AD,
        imageUrl: imageUrl(ad.image, 1600),
        ctaLabel: ad.cta,
        ctaHref: "/shop",
        providerId: providerIdByKey.get(ad.provider),
        isActive: true,
        moderationStatus: "approved",
        metadata: { demoSeed: true }
      }
    });
  }
  log(`Seeded ${plan.length} providers, ${created} listings and ${ADS.length} ads. Remove with: node scripts/seed-demo-marketplace.js --clear`);
}

try {
  if (CLEAR_ONLY) await clearDemoData();
  else await seed();
} finally {
  await prisma.$disconnect();
}
