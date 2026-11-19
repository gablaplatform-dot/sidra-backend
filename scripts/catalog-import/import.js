/* eslint-disable no-console */
// Additive catalogue import. Default is dry-run; --apply writes new rows only.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { geohashEncode } from '../../src/utils/geohash.js';

const prisma = new PrismaClient();
const args = new Set(process.argv.slice(2));
const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('./catalog-20261112.json', import.meta.url)), 'utf8'));
const batch = 'catalog-20261112';
const domain = `${batch}.gabla.invalid`;
const id = (kind, key) => `${batch}-${kind}-${createHash('sha256').update(key).digest('hex').slice(0, 18)}`;
const digest = rows => createHash('sha256').update(JSON.stringify(rows)).digest('hex');
const counts = async () => Object.fromEntries(await Promise.all(
  ['user', 'provider', 'serviceProduct', 'order', 'transaction'].map(async model => [model, await prisma[model].count()])
));

async function validate() {
  if (manifest.batch !== batch || manifest.items.length !== 600) throw new Error('Expected the reviewed 600-item batch');
  const categories = await prisma.productCategory.findMany();
  const byId = new Map(categories.map(row => [row.id, row]));
  const mirrored = new Set((await prisma.category.findMany({where: {taxonomyKind: 'shop'}, select: {id: true}})).map(row => row.id));
  const sources = new Set();
  const images = new Set();
  for (const item of manifest.items) {
    if (sources.has(item.sourceUrl) || images.has(item.imageUrl)) throw new Error('Duplicate source or image');
    sources.add(item.sourceUrl); images.add(item.imageUrl);
    const photo = new URL(item.imageUrl);
    const source = new URL(item.sourceUrl);
    if (photo.protocol !== 'https:' || !photo.hostname.endsWith('.jijistatic.com') || source.hostname !== 'jiji.ug') throw new Error('Invalid provenance');
    if (!(item.price > 0) || !Number.isFinite(item.price) || !item.name || !item.imageWidth || !item.imageHeight) throw new Error('Incomplete item');
    const chain = [];
    for (let row = byId.get(item.productCategoryId); row; row = byId.get(row.parentId)) chain.unshift(row);
    if (!chain.length || chain.some(row => row.isActive === false) || chain[0].id !== item.rootId || !mirrored.has(item.rootId)) throw new Error(`Category unavailable: ${item.categoryPath}`);
    if (chain.map(row => row.name).join(' > ') !== item.categoryPath) throw new Error('Category path changed');
    const fields = new Map();
    for (const row of chain) for (const field of row.listingFields || []) fields.set(field.key, field);
    for (const [key, field] of fields) {
      const value = item.customFields[key];
      if (value === undefined) {
        if (field.required) throw new Error(`Missing ${key}: ${item.name}`);
        continue;
      }
      if (field.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) throw new Error(`Invalid number: ${key}`);
      if (field.type === 'boolean' && typeof value !== 'boolean') throw new Error(`Invalid boolean: ${key}`);
      if (field.type === 'multi_select' && !Array.isArray(value)) throw new Error(`Invalid array: ${key}`);
      if (field.options?.length && ['select', 'multi_select'].includes(field.type)) {
        for (const option of Array.isArray(value) ? value : [value]) if (!field.options.includes(option)) throw new Error(`Unknown option ${key}: ${option}`);
      }
    }
    for (const key of Object.keys(item.customFields)) if (!fields.has(key)) throw new Error(`Unknown field ${key}`);
  }
  return byId;
}

function planProviders(byId) {
  const grouped = new Map();
  for (const item of manifest.items) {
    if (!grouped.has(item.rootId)) grouped.set(item.rootId, []);
    grouped.get(item.rootId).push(item);
  }
  const allocation = new Map([...grouped.keys()].map(root => [root, 1]));
  while ([...allocation.values()].reduce((a, b) => a + b, 0) < 60) {
    const root = [...grouped.keys()].filter(root => allocation.get(root) < grouped.get(root).length)
      .sort((a, b) => grouped.get(b).length / (allocation.get(b) + 1) - grouped.get(a).length / (allocation.get(a) + 1))[0];
    if (!root) throw new Error('Cannot allocate 60 providers');
    allocation.set(root, allocation.get(root) + 1);
  }
  const plans = [];
  for (const [root, items] of grouped) {
    const buckets = Array.from({length: allocation.get(root)}, () => []);
    items.forEach((item, index) => buckets[index % buckets.length].push(item));
    buckets.forEach((rows, index) => {
      const key = `${root}-${index + 1}`;
      plans.push({key, userId: id('user', key), providerId: id('provider', key), root,
        name: `Demo · ${byId.get(root).name} ${String(index + 1).padStart(2, '0')}`, rows});
    });
  }
  return plans;
}

