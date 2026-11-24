/* eslint-disable no-console */
// One-time, additive-safe backfill: the services-20261124 batch's 130 listings were created with
// bookingMode: 'none' before booking profiles existed (see booking-profiles.js). This sets
// bookingMode/booking/items on those SAME rows so they're actually bookable, without touching
// anything else. Default is dry-run; --apply writes. Only ever updates a row that (a) is one of
// this batch's own deterministic ids, derived straight from the manifest (never discovered by a
// broad query) and (b) carries this batch's own media.seedBatch marker - the same ownership proof
// import.js/import-services.js use before writing anything.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { BOOKING_PROFILES, DEFAULT_PROFILE } from './booking-profiles.js';

const prisma = new PrismaClient();
const args = new Set(process.argv.slice(2));
const manifestUrl = new URL('./services-20261124.json', import.meta.url);
const manifest = JSON.parse(readFileSync(fileURLToPath(manifestUrl), 'utf8'));
const batch = 'services-20261124';
const id = (kind, key) => `${batch}-${kind}-${createHash('sha256').update(key).digest('hex').slice(0, 18)}`;

async function main() {
  if (manifest.batch !== batch) throw new Error('Unexpected manifest batch');
  const report = { batch, mode: args.has('--apply') ? 'apply' : 'dry-run', manifestItems: manifest.items.length, missing: 0, alreadyCorrect: 0, updated: 0, byCategory: {} };
  for (const item of manifest.items) {
    const listingId = id('listing', item.sourceUrl);
    const profile = BOOKING_PROFILES[item.gablaCategoryName] ?? DEFAULT_PROFILE;
    const existing = await prisma.serviceProduct.findUnique({ where: { id: listingId } });
    if (!existing) { report.missing++; continue; }
    if (existing.media?.seedBatch !== batch) throw new Error(`Row ${listingId} does not carry this batch's media marker; aborting before touching anything else`);
    const same = existing.bookingMode === profile.bookingMode &&
      JSON.stringify(existing.booking ?? {}) === JSON.stringify(profile.booking) &&
      JSON.stringify(existing.items ?? []) === JSON.stringify(profile.items);
    if (same) { report.alreadyCorrect++; continue; }
    report.byCategory[item.gablaCategoryName] = (report.byCategory[item.gablaCategoryName] ?? 0) + 1;
    report.updated++;
    if (args.has('--apply')) {
      await prisma.serviceProduct.update({
        where: { id: listingId },
        data: { bookingMode: profile.bookingMode, booking: profile.booking, items: profile.items }
      });
    }
  }
  console.log(JSON.stringify(report, null, 2));
}

try { await main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
