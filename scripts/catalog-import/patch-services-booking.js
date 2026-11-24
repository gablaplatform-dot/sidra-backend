/* eslint-disable no-console */
// One-time, narrowly-scoped fix: the services-20261124 batch was created in production
// before this file's per-category booking profiles existed, so all 130 demo listings were
// written with bookingMode: 'none'. import-services.js is additive-only (it skips rows that
// already exist), so re-running it can never update them - this script is the update path.
// Default is dry-run; --apply writes. Touches only rows whose id starts with the batch's own
// listing-id prefix AND whose media.seedBatch matches, mirroring the collision-safety
// convention the importer itself uses.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const args = new Set(process.argv.slice(2));
const batch = 'services-20261124';
const idPrefix = `${batch}-listing-`;

const manifestUrl = new URL('./services-20261124.json', import.meta.url);
const manifest = JSON.parse(readFileSync(fileURLToPath(manifestUrl), 'utf8'));
const id = key => `${batch}-listing-${createHash('sha256').update(key).digest('hex').slice(0, 18)}`;
const wantedByListingId = new Map(manifest.items.map(item => [id(item.sourceUrl), item]));

const BOOKING_PROFILES = {
  'Construction': {
    bookingMode: 'request',
    booking: { unit: 'day', responseHours: 48, advanceDays: 60, cancellation: 'moderate' },
    items: [
      { name: 'Site visit & quote', price: null, required: false },
      { name: 'Materials sourcing', price: null, required: false }
    ]
  },
  'Service providers': {
    bookingMode: 'request',
    booking: { unit: 'hour', responseHours: 24, leadTimeHours: 4 },
    items: [
      { name: 'Call-out fee', price: 15000, required: true },
      { name: 'Materials (if needed)', price: null, required: false }
    ]
  },
  'IT and Technology': {
    bookingMode: 'request',
    booking: { unit: 'hour', responseHours: 12, leadTimeHours: 2 },
    items: [
      { name: 'Remote support session', price: null, required: false },
      { name: 'On-site visit', price: 30000, required: false }
    ]
  },
  'Printing and signage': {
    bookingMode: 'request',
    booking: { unit: 'day', responseHours: 24, advanceDays: 30 },
    items: [
      { name: 'Rush delivery (24h)', price: 30000, required: false },
      { name: 'Design proof', price: null, required: false }
    ]
  },
  'Legal consultancy services': {
    bookingMode: 'request',
    booking: { unit: 'hour', responseHours: 24, leadTimeHours: 24 },
    items: [
      { name: 'Document review', price: 50000, required: false },
      { name: 'Follow-up consultation', price: null, required: false }
    ]
  },
  'Jobs': {
    bookingMode: 'request',
    booking: { unit: 'hour', responseHours: 48 },
    items: [{ name: 'Candidate shortlist call', price: null, required: false }]
  },
  'Drivers': {
    bookingMode: 'instant',
    booking: { unit: 'hour', leadTimeHours: 2, inventory: 3 },
    items: [
      { name: 'Airport pickup sign', price: null, required: false },
      { name: 'Extra luggage', price: 10000, required: false }
    ]
  },
  'Destination tourism services': {
    bookingMode: 'request',
    booking: { unit: 'day', responseHours: 24, advanceDays: 90, depositPercent: 30, cancellation: 'moderate' },
    items: [
      { name: 'Private guide', price: 60000, required: false },
      { name: 'Transport included', price: null, required: false }
    ]
  },
  'Education': {
    bookingMode: 'request',
    booking: { unit: 'appointment', slotMinutes: 60, daysOfWeek: [1, 2, 3, 4, 5, 6], openFrom: '09:00', openTo: '19:00', responseHours: 24 },
    items: [{ name: 'Study materials', price: 10000, required: false }]
  },
  'Health care': {
    bookingMode: 'instant',
    booking: { unit: 'appointment', slotMinutes: 30, daysOfWeek: [1, 2, 3, 4, 5, 6], openFrom: '08:00', openTo: '18:00', leadTimeHours: 1 },
    items: [{ name: 'Home visit', price: 25000, required: false }]
  },
  'Events': {
    bookingMode: 'request',
    booking: { unit: 'day', responseHours: 48, advanceDays: 180, depositPercent: 30, cancellation: 'moderate' },
    items: [
      { name: 'Extra serving staff', price: 20000, required: false },
      { name: 'Equipment hire', price: null, required: false }
    ]
  },
  'Entertainment': {
    bookingMode: 'request',
    booking: { unit: 'hour', responseHours: 24, leadTimeHours: 48 },
    items: [
      { name: 'Extra hour', price: 50000, required: false },
      { name: 'Sound equipment', price: 100000, required: false }
    ]
  },
  'Venue': {
    bookingMode: 'request',
    booking: { unit: 'day', responseHours: 48, advanceDays: 180, depositPercent: 50, cancellation: 'strict' },
    items: [
      { name: 'Decoration package', price: 150000, required: false },
      { name: 'Catering coordination', price: null, required: false }
    ]
  },
  'Media': {
    bookingMode: 'instant',
    booking: { unit: 'hour', leadTimeHours: 24, inventory: 2 },
    items: [
      { name: 'Extra edited photos', price: 15000, required: false },
      { name: 'Drone footage', price: 80000, required: false }
    ]
  },
  'Veterinary and pet services': {
    bookingMode: 'request',
    booking: { unit: 'appointment', slotMinutes: 45, daysOfWeek: [1, 2, 3, 4, 5, 6], openFrom: '08:00', openTo: '17:00', responseHours: 12 },
    items: [{ name: 'Home visit', price: 20000, required: false }]
  }
};

