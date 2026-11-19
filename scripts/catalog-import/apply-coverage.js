/* eslint-disable no-console */
// Dry-run by default. Correct only our labelled demo records; append source-backed items.
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash, randomBytes} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import bcrypt from 'bcryptjs';
import {geohashEncode} from '../../src/utils/geohash.js';

const db = new PrismaClient();
const batch = 'catalog-coverage-20261112';
const originalBatch = 'catalog-20261112';
const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('./coverage-20261112.json', import.meta.url))));
const hash = value => createHash('sha256').update(value).digest('hex');
const id = (kind, key, prefix = batch) => `${prefix}-${kind}-${hash(key).slice(0, 18)}`;
const originalId = source => id('listing', source, originalBatch);
const snapshotModels = ['user', 'provider', 'serviceProduct', 'productCategory', 'category', 'order', 'transaction'];
const digest = rows => hash(JSON.stringify(rows));

function checkFields(item, fields) {
  for (const [key, value] of Object.entries(item.customFields)) {
    const field = fields.get(key);
    if (!field) throw new Error(`Unknown field ${key}`);
    if (field.type === 'number' && !Number.isFinite(value)) throw new Error(`Invalid ${key}`);
    if (field.type === 'boolean' && typeof value !== 'boolean') throw new Error(`Invalid ${key}`);
    if (field.type === 'multi_select' && !Array.isArray(value)) throw new Error(`Invalid ${key}`);
    if (field.options?.length && ['select', 'multi_select'].includes(field.type)) {
      for (const entry of Array.isArray(value) ? value : [value]) if (!field.options.includes(entry)) throw new Error(`Unsupported ${key}: ${entry}`);
    }
  }
  // A public source does not always disclose every required seller-form specification.
  // We deliberately omit those facts instead of inventing a brand, colour, size or style.
  // Media records the missing fields; seller forms retain all their existing validation.
}

