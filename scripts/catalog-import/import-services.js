/* eslint-disable no-console */
// Additive service-provider import, mirroring import.js's safety properties for the flat
// (no sub-levels, no required fields) Gabla service-category tree. Default is dry-run;
// --apply writes new rows only.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { geohashEncode } from '../../src/utils/geohash.js';
import { BOOKING_PROFILES, DEFAULT_PROFILE } from './booking-profiles.js';

const prisma = new PrismaClient();
const args = new Set(process.argv.slice(2));
const manifestUrl = new URL('./services-20261124.json', import.meta.url);
const manifest = JSON.parse(readFileSync(fileURLToPath(manifestUrl), 'utf8'));
const batch = 'services-20261124';
const domain = `${batch}.gabla.invalid`;
const TARGET_PROVIDERS = 40;
const id = (kind, key) => `${batch}-${kind}-${createHash('sha256').update(key).digest('hex').slice(0, 18)}`;
const digest = rows => createHash('sha256').update(JSON.stringify(rows)).digest('hex');
const counts = async () => Object.fromEntries(await Promise.all(
  ['user', 'provider', 'serviceProduct'].map(async model => [model, await prisma[model].count()])
));

async function validate() {
  if (manifest.batch !== batch) throw new Error('Unexpected manifest batch');
  if (!manifest.items.length) throw new Error('Empty manifest');
  const categories = await prisma.serviceCategory.findMany();
  const byName = new Map(categories.map(row => [row.name, row]));
  // Provider.categoryId points at the directory Category tree; a ServiceCategory root must be
  // mirrored there under the same id (same convention the product importer checks for ProductCategory).
  const mirrored = new Set((await prisma.category.findMany({ where: { taxonomyKind: 'service' }, select: { id: true } })).map(row => row.id));
  const sources = new Set();
  const images = new Set();
  for (const item of manifest.items) {
    if (sources.has(item.sourceUrl) || images.has(item.imageUrl)) throw new Error('Duplicate source or image');
    sources.add(item.sourceUrl); images.add(item.imageUrl);
    const photo = new URL(item.imageUrl);
    const source = new URL(item.sourceUrl);
    if (photo.protocol !== 'https:' || !photo.hostname.endsWith('.jijistatic.com') || source.hostname !== 'jiji.ug') throw new Error('Invalid provenance');
    if (!(item.price > 0) || !Number.isFinite(item.price) || !item.name || !item.imageWidth || !item.imageHeight) throw new Error('Incomplete item');
    const category = byName.get(item.gablaCategoryName);
    if (!category || category.isActive === false || !mirrored.has(category.id)) throw new Error(`Category unavailable: ${item.gablaCategoryName}`);
  }
  return byName;
}

function planProviders(byName) {
  const grouped = new Map();
  for (const item of manifest.items) {
    if (!grouped.has(item.gablaCategoryName)) grouped.set(item.gablaCategoryName, []);
    grouped.get(item.gablaCategoryName).push(item);
  }
  // One provider per category to start, then hand further providers to whichever category
  // currently has the most items per existing provider, same allocation rule import.js uses.
  const allocation = new Map([...grouped.keys()].map(name => [name, 1]));
  while ([...allocation.values()].reduce((a, b) => a + b, 0) < TARGET_PROVIDERS) {
    const name = [...grouped.keys()].filter(name => allocation.get(name) < grouped.get(name).length)
      .sort((a, b) => grouped.get(b).length / (allocation.get(b) + 1) - grouped.get(a).length / (allocation.get(a) + 1))[0];
    if (!name) throw new Error(`Cannot allocate ${TARGET_PROVIDERS} providers`);
    allocation.set(name, allocation.get(name) + 1);
  }
  const plans = [];
  for (const [name, items] of grouped) {
    const category = byName.get(name);
    const buckets = Array.from({ length: allocation.get(name) }, () => []);
    items.forEach((item, index) => buckets[index % buckets.length].push(item));
    buckets.forEach((rows, index) => {
      const key = `${category.id}-${index + 1}`;
      plans.push({
        key, userId: id('user', key), providerId: id('provider', key), categoryId: category.id,
        name: `Demo · ${name} ${String(index + 1).padStart(2, '0')}`, categoryName: name, rows
      });
    });
  }
  return plans;
}