async function main() {
  const byId = await validate();
  const plans = planProviders(byId);
  const wanted = {user: plans.map(p => p.userId), provider: plans.map(p => p.providerId), serviceProduct: manifest.items.map(i => id('listing', i.sourceUrl))};
  // Fingerprint every pre-existing row in the only three tables this importer can write.
  const existing = {};
  for (const model of Object.keys(wanted)) existing[model] = await prisma[model].findMany({orderBy: {id: 'asc'}});
  const before = await counts();
  const collisions = {};
  for (const model of Object.keys(wanted)) collisions[model] = existing[model].filter(row => wanted[model].includes(row.id));
  for (const row of collisions.user) if (row.profile?.seedBatch !== batch || !row.email?.endsWith(`@${domain}`)) throw new Error('User ID collision');
  for (const row of collisions.provider) if (row.media?.seedBatch !== batch) throw new Error('Provider ID collision');
  for (const row of collisions.serviceProduct) if (row.media?.seedBatch !== batch) throw new Error('Listing ID collision');
  const plan = {batch, mode: args.has('--apply') ? 'apply' : 'dry-run', before,
    planned: {users: plans.length, providers: plans.length, listings: manifest.items.length},
    alreadyPresent: Object.fromEntries(Object.entries(collisions).map(([key, rows]) => [key, rows.length])),
    coverage: manifest.summary};
  console.log(JSON.stringify(plan));
  if (!args.has('--apply')) return;
  const present = Object.fromEntries(Object.entries(collisions).map(([key, rows]) => [key, new Set(rows.map(row => row.id))]));
  const passwordHash = await bcrypt.hash(randomBytes(48).toString('hex'), 10);
  for (const provider of plans) {
    await prisma.$transaction(async tx => {
      const email = `${provider.key}@${domain}`;
      if (!present.user.has(provider.userId)) await tx.user.create({data: {
        id: provider.userId, name: provider.name, email, role: 'provider', passwordHash,
        profile: {seedBatch: batch, isDemo: true, catalogueOnly: true}
      }});
      if (!present.provider.has(provider.providerId)) {
        const lat = 0.3476, lng = 32.5825;
        await tx.provider.create({data: {
          id: provider.providerId, userId: provider.userId, categoryId: provider.root,
          businessName: provider.name, publicSlug: provider.providerId,
          description: 'Demo catalogue provider for browsing and presentation. Not an actual seller; item photographs and reference prices come from public source listings. No purchases or payments are offered by this demo account.',
          contact: {}, media: {seedBatch: batch, isDemo: true, coverUrl: provider.rows[0].imageUrl},
          location: {city: 'Kampala', region: 'Kampala', country: 'Uganda', address: 'Kampala — demo location', geo: {type: 'Point', coordinates: [lng, lat]}},
          lat, lng, geohash5: geohashEncode(lat, lng, 5), geohash6: geohashEncode(lat, lng, 6), district: 'Kampala',
          isApproved: true, moderationStatus: 'approved', onboardingStatus: 'completed',
          walletEnabled: false, onlinePaymentsEnabled: false,
          settingsOverrides: {enableContactFee: false, enableEcommerce: false, enableWallet: false}
        }});
      }
      for (const item of provider.rows) {
        const listingId = id('listing', item.sourceUrl);
        if (present.serviceProduct.has(listingId)) continue;
        await tx.serviceProduct.create({data: {
          id: listingId, providerId: provider.providerId, categoryId: item.rootId, productCategoryId: item.productCategoryId,
          name: item.name, description: `Demo catalogue item: ${item.name}. Reference price: UGX ${item.price.toLocaleString('en-US')}${item.pricePeriod ? ` (${item.pricePeriod})` : ''}. Photograph and factual details sourced from ${item.sourceUrl}. Availability and price are not a live offer from this demo provider.`,
          price: item.price, type: 'product', status: 'approved', onlinePaymentEnabled: false,
          media: {imageUrl: item.imageUrl, gallery: [item.imageUrl], seedBatch: batch, isDemo: true,
            sourceUrl: item.sourceUrl, sourceId: item.sourceId, source: 'Jiji Uganda',
            imageWidth: item.imageWidth, imageHeight: item.imageHeight, collectedAt: manifest.createdAt},
          customFields: item.customFields, bookingMode: 'none'
        }});
      }
    }, {timeout: 30000});
  }
  for (const model of Object.keys(wanted)) {
    const oldIds = existing[model].map(row => row.id);
    const afterRows = await prisma[model].findMany({where: {id: {in: oldIds}}, orderBy: {id: 'asc'}});
    if (digest(existing[model]) !== digest(afterRows)) throw new Error(`Pre-existing ${model} rows changed during import; investigate concurrent activity`);
  }
  const report = {batch, before, after: await counts(), existingRowsPreserved: true,
    batchCounts: Object.fromEntries(await Promise.all(Object.keys(wanted).map(async model =>
      [model, await prisma[model].count({where: {id: {in: wanted[model]}}})]))),
    manifestSha256: createHash('sha256').update(readFileSync(fileURLToPath(new URL('./catalog-20261112.json', import.meta.url)))).digest('hex')};
  writeFileSync(fileURLToPath(new URL('./import-report.json', import.meta.url)), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}

try { await main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
