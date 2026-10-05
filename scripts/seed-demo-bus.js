// Seeds Gabla Bus demo data for presenting/testing: bus types with photos, 10 bus companies
// (logos, cover photos, parks, routes, ticket types, recurring sessions) and about three weeks
// of trip history plus the week ahead, with customers, paid orders, check-ins, a cancelled trip
// waiting on refunds, announcements and payouts, so every dashboard has something to show.
//
//   node scripts/seed-demo-bus.js           seed (replaces any previous demo bus data)
//   node scripts/seed-demo-bus.js --clear   remove every demo bus company, customer, trip and ticket
//
// Everything is owned by users on demo-bus-*@seed.gabla.test. The company names are invented (modelled
// on the Ugandan market: real parks, real towns, fares in the range operators charge), so no real
// company is shown selling tickets on Gabla. Bus TYPES are a shared catalogue, so --clear keeps them.
// Logos are SVGs in public_app/public/bus-demo (node scripts/gen-bus-demo-logos.js); photos are
// Unsplash (hotlinking is permitted), picked from each photo's own description.
import dotenv from "dotenv";
import { Prisma, PrismaClient } from "@prisma/client";

import { BusCatalogService } from "../src/services/busCatalog.service.js";
import { env } from "../src/config/env.js";
import { slugify, makeBookingReference, makeTicketNumber } from "../src/utils/busIds.js";
import { addDaysToDateString, enumerateDates, eatToUtc, todayEat, weekdayOf } from "../src/utils/busTime.js";
import { hashPassword } from "../src/utils/password.js";

