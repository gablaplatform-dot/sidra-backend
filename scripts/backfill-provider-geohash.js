// One-time (but safe to re-run) backfill: computes lat/lng/geohash5/geohash6 for any provider
// that already has location.geo.coordinates set but predates those indexed columns. New writes
// stay in sync automatically via ProviderService's buildGeoColumns helper - this script only
// covers rows written before that existed, or restored from a backup that predates it.
import { PrismaClient } from "@prisma/client";
import { geohashEncode } from "../src/utils/geohash.js";

const GEOHASH_PRECISION_FINE = 6;
const GEOHASH_PRECISION_COARSE = 5;

const prisma = new PrismaClient();

const run = async () => {
  const providers = await prisma.provider.findMany({
    where: { geohash6: null },
    select: { id: true, location: true }
  });

  let updated = 0;
  for (const provider of providers) {
    const coords = provider.location?.geo?.coordinates;
    if (!Array.isArray(coords) || coords.length !== 2 || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) {
      continue;
    }
    const [lng, lat] = coords;
    await prisma.provider.update({
      where: { id: provider.id },
      data: {
        lat,
        lng,
        geohash5: geohashEncode(lat, lng, GEOHASH_PRECISION_COARSE),
        geohash6: geohashEncode(lat, lng, GEOHASH_PRECISION_FINE)
      }
    });
    updated += 1;
  }

  process.stdout.write(`Backfilled geohash columns for ${updated} provider(s) (${providers.length} candidates checked).\n`);
  await prisma.$disconnect();
};

run().catch(async (err) => {
  process.stderr.write(`${err.stack || err}\n`);
  await prisma.$disconnect();
  process.exit(1);
});