async function main() {
  const rows = await prisma.serviceProduct.findMany({
    where: { id: { startsWith: idPrefix } },
    select: { id: true, media: true, serviceCategoryId: true, bookingMode: true }
  });
  const foreign = rows.filter(r => r.media?.seedBatch !== batch);
  if (foreign.length) throw new Error(`Row(s) with this id prefix are not ours: ${foreign.map(r => r.id).join(', ')}`);
  const unexpected = rows.filter(r => !wantedByListingId.has(r.id));
  if (unexpected.length) throw new Error(`Row(s) not in the manifest: ${unexpected.map(r => r.id).join(', ')}`);

  const categories = await prisma.serviceCategory.findMany({ select: { id: true, name: true } });
  const nameById = new Map(categories.map(c => [c.id, c.name]));

  const plan = rows.map(row => {
    const item = wantedByListingId.get(row.id);
    const categoryName = nameById.get(row.serviceCategoryId);
    const profile = BOOKING_PROFILES[categoryName];
    if (!profile) throw new Error(`No booking profile for category "${categoryName}" (listing ${row.id})`);
    return { row, item, categoryName, profile, alreadyApplied: row.bookingMode === profile.bookingMode };
  });

  console.log(JSON.stringify({
    batch, mode: args.has('--apply') ? 'apply' : 'dry-run',
    totalRows: rows.length,
    expectedRows: wantedByListingId.size,
    toUpdate: plan.filter(p => !p.alreadyApplied).length,
    alreadyApplied: plan.filter(p => p.alreadyApplied).length,
    byCategory: Object.fromEntries(
      [...new Set(plan.map(p => p.categoryName))].map(name => [
        name,
        { count: plan.filter(p => p.categoryName === name).length, bookingMode: BOOKING_PROFILES[name].bookingMode }
      ])
    )
  }, null, 2));

  if (!args.has('--apply')) return;

  const before = await prisma.serviceProduct.count();
  for (const { row, profile, alreadyApplied } of plan) {
    if (alreadyApplied) continue;
    await prisma.serviceProduct.update({
      where: { id: row.id },
      data: { bookingMode: profile.bookingMode, booking: profile.booking, items: profile.items }
    });
  }
  const after = await prisma.serviceProduct.count();
  if (before !== after) throw new Error(`Row count changed (${before} -> ${after}); this script must never create or delete rows`);
  console.log(JSON.stringify({ updated: plan.filter(p => !p.alreadyApplied).length, totalServiceProducts: after }, null, 2));
}

try { await main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