dotenv.config();
const prisma = new PrismaClient();
const log = (m) => process.stdout.write(`${m}\n`);
const DEMO_DOMAIN = "seed.gabla.test";
const photo = (id, w = 1200) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=75`;
const logo = (key) => `${env.publicSiteUrl}/bus-demo/logo-${key}.svg`;

// Unsplash ids, each taken from the photo's own alt text.
const IMG = {
  blueCoach: "1570125909232-eb263c188f7e", // parked blue and black bus
  grayCoach: "1570125909517-53cb21c89ff2", // gray and black bus parked
  mountainCoach: "1544620347-c4fd4a3d5957", // white and black bus near the mountain
  roadCoach: "1606188521935-278fd50f7a36", // white and black bus on road
  roadCoach2: "1605068263928-dc295689add1", // white and black bus on road
  yellowBus: "1603521801204-8d9c70dd08c8", // yellow and white bus on road
  twoBlack: "1765739099920-81a456008253", // two black buses on a city street
  van: "1715929334046-14baddcaca08", // white van on a dirt road
  van2: "1671548884505-42cbdafd5ba8", // van with a roof rack
  street: "1766087124181-0677409b73eb", // busy street with cars, motorcycles, buildings
  station: "1767584291064-705a02adc3aa" // person waiting for bus at a station
};

const TYPES = [
  { name: "Gagga Coach", seats: 67, image: IMG.blueCoach, description: "Full-size luxury coach for the long upcountry routes.", amenities: ["Air conditioning", "Reclining seats", "Charging ports", "Luggage hold"] },
  { name: "Baby Coach", seats: 33, image: IMG.grayCoach, description: "Smaller, faster coach - fewer stops and a quieter ride.", amenities: ["Air conditioning", "Charging ports", "Luggage hold"] },
  { name: "Executive VIP", seats: 45, image: IMG.twoBlack, description: "Extra legroom, snacks onboard and a hostess.", amenities: ["Air conditioning", "Extra legroom", "Free snack", "WiFi", "Charging ports"] },
  { name: "Mini Bus", seats: 14, image: IMG.van, description: "Quick shuttle for short trips between towns.", amenities: ["Air conditioning"] }
];

const ALL = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];
const stops = (...pairs) => pairs.map(([name, offsetMinutes]) => ({ name, offsetMinutes }));

const COMPANIES = [
  {
    key: "swift", name: "Swift Safaris Express", park: "Old Taxi Park", district: "Kampala", address: "Namirembe Road, Old Taxi Park, Kampala", lat: 0.3136, lng: 32.5811, fleet: 24, phone: "0772100101", rating: 4.6, reviews: 412, cover: IMG.mountainCoach,
    about: "Reliable daily departures from the heart of Kampala to the west and south-west. Online booking, on-time departures.",
    routes: [
      { dest: "Mbarara", type: "Gagga Coach", mins: 270, km: 270, prices: [["Economy", 30000], ["Business", 40000]], times: ["06:30", "09:00", "13:00", "22:30"], days: ALL, via: stops(["Mpigi", 40], ["Masaka", 120], ["Lyantonde", 190]) },
      { dest: "Kabale", type: "Gagga Coach", mins: 480, km: 410, prices: [["Economy", 45000], ["Business", 60000]], times: ["07:00", "21:00"], days: ALL, via: stops(["Masaka", 120], ["Mbarara", 270], ["Ntungamo", 360]) },
      { dest: "Kasese", type: "Executive VIP", mins: 420, km: 360, prices: [["VIP", 55000]], times: ["08:00"], days: ALL, via: stops(["Mubende", 110], ["Fort Portal", 300]) }
    ]
  },
  {
    key: "pearl", name: "Pearl Coaches", park: "Namayiba Bus Park", district: "Kampala", address: "Entebbe Road, Namayiba Bus Park, Kampala", lat: 0.3064, lng: 32.5686, fleet: 18, phone: "0701200202", rating: 4.4, reviews: 266, cover: IMG.roadCoach,
    about: "Comfortable Baby Coach service to the north, leaving on time with a friendly crew.",
    routes: [
      { dest: "Gulu", type: "Baby Coach", mins: 330, km: 340, prices: [["Economy", 38000], ["VIP", 50000]], times: ["06:00", "10:00", "14:30"], days: ALL, via: stops(["Luweero", 60], ["Nakasongola", 120], ["Karuma", 240]) },
      { dest: "Lira", type: "Baby Coach", mins: 300, km: 340, prices: [["Economy", 33000]], times: ["07:30", "15:00"], days: ALL, via: stops(["Luweero", 60], ["Karuma", 220]) },
      { dest: "Arua", type: "Gagga Coach", mins: 540, km: 480, prices: [["Economy", 50000], ["VIP", 65000]], times: ["20:00"], days: ALL, via: stops(["Karuma", 240], ["Pakwach", 420]) }
    ]
  },
  {
    key: "nile", name: "Nile Link Bus", park: "Jinja Road Terminal", district: "Kampala", address: "Jinja Road, opposite Shell, Nakawa", lat: 0.3231, lng: 32.615, fleet: 15, phone: "0752300303", rating: 4.3, reviews: 198, cover: IMG.yellowBus,
    about: "Eastern Uganda specialists - Jinja, Mbale, Tororo and beyond. Frequent departures all day.",
    routes: [
      { dest: "Jinja", type: "Mini Bus", mins: 90, km: 80, prices: [["Standard", 10000]], times: ["06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00"], days: ALL, via: stops(["Mukono", 30], ["Lugazi", 55]) },
      { dest: "Mbale", type: "Baby Coach", mins: 240, km: 225, prices: [["Economy", 25000], ["Business", 32000]], times: ["07:00", "11:00", "16:00"], days: ALL, via: stops(["Jinja", 90], ["Iganga", 130], ["Tororo", 200]) },
      { dest: "Busia", type: "Baby Coach", mins: 270, km: 200, prices: [["Economy", 28000]], times: ["09:00"], days: WEEKDAYS, via: stops(["Jinja", 90], ["Iganga", 130], ["Tororo", 220]) }
    ]
  },
  {
    key: "rwenzori", name: "Rwenzori Express", park: "Kampala Coach Terminal", district: "Kampala", address: "Kampala Road, Coach Terminal", lat: 0.3152, lng: 32.579, fleet: 12, phone: "0782400404", rating: 4.7, reviews: 351, cover: IMG.blueCoach,
    about: "Overnight and morning coaches to Fort Portal, Hoima and the mountains. Executive seating on every trip.",
    routes: [
      { dest: "Fort Portal", type: "Executive VIP", mins: 330, km: 295, prices: [["VIP", 45000], ["Economy", 35000]], times: ["06:30", "14:00", "22:00"], days: ALL, via: stops(["Mubende", 110], ["Kyenjojo", 270]) },
      { dest: "Hoima", type: "Baby Coach", mins: 270, km: 210, prices: [["Economy", 30000]], times: ["08:30", "15:30"], days: ALL, via: stops(["Kiboga", 90], ["Kyankwanzi", 150]) },
      { dest: "Kisoro", type: "Gagga Coach", mins: 600, km: 510, prices: [["Economy", 55000], ["Business", 70000]], times: ["06:00"], days: ALL, via: stops(["Masaka", 120], ["Mbarara", 270], ["Kabale", 480]) }
    ]
  },
  {
    key: "savannah", name: "Savannah Coaches", park: "Mbarara Main Park", district: "Mbarara", address: "High Street, Mbarara Main Park", lat: -0.6072, lng: 30.6545, fleet: 9, phone: "0773500505", rating: 4.2, reviews: 142, cover: IMG.roadCoach2,
    about: "Heading back to Kampala from the south-west, several times a day, plus quick hops to Kabale.",
    routes: [
      { orig: "Mbarara", dest: "Kampala", type: "Gagga Coach", mins: 270, km: 270, prices: [["Economy", 30000], ["Business", 40000]], times: ["06:00", "09:30", "13:30", "21:30"], days: ALL, via: stops(["Lyantonde", 70], ["Masaka", 150], ["Mpigi", 230]) },
      { orig: "Mbarara", dest: "Kabale", type: "Mini Bus", mins: 150, km: 140, prices: [["Standard", 18000]], times: ["07:00", "12:00", "17:00"], days: ALL, via: stops(["Ntungamo", 80]) }
    ]
  },
  {
    key: "teso", name: "Teso Star Coaches", park: "Soroti Bus Park", district: "Soroti", address: "Soroti Main Bus Park", lat: 1.7147, lng: 33.6111, fleet: 7, phone: "0704600606", rating: 4.1, reviews: 96, cover: IMG.grayCoach,
    about: "North-eastern routes with a friendly crew and fair prices.",
    routes: [
      { orig: "Soroti", dest: "Kampala", type: "Baby Coach", mins: 330, km: 300, prices: [["Economy", 30000]], times: ["06:30", "12:00"], days: ALL, via: stops(["Kamuli", 150], ["Jinja", 240]) },
      { orig: "Soroti", dest: "Mbale", type: "Mini Bus", mins: 150, km: 130, prices: [["Standard", 15000]], times: ["09:00", "15:00"], days: ALL, via: stops(["Kumi", 60]) }
    ]
  },
  {
    key: "kigezi", name: "Kigezi Royal Coaches", park: "New Taxi Park", district: "Kampala", address: "Ben Kiwanuka Street, New Taxi Park", lat: 0.317, lng: 32.576, fleet: 20, phone: "0775700707", rating: 4.8, reviews: 530, cover: IMG.twoBlack,
    about: "Premium coaches to the Kigezi highlands - Kabale, Kisoro and Rukungiri. Snacks onboard on VIP trips.",
    routes: [
      { dest: "Kabale", type: "Executive VIP", mins: 450, km: 410, prices: [["VIP", 60000], ["Economy", 48000]], times: ["07:30", "20:30"], days: ALL, via: stops(["Masaka", 120], ["Mbarara", 260], ["Ntungamo", 340]) },
      { dest: "Kisoro", type: "Gagga Coach", mins: 600, km: 510, prices: [["Economy", 55000], ["Business", 70000]], times: ["06:30", "19:30"], days: ALL, via: stops(["Mbarara", 270], ["Kabale", 450]) },
      { dest: "Rukungiri", type: "Baby Coach", mins: 420, km: 390, prices: [["Economy", 45000]], times: ["08:00"], days: ALL, via: stops(["Mbarara", 270], ["Ntungamo", 350]) }
    ]
  },
  {
    key: "acholi", name: "Acholi Gold Line", park: "Arua Park", district: "Kampala", address: "Arua Park, Kampala", lat: 0.3115, lng: 32.5762, fleet: 16, phone: "0706800808", rating: 4.5, reviews: 287, cover: IMG.roadCoach,
    about: "The northern corridor - Gulu, Kitgum, Lira and Arua. Night coaches with reclining seats.",
    routes: [
      { dest: "Gulu", type: "Gagga Coach", mins: 330, km: 340, prices: [["Economy", 38000], ["VIP", 52000]], times: ["07:00", "11:00", "21:00"], days: ALL, via: stops(["Luweero", 60], ["Karuma", 240]) },
      { dest: "Kitgum", type: "Baby Coach", mins: 480, km: 440, prices: [["Economy", 48000]], times: ["07:30"], days: ALL, via: stops(["Gulu", 330], ["Pader", 400]) },
      { dest: "Arua", type: "Gagga Coach", mins: 540, km: 480, prices: [["Economy", 52000], ["VIP", 66000]], times: ["19:00"], days: ALL, via: stops(["Gulu", 330], ["Pakwach", 450]) }
    ]
  },
  {
    key: "elgon", name: "Elgon Shuttle", park: "Mbale Main Park", district: "Mbale", address: "Republic Street, Mbale Main Park", lat: 1.0759, lng: 34.1758, fleet: 8, phone: "0777900909", rating: 4.0, reviews: 74, cover: IMG.van,
    about: "Short, frequent runs around Mount Elgon - Mbale, Tororo, Kapchorwa and back to Kampala.",
    routes: [
      { orig: "Mbale", dest: "Kampala", type: "Baby Coach", mins: 240, km: 225, prices: [["Economy", 25000]], times: ["06:30", "10:30", "15:30"], days: ALL, via: stops(["Tororo", 40], ["Jinja", 150]) },
      { orig: "Mbale", dest: "Soroti", type: "Mini Bus", mins: 150, km: 130, prices: [["Standard", 15000]], times: ["08:00", "13:00"], days: ALL, via: stops(["Kumi", 90]) }
    ]
  },
  {
    key: "buganda", name: "Buganda Royal Liner", park: "Kisenyi Bus Terminal", district: "Kampala", address: "Kisenyi, Kampala", lat: 0.3098, lng: 32.5663, fleet: 14, phone: "0758001010", rating: 4.4, reviews: 219, cover: IMG.blueCoach,
    about: "Masaka road specialists with a departure almost every hour to Masaka, Mbarara and Kalangala ferry connections.",
    routes: [
      { dest: "Masaka", type: "Baby Coach", mins: 150, km: 130, prices: [["Economy", 15000], ["Business", 20000]], times: ["06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00"], days: ALL, via: stops(["Mpigi", 40], ["Lukaya", 90]) },
      { dest: "Mbarara", type: "Gagga Coach", mins: 270, km: 270, prices: [["Economy", 28000], ["Business", 38000]], times: ["07:00", "13:30", "23:00"], days: ALL, via: stops(["Masaka", 150], ["Lyantonde", 220]) }
    ]
  }
];

const CUSTOMERS = [
  "Aisha Namukasa", "Brian Okello", "Grace Atim", "Moses Byaruhanga", "Sarah Nakato", "David Mugisha", "Patience Auma", "Joseph Ssemakula",
  "Esther Nabirye", "Isaac Tumusiime", "Racheal Akello", "Samuel Kato", "Doreen Nalubega", "Peter Opio", "Florence Namatovu", "Ivan Mwesigwa",
  "Lydia Nakirya", "Charles Odongo", "Mercy Kyomuhendo", "Hassan Kigozi", "Juliet Achieng", "Emmanuel Wasswa", "Winnie Birungi", "Denis Lubega"
];

// Small deterministic generator so re-seeding yields comparable data.
const rng = (seed) => {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const rand = rng(20261005);
const pick = (list) => list[Math.floor(rand() * list.length)];
const between = (a, b) => a + Math.floor(rand() * (b - a + 1));

async function clearDemo() {
  const operators = await prisma.user.findMany({ where: { email: { startsWith: "demo-bus-", endsWith: `@${DEMO_DOMAIN}` } }, select: { id: true } });
  const customers = await prisma.user.findMany({ where: { email: { startsWith: "demo-bus-customer-", endsWith: `@${DEMO_DOMAIN}` } }, select: { id: true } });
  // Transactions are not cascaded from bookings, so remove the demo customers' bus payments first.
  const tx = await prisma.transaction.deleteMany({ where: { type: "bus_ticket", userId: { in: customers.map((c) => c.id) } } });
  const removed = await prisma.user.deleteMany({ where: { id: { in: operators.map((u) => u.id) } } }); // cascades companies, routes, trips, bookings, tickets
  log(`Cleared demo bus data: ${removed.count} users (companies + customers), ${tx.count} payments.`);
}

async function main() {
  await clearDemo();
  if (process.argv.includes("--clear")) return;

  const catalog = new BusCatalogService();
  const typeByName = new Map();
  for (const t of TYPES) {
    let row = await prisma.busType.findFirst({ where: { name: t.name } });
    if (!row) row = await catalog.createType({ name: t.name, seats: t.seats, description: t.description, amenities: t.amenities });
    if (!row.imageUrl) row = await prisma.busType.update({ where: { id: row.id }, data: { imageUrl: photo(t.image, 900) } });
    typeByName.set(t.name, row);
  }

  const settings = await prisma.busSettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
  if (!Array.isArray(settings.onboardingFields) || !settings.onboardingFields.length) {
    await prisma.busSettings.update({
      where: { id: "singleton" },
      data: {
        onboardingFields: [
          { key: "licence_number", label: "Operating licence number", type: "text", required: true, options: [] },
          { key: "years_operating", label: "Years in operation", type: "number", required: false, options: [] },
          { key: "services", label: "Services onboard", type: "multi_select", required: false, options: ["Air conditioning", "WiFi", "Snacks", "Charging ports", "Luggage hold", "Hostess"] },
          { key: "has_insurance", label: "All passengers are insured", type: "boolean", required: false, options: [] }
        ]
      }
    });
  }

  const passwordHash = await hashPassword("DemoBus#2026");

  // ------------------------------------------------------------------ companies, routes, sessions
  const operators = [];
  for (const [index, c] of COMPANIES.entries()) {
    const user = await prisma.user.create({ data: { name: `${c.name} (demo)`, email: `demo-bus-${c.key}@${DEMO_DOMAIN}`, phone: c.phone, passwordHash, role: "bus_operator", avatarUrl: logo(c.key) } });
    const operator = await prisma.busOperator.create({
      data: {
        userId: user.id,
        companyName: c.name,
        slug: slugify(c.name),
        description: c.about,
        logoUrl: logo(c.key),
        coverUrl: photo(c.cover, 1400),
        parkName: c.park,
        parkDistrict: c.district,
        parkAddress: c.address,
        parkLat: c.lat,
        parkLng: c.lng,
        fleetSize: c.fleet,
        contactPhone: c.phone,
        whatsapp: c.phone,
        customFields: { licence_number: `UG-BUS-${1000 + index * 137}`, years_operating: 4 + index, services: ["Air conditioning", "Charging ports"], has_insurance: true },
        onboardingStatus: "registered",
        registeredAt: new Date(Date.now() - (60 + index * 9) * 86400000),
        ratingAvg: c.rating,
        ratingCount: c.reviews
      }
    });
    for (const r of c.routes) {
      const type = typeByName.get(r.type);
      const origin = r.orig ?? "Kampala";
      await catalog.createRoute(operator.id, {
        name: `${origin} - ${r.dest}`,
        originName: origin,
        destinationName: r.dest,
        boardingPoint: `${c.park}${r.orig ? "" : ", Bay " + between(2, 24)}`,
        dropoffPoint: `${r.dest} main bus park`,
        distanceKm: r.km,
        durationMinutes: r.mins,
        stops: r.via,
        busTypeId: type.id,
        ticketTypes: r.prices.map(([name, price]) => ({ name, price })),
        departures: r.times.map((time) => ({ departureTime: time, daysOfWeek: r.days, name: time < "12:00" ? "Morning" : time < "18:00" ? "Afternoon" : "Night", seats: type.seats }))
      });
    }
    operators.push(operator);
  }

  // ------------------------------------------------------------------ customers
  const customers = [];
  for (const [i, name] of CUSTOMERS.entries()) {
    const phone = `07${["01", "02", "72", "75", "78", "77"][i % 6]}${String(100000 + i * 7919).slice(0, 6)}`.slice(0, 10);
    customers.push(await prisma.user.create({ data: { name, email: `demo-bus-customer-${i + 1}@${DEMO_DOMAIN}`, phone, passwordHash, role: "user" } }));
  }
  const loyal = customers.slice(0, 6); // book more often than the rest
  const pickCustomer = () => (rand() < 0.38 ? pick(loyal) : pick(customers));

  // ------------------------------------------------------------------ history: past trips from the sessions
  const today = todayEat();
  const HISTORY_DAYS = 21;
  const schedules = await prisma.busSchedule.findMany({ where: { operatorId: { in: operators.map((o) => o.id) } }, include: { route: { include: { ticketTypes: { orderBy: { sortOrder: "asc" } } } } } });
  const pastRows = [];
  for (const s of schedules) {
    for (const date of enumerateDates(addDaysToDateString(today, -HISTORY_DAYS), addDaysToDateString(today, -1))) {
      if (!s.daysOfWeek.includes(weekdayOf(date))) continue;
      pastRows.push({ scheduleId: s.id, operatorId: s.operatorId, routeId: s.routeId, busTypeId: s.route.busTypeId, departureAt: eatToUtc(date, s.departureTime), seats: s.seats, status: "completed" });
    }
  }
  for (let i = 0; i < pastRows.length; i += 400) await prisma.busTrip.createMany({ data: pastRows.slice(i, i + 400) });

  const opById = new Map(operators.map((o) => [o.id, o]));
  const routeTypes = new Map(schedules.map((s) => [s.routeId, s.route.ticketTypes]));
  const trips = await prisma.busTrip.findMany({ where: { operatorId: { in: operators.map((o) => o.id) }, status: "completed" }, orderBy: { departureAt: "asc" } });
  const upcoming = await prisma.busTrip.findMany({ where: { operatorId: { in: operators.map((o) => o.id) }, status: "scheduled", departureAt: { gt: new Date(), lt: new Date(Date.now() + 8 * 86400000) } }, orderBy: { departureAt: "asc" } });

  const earned = new Map(operators.map((o) => [o.id, 0])); // operator's net share, for wallet balances
  const stats = { bookings: 0, tickets: 0 };

  // One paid order: transaction + booking + tickets. `past` orders were boarded (mostly).
  async function placeOrder(trip, { seatBase, qty, past }) {
    const operator = opById.get(trip.operatorId);
    const types = routeTypes.get(trip.routeId);
    if (!types?.length) return 0;
    const customer = pickCustomer();
    const lines = [];
    let remaining = qty;
    while (remaining > 0) {
      const type = rand() < 0.65 ? types[0] : pick(types);
      const n = Math.min(remaining, between(1, remaining));
      const existing = lines.find((l) => l.ticketTypeId === type.id);
      if (existing) existing.quantity += n;
      else lines.push({ ticketTypeId: type.id, name: type.name, quantity: n, unitPrice: type.price.toString() });
      remaining -= n;
    }
    const subtotal = lines.reduce((sum, l) => sum + Number(l.unitPrice) * l.quantity, 0);
    const fee = Math.round((subtotal * Number(operator.commissionPercent)) / 100);
    const confirmedAt = new Date(Math.max(trip.departureAt.getTime() - between(2, 96) * 3600 * 1000, Date.now() - HISTORY_DAYS * 86400000));
    const txn = await prisma.transaction.create({
      data: { type: "bus_ticket", userId: customer.id, amount: new Prisma.Decimal(subtotal), fee: new Prisma.Decimal(fee), netAmount: new Prisma.Decimal(subtotal - fee), status: "succeeded", reference: `bus-demo-${trip.id}-${stats.bookings}`, metadata: { demo: true }, createdAt: confirmedAt }
    });
    const booking = await prisma.busBooking.create({
      data: {
        reference: makeBookingReference(), userId: customer.id, tripId: trip.id, operatorId: trip.operatorId, transactionId: txn.id, status: "confirmed", seatCount: qty,
        passengerName: customer.name, passengerPhone: customer.phone, passengerEmail: customer.email, payPhone: customer.phone,
        subtotal: new Prisma.Decimal(subtotal), fee: new Prisma.Decimal(fee), total: new Prisma.Decimal(subtotal), lines, expiresAt: new Date(confirmedAt.getTime() + 600000), confirmedAt, createdAt: confirmedAt
      }
    });
    const tickets = [];
    let seat = seatBase;
    for (const l of lines) {
      for (let k = 0; k < l.quantity; k += 1) {
        seat += 1;
        const boarded = past && rand() < 0.93;
        tickets.push({
          bookingId: booking.id, tripId: trip.id, operatorId: trip.operatorId, ticketTypeId: l.ticketTypeId, ticketTypeName: l.name, ticketNumber: makeTicketNumber(), seatNumber: seat, price: new Prisma.Decimal(l.unitPrice),
          passengerName: k === 0 ? customer.name : pick(CUSTOMERS), status: boarded ? "used" : "valid", checkedInAt: boarded ? new Date(trip.departureAt.getTime() - between(8, 35) * 60000) : null
        });
      }
    }
    await prisma.busTicket.createMany({ data: tickets });
    earned.set(trip.operatorId, earned.get(trip.operatorId) + subtotal - fee);
    stats.bookings += 1;
    stats.tickets += qty;
    return qty;
  }

  // Fill a share of each trip's seats with a handful of orders.
  async function fill(trip, { target, past }) {
    let sold = 0;
    let guard = 0;
    while (sold < target && guard < 14) {
      guard += 1;
      const qty = Math.min(trip.seats - sold, rand() < 0.15 ? between(4, 6) : between(1, 3));
      if (qty < 1) break;
      sold += await placeOrder(trip, { seatBase: sold, qty, past });
    }
  }

  for (const trip of trips) {
    if (rand() < 0.4) continue; // not every departure sold
    await fill(trip, { target: Math.max(2, Math.round(trip.seats * (0.12 + rand() * 0.35))), past: true });
  }
  for (const trip of upcoming) {
    const dayAhead = (trip.departureAt.getTime() - Date.now()) / 86400000;
    if (rand() < (dayAhead < 2 ? 0.2 : 0.5)) continue;
    const popular = rand() < 0.18;
    await fill(trip, { target: Math.max(2, Math.round(trip.seats * (popular ? 0.7 + rand() * 0.25 : 0.08 + rand() * 0.3))), past: false });
  }

  // A trip cancelled by its company with passengers waiting on refunds (shows the refund workflow).
  const victim = upcoming.find((t) => t.operatorId === operators[0].id && t.departureAt.getTime() - Date.now() > 36 * 3600 * 1000);
  let refundBookings = 0;
  if (victim) {
    await prisma.busTrip.update({ where: { id: victim.id }, data: { status: "cancelled", note: "Bus broke down at the depot" } });
    await prisma.busTicket.deleteMany({ where: { tripId: victim.id } });
    await prisma.busBooking.deleteMany({ where: { tripId: victim.id } });
    for (let i = 0; i < 3; i += 1) {
      await placeOrder(victim, { seatBase: i * 3, qty: between(1, 3), past: false });
    }
    const orders = await prisma.busBooking.findMany({ where: { tripId: victim.id } });
    for (const o of orders) {
      const net = await prisma.transaction.findUnique({ where: { id: o.transactionId } });
      earned.set(victim.operatorId, earned.get(victim.operatorId) - Number(net.netAmount));
    }
    await prisma.busBooking.updateMany({ where: { tripId: victim.id }, data: { status: "refund_due" } });
    await prisma.busTicket.updateMany({ where: { tripId: victim.id }, data: { status: "cancelled" } });
    refundBookings = orders.length;
    await prisma.busAnnouncement.create({ data: { operatorId: victim.operatorId, tripId: victim.id, title: "Your trip has been cancelled", message: "We're sorry - this trip has been cancelled. Your money will be refunded to the mobile money number you paid from.", kind: "cancellation", recipients: orders.length } });
  }

  // ------------------------------------------------------------------ announcements + payouts + wallets
  for (const [i, op] of operators.entries()) {
    await prisma.busAnnouncement.create({
      data: { operatorId: op.id, title: i % 2 ? "Weekend offer" : "New departure added", message: i % 2 ? "Book three or more tickets this weekend and travel together - our crew will keep your group seated side by side." : "We have added a new late-evening departure. Seats are open for booking now.", kind: i % 2 ? "promotion" : "notice", recipients: between(12, 90), createdAt: new Date(Date.now() - between(2, 12) * 86400000) }
    });
    const gross = earned.get(op.id);
    const paid = Math.round((gross * 0.45) / 1000) * 1000;
    const requested = i % 3 === 0 ? Math.round((gross * 0.15) / 1000) * 1000 : 0;
    if (paid > 10000) await prisma.busPayout.create({ data: { operatorId: op.id, amount: new Prisma.Decimal(paid), phone: op.contactPhone, status: "paid", note: "Sent by MTN MoMo", createdAt: new Date(Date.now() - 6 * 86400000), processedAt: new Date(Date.now() - 5 * 86400000) } });
    if (requested > 10000) await prisma.busPayout.create({ data: { operatorId: op.id, amount: new Prisma.Decimal(requested), phone: op.contactPhone, status: "requested" } });
    await prisma.busOperator.update({ where: { id: op.id }, data: { walletBalance: new Prisma.Decimal(Math.max(0, gross - paid - requested)) } });
  }

  const tripCount = await prisma.busTrip.count({ where: { operatorId: { in: operators.map((o) => o.id) } } });
  log(`Seeded ${operators.length} bus companies, ${tripCount} trips (${HISTORY_DAYS} days of history + the month ahead), ${customers.length} customers, ${stats.bookings} paid orders (${stats.tickets} tickets), ${refundBookings} refunds waiting.`);
  log("Demo company sign-in: demo-bus-<swift|pearl|nile|rwenzori|savannah|teso|kigezi|acholi|elgon|buganda>@seed.gabla.test / DemoBus#2026. Remove with: node scripts/seed-demo-bus.js --clear");
}

main()
  .catch((e) => {
    process.stderr.write(`${e.stack}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