async function main() {
  const byName = await validate();
  const plans = planProviders(byName);
  if (plans.length !== TARGET_PROVIDERS) throw new Error(`Expected ${TARGET_PROVIDERS} providers, planned ${plans.length}`);
  const wanted = { user: plans.map(p => p.userId), provider: plans.map(p => p.providerId), serviceProduct: manifest.items.map(i => id('listing', i.sourceUrl)) };
  // Fingerprint every pre-existing row in the only three tables this importer can write.
  const existing = {};
  for (const model of Object.keys(wanted)) existing[model] = await prisma[model].findMany({ orderBy: { id: 'asc' } });
  const before = await counts();
  const collisions = {};
  for (const model of Object.keys(wanted)) collisions[model] = existing[model].filter(row => wanted[model].includes(row.id));
  for (const row of collisions.user) if (row.profile?.seedBatch !== batch || !row.email?.endsWith(`@${domain}`)) throw new Error('User ID collision');
  for (const row of collisions.provider) if (row.media?.seedBatch !== batch) throw new Error('Provider ID collision');
  for (const row of collisions.serviceProduct) if (row.media?.seedBatch !== batch) throw new Error('Listing ID collision');
  const plan = {
    batch, mode: args.has('--apply') ? 'apply' : 'dry-run', before,
    planned: { providers: plans.length, listings: manifest.items.length, perProvider: plans.map(p => ({ name: p.name, items: p.rows.length })) },
    alreadyPresent: Object.fromEntries(Object.entries(collisions).map(([key, rows]) => [key, rows.length])),
    coverage: manifest.summary
  };
  console.log(JSON.stringify(plan, null, 2));
  if (!args.has('--apply')) return;
  const present = Object.fromEntries(Object.entries(collisions).map(([key, rows]) => [key, new Set(rows.map(row => row.id))]));
  const passwordHash = await bcrypt.hash(randomBytes(48).toString('hex'), 10);
  for (const provider of plans) {
    await prisma.$transaction(async tx => {
      const email = `${provider.key}@${domain}`;
      if (!present.user.has(provider.userId)) await tx.user.create({
        data: {
          id: provider.userId, name: provider.name, email, role: 'provider', passwordHash,
          profile: { seedBatch: batch, isDemo: true, catalogueOnly: true }
        }
      });
      if (!present.provider.has(provider.providerId)) {
        const lat = 0.3476, lng = 32.5825;
        await tx.provider.create({
          data: {
            id: provider.providerId, userId: provider.userId, categoryId: provider.categoryId,
            businessName: provider.name, publicSlug: provider.providerId,
            description: 'Demo catalogue provider for browsing and presentation. Not an actual seller; item photographs and reference prices come from public source listings. No bookings or payments are offered by this demo account.',
            contact: {}, media: { seedBatch: batch, isDemo: true, coverUrl: provider.rows[0].imageUrl },
            location: { city: 'Kampala', region: 'Kampala', country: 'Uganda', address: 'Kampala — demo location', geo: { type: 'Point', coordinates: [lng, lat] } },
            lat, lng, geohash5: geohashEncode(lat, lng, 5), geohash6: geohashEncode(lat, lng, 6), district: 'Kampala',
            isApproved: true, moderationStatus: 'approved', onboardingStatus: 'completed',
            walletEnabled: false, onlinePaymentsEnabled: false,
            settingsOverrides: { enableContactFee: false, enableEcommerce: false, enableWallet: false }
          }
        });
      }
      const profile = BOOKING_PROFILES[provider.categoryName] ?? DEFAULT_PROFILE;
      for (const item of provider.rows) {
        const listingId = id('listing', item.sourceUrl);
        if (present.serviceProduct.has(listingId)) continue;
        await tx.serviceProduct.create({
          data: {
            id: listingId, providerId: provider.providerId, categoryId: provider.categoryId, serviceCategoryId: provider.categoryId,
            name: item.name,
            description: `Demo catalogue item: ${item.name}. Reference price: UGX ${item.price.toLocaleString('en-US')}${item.pricePeriod ? ` (${item.pricePeriod})` : ''}. Photograph and factual details sourced from ${item.sourceUrl}. Availability and price are not a live offer from this demo provider - requests and bookings submitted against it will not be fulfilled.`,
            price: item.price, type: 'service', status: 'approved', onlinePaymentEnabled: false,
            media: {
              imageUrl: item.imageUrl, gallery: [item.imageUrl], seedBatch: batch, isDemo: true,
              sourceUrl: item.sourceUrl, sourceId: item.sourceId, source: 'Jiji Uganda',
              imageWidth: item.imageWidth, imageHeight: item.imageHeight, collectedAt: manifest.createdAt
            },
            customFields: {}, bookingMode: profile.bookingMode, booking: profile.booking, items: profile.items
          }
        });
      }
    }, { timeout: 120000 });
  }
  for (const model of Object.keys(wanted)) {
    const oldIds = existing[model].map(row => row.id);
    const afterRows = await prisma[model].findMany({ where: { id: { in: oldIds } }, orderBy: { id: 'asc' } });
    if (digest(existing[model]) !== digest(afterRows)) throw new Error(`Pre-existing ${model} rows changed during import; investigate concurrent activity`);
  }
  const report = {
    batch, before, after: await counts(), existingRowsPreserved: true,
    batchCounts: Object.fromEntries(await Promise.all(Object.keys(wanted).map(async model =>
      [model, await prisma[model].count({ where: { id: { in: wanted[model] } } })]))),
    manifestSha256: createHash('sha256').update(readFileSync(fileURLToPath(manifestUrl))).digest('hex')
  };
  writeFileSync(fileURLToPath(new URL('./import-services-report.json', import.meta.url)), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}

try { await main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