async function main() {
  if (manifest.batch !== batch) throw new Error('Wrong manifest');
  const before = {};
  for (const model of snapshotModels) before[model] = await db[model].findMany({orderBy: {id: 'asc'}});
  const categories = new Map(before.productCategory.map(c => [c.id, c]));
  const mirrored = new Set(before.category.filter(c => c.taxonomyKind === 'shop').map(c => c.id));
  const existing = new Map(before.serviceProduct.map(r => [r.id, r]));
  const sourceUrls = new Set(before.serviceProduct.filter(r => r.media?.sourceUrl).map(r => r.media.sourceUrl));
  const permitted = new Set();
  const newUrls = new Set();
  for (const item of [...manifest.items, ...manifest.corrections]) {
    const photo = new URL(item.imageUrl), source = new URL(item.sourceUrl);
    if (source.hostname !== 'jiji.ug' || photo.protocol !== 'https:' || !photo.hostname.endsWith('.jijistatic.com')) throw new Error('Untrusted provenance');
    const chain = [];
    for (let c = categories.get(item.productCategoryId); c; c = categories.get(c.parentId)) chain.unshift(c);
    if (!chain.length || chain.some(c => !c.isActive) || chain[0].id !== item.rootId || !mirrored.has(item.rootId)) throw new Error('Invalid active category');
    if (chain.map(c => c.name).join(' > ') !== item.categoryPath) throw new Error('Category path changed');
    if (!(item.price > 0) || !item.name) throw new Error('Invalid item');
    const fields = new Map();
    for (const c of chain) for (const f of c.listingFields) fields.set(f.key, f);
    checkFields(item, fields);
  }
  for (const item of manifest.corrections) {
    const row = existing.get(originalId(item.sourceUrl));
    if (!row || row.media?.seedBatch !== originalBatch || row.media.sourceUrl !== item.sourceUrl) throw new Error('Correction not owned by original batch');
    if (![item.previousCategoryId, item.productCategoryId].includes(row.productCategoryId)) throw new Error('Listing was edited since the audit');
    permitted.add(row.id);
  }
  for (const item of manifest.withhold) {
    const row = existing.get(originalId(item.sourceUrl));
    if (!row || row.media?.seedBatch !== originalBatch) throw new Error('Cannot withhold a real listing');
    permitted.add(row.id);
  }
  for (const item of manifest.items) {
    if (newUrls.has(item.sourceUrl)) throw new Error('Duplicate new source');
    newUrls.add(item.sourceUrl);
    if (sourceUrls.has(item.sourceUrl) && !existing.has(id('listing', item.sourceUrl))) throw new Error('Source already imported under another ID');
    const row = existing.get(id('listing', item.sourceUrl));
    if (row && row.media?.seedBatch !== batch) throw new Error('New listing ID collision');
  }
  const apply = process.argv.includes('--apply');
  console.log(JSON.stringify({mode: apply ? 'apply' : 'dry-run', batch, summary: manifest.summary,
    gaps: manifest.gaps.length, baseline: Object.fromEntries(snapshotModels.map(m => [m, before[m].length]))}));
  if (!apply) return;
  const providerByRoot = new Map();
  for (const p of before.provider) if ([originalBatch, batch].includes(p.media?.seedBatch)) providerByRoot.set(p.categoryId, p.id);
  const roots = new Set([...manifest.items, ...manifest.corrections].map(i => i.rootId));
  for (const root of roots) {
    if (providerByRoot.has(root)) continue;
    const userId = id('user', root), providerId = id('provider', root);
    if (before.user.some(u => u.id === userId) || before.provider.some(p => p.id === providerId)) throw new Error('Provider ID collision');
    const name = `Demo · ${categories.get(root).name} Catalogue`;
    const passwordHash = await bcrypt.hash(randomBytes(48).toString('hex'), 10);
    await db.$transaction(async tx => {
      await tx.user.create({data: {id: userId, name, role: 'provider', email: `${root}@${batch}.gabla.invalid`, passwordHash,
        profile: {seedBatch: batch, isDemo: true, catalogueOnly: true}}});
      await tx.provider.create({data: {id: providerId, userId, businessName: name, categoryId: root, publicSlug: providerId,
        description: 'Demo catalogue provider for presentation. Public item photos and prices are references; this is not the original seller and does not accept purchases or payments.',
        media: {seedBatch: batch, isDemo: true}, contact: {},
        location: {city: 'Kampala', region: 'Kampala', country: 'Uganda', address: 'Kampala — demo location', geo: {type: 'Point', coordinates: [32.5825, 0.3476]}},
        lat: 0.3476, lng: 32.5825, geohash5: geohashEncode(0.3476, 32.5825, 5), geohash6: geohashEncode(0.3476, 32.5825, 6), district: 'Kampala',
        isApproved: true, moderationStatus: 'approved', onboardingStatus: 'completed', walletEnabled: false, onlinePaymentsEnabled: false,
        settingsOverrides: {enableContactFee: false, enableEcommerce: false, enableWallet: false}}});
    });
    providerByRoot.set(root, providerId);
  }
  let corrected = 0, added = 0, withheld = 0;
  for (const item of manifest.corrections) {
    const row = existing.get(originalId(item.sourceUrl));
    if (row.productCategoryId === item.productCategoryId && row.media?.categoryAuditBatch === batch) continue;
    await db.serviceProduct.update({where: {id: row.id}, data: {
      productCategoryId: item.productCategoryId, categoryId: item.rootId, providerId: providerByRoot.get(item.rootId),
      customFields: item.customFields,
      media: {...row.media, categoryAuditBatch: batch, sourceAttributes: item.attributes, unverifiedRequiredFields: item.unverifiedRequiredFields}
    }});
    corrected++;
  }
  for (const item of manifest.withhold) {
    const row = existing.get(originalId(item.sourceUrl));
    if (row.status === 'suspended' && row.media?.categoryAuditBatch === batch) continue;
    await db.serviceProduct.update({where: {id: row.id}, data: {status: 'suspended',
      media: {...row.media, categoryAuditBatch: batch, withheldReason: 'Source details do not establish a safe category match'}}});
    withheld++;
  }
  for (const item of manifest.items) {
    const listingId = id('listing', item.sourceUrl);
    if (existing.has(listingId)) continue;
    await db.serviceProduct.create({data: {
      id: listingId, providerId: providerByRoot.get(item.rootId), categoryId: item.rootId, productCategoryId: item.productCategoryId,
      name: item.name, description: `Demo catalogue reference: ${item.name}. Source reference price UGX ${item.price.toLocaleString('en-US')}${item.pricePeriod ? ` (${item.pricePeriod})` : ''}. Original item and photograph: ${item.sourceUrl}. Not a live offer from this demo provider; undisclosed specifications are left blank.`,
      price: item.price, type: 'product', status: 'approved', onlinePaymentEnabled: false, bookingMode: 'none',
      customFields: item.customFields,
      media: {imageUrl: item.imageUrl, gallery: [item.imageUrl], imageWidth: item.imageWidth, imageHeight: item.imageHeight,
        seedBatch: batch, isDemo: true, source: 'Jiji Uganda', sourceUrl: item.sourceUrl, sourceId: item.sourceId,
        sourceAttributes: item.attributes, unverifiedRequiredFields: item.unverifiedRequiredFields, collectedAt: manifest.createdAt}
    }});
    added++;
    if (added % 100 === 0) console.log(JSON.stringify({added}));
  }
  for (const model of snapshotModels) {
    const rows = before[model].filter(r => model !== 'serviceProduct' || !permitted.has(r.id));
    const afterRows = await db[model].findMany({where: {id: {in: rows.map(r => r.id)}}, orderBy: {id: 'asc'}});
    if (digest(rows) !== digest(afterRows)) throw new Error(`Unrelated ${model} rows changed; investigate concurrent activity`);
  }
  const actual = await db.serviceProduct.groupBy({by: ['productCategoryId'], where: {type: 'product', status: 'approved'}, _count: {_all: true}});
  const report = {batch, added, corrected, withheld, unrelatedRowsPreserved: true,
    ordersBefore: before.order.length, ordersAfter: await db.order.count(), transactionsBefore: before.transaction.length, transactionsAfter: await db.transaction.count(),
    coverage: actual, manifestSha256: hash(readFileSync(fileURLToPath(new URL('./coverage-20261112.json', import.meta.url)))), gaps: manifest.gaps};
  writeFileSync(fileURLToPath(new URL('./coverage-report.json', import.meta.url)), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({batch, added, corrected, withheld, unrelatedRowsPreserved: true, orders: report.ordersAfter, transactions: report.transactionsAfter}));
}
try { await main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await db.$disconnect(); }
