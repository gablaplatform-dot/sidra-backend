// Seeds Gabla Bus demo data for presenting/testing: bus types, 6 bus companies with parks, routes,
// ticket types and recurring sessions, plus a handful of paid tickets so dashboards aren't empty.
// Everything is owned by users on DEMO_EMAIL (demo-bus-*@seed.gabla.test), so:
//
//   node scripts/seed-demo-bus.js           seed (replaces any previous demo bus data)
//   node scripts/seed-demo-bus.js --clear   remove every demo bus company, trip and ticket
//
// The bus TYPES (Gagga, Baby Coach...) are a shared catalogue the admin manages, so --clear keeps them.
import dotenv from "dotenv";
import { Prisma, PrismaClient } from "@prisma/client";

import { BusCatalogService } from "../src/services/busCatalog.service.js";
import { slugify, makeBookingReference, makeTicketNumber } from "../src/utils/busIds.js";
import { addDaysToDateString, todayEat } from "../src/utils/busTime.js";
import { hashPassword } from "../src/utils/password.js";

dotenv.config();
const prisma = new PrismaClient();
const log = (m) => process.stdout.write(`${m}\n`);
const DEMO_DOMAIN = "seed.gabla.test";
const isDemoEmail = { endsWith: `@${DEMO_DOMAIN}` };

const TYPES = [
  { name: "Gagga Coach", seats: 67, description: "Full-size luxury coach for the long upcountry routes.", amenities: ["Air conditioning", "Reclining seats", "Charging ports", "Luggage hold"] },
  { name: "Baby Coach", seats: 33, description: "Smaller, faster coach - fewer stops and a quieter ride.", amenities: ["Air conditioning", "Charging ports", "Luggage hold"] },
  { name: "Executive VIP", seats: 45, description: "Extra legroom, snacks onboard and a hostess.", amenities: ["Air conditioning", "Extra legroom", "Free snack", "WiFi", "Charging ports"] },
  { name: "Mini Bus", seats: 14, description: "Quick shuttle for short trips between towns.", amenities: ["Air conditioning"] }
];

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];

const COMPANIES = [
  {
    key: "swift", companyName: "Swift Safaris Express", parkName: "Old Taxi Park", parkDistrict: "Kampala", parkAddress: "Namirembe Road, Old Taxi Park, Kampala", parkLat: 0.3136, parkLng: 32.5811, fleet: 24, phone: "0772100101",
    description: "Reliable daily departures from the heart of Kampala to the west and south-west.",
    routes: [
      { dest: "Mbarara", type: "Gagga Coach", mins: 270, km: 270, prices: [["Economy", 35000], ["Business", 45000]], times: ["06:30", "09:00", "13:00", "22:30"], days: ALL_DAYS },
      { dest: "Kabale", type: "Gagga Coach", mins: 480, km: 410, prices: [["Economy", 50000], ["Business", 65000]], times: ["07:00", "21:00"], days: ALL_DAYS },
      { dest: "Kasese", type: "Executive VIP", mins: 420, km: 360, prices: [["VIP", 60000]], times: ["08:00"], days: ALL_DAYS }
    ]
  },
  {
    key: "pearl", companyName: "Pearl Coaches", parkName: "Namayiba Bus Park", parkDistrict: "Kampala", parkAddress: "Entebbe Road, Namayiba Bus Park", parkLat: 0.3064, parkLng: 32.5686, fleet: 18, phone: "0701200202",
    description: "Comfortable Baby Coach service to the north and east, leaving on time.",
    routes: [
      { dest: "Gulu", type: "Baby Coach", mins: 330, km: 340, prices: [["Economy", 40000], ["VIP", 55000]], times: ["06:00", "10:00", "14:30"], days: ALL_DAYS },
      { dest: "Lira", type: "Baby Coach", mins: 300, km: 340, prices: [["Economy", 35000]], times: ["07:30", "15:00"], days: ALL_DAYS },
      { dest: "Arua", type: "Gagga Coach", mins: 540, km: 480, prices: [["Economy", 55000], ["VIP", 70000]], times: ["20:00"], days: ALL_DAYS }
    ]
  },
  {
    key: "nile", companyName: "Nile Link Bus", parkName: "Jinja Road Bus Terminal", parkDistrict: "Kampala", parkAddress: "Jinja Road, Nakawa", parkLat: 0.3231, parkLng: 32.6150, fleet: 15, phone: "0752300303",
    description: "Eastern Uganda specialists - Jinja, Mbale, Tororo and beyond.",
    routes: [
      { dest: "Jinja", type: "Mini Bus", mins: 90, km: 80, prices: [["Standard", 10000]], times: ["06:00", "08:00", "10:00", "12:00", "14:00", "16:00"], days: ALL_DAYS },
      { dest: "Mbale", type: "Baby Coach", mins: 240, km: 225, prices: [["Economy", 25000], ["Business", 32000]], times: ["07:00", "11:00", "16:00"], days: ALL_DAYS },
      { dest: "Busia", type: "Baby Coach", mins: 270, km: 200, prices: [["Economy", 28000]], times: ["09:00"], days: WEEKDAYS }
    ]
  },
  {
    key: "rwenzori", companyName: "Rwenzori Express", parkName: "Kampala Coach Terminal", parkDistrict: "Kampala", parkAddress: "Kampala Road, Coach Terminal", parkLat: 0.3152, parkLng: 32.5790, fleet: 12, phone: "0782400404",
    description: "Overnight and morning coaches to Fort Portal, Kasese and the mountains.",
    routes: [
      { dest: "Fort Portal", type: "Executive VIP", mins: 330, km: 295, prices: [["VIP", 45000], ["Economy", 35000]], times: ["06:30", "14:00", "22:00"], days: ALL_DAYS },
      { dest: "Hoima", type: "Baby Coach", mins: 270, km: 210, prices: [["Economy", 30000]], times: ["08:30"], days: ALL_DAYS }
    ]
  },
  {
    key: "savannah", companyName: "Savannah Coaches", parkName: "Mbarara Main Park", parkDistrict: "Mbarara", parkAddress: "High Street, Mbarara Main Park", parkLat: -0.6072, parkLng: 30.6545, fleet: 9, phone: "0773500505",
    description: "Heading back to Kampala from the south-west, several times a day.",
    routes: [
      { orig: "Mbarara", dest: "Kampala", type: "Gagga Coach", mins: 270, km: 270, prices: [["Economy", 35000], ["Business", 45000]], times: ["06:00", "09:30", "13:30", "21:30"], days: ALL_DAYS },
      { orig: "Mbarara", dest: "Kabale", type: "Mini Bus", mins: 150, km: 140, prices: [["Standard", 20000]], times: ["07:00", "12:00", "17:00"], days: ALL_DAYS }
    ]
  },
  {
    key: "teso", companyName: "Teso Star Coaches", parkName: "Soroti Bus Park", parkDistrict: "Soroti", parkAddress: "Soroti Main Bus Park", parkLat: 1.7147, parkLng: 33.6111, fleet: 7, phone: "0704600606",
    description: "North-eastern routes with a friendly crew and fair prices.",
    routes: [
      { orig: "Soroti", dest: "Kampala", type: "Baby Coach", mins: 330, km: 300, prices: [["Economy", 30000]], times: ["06:30", "12:00"], days: ALL_DAYS },
      { orig: "Soroti", dest: "Mbale", type: "Mini Bus", mins: 150, km: 130, prices: [["Standard", 15000]], times: ["09:00", "15:00"], days: ALL_DAYS }
    ]
  }
];

async function clearDemo() {
  const users = await prisma.user.findMany({ where: { email: { ...isDemoEmail, startsWith: "demo-bus-" } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  const customers = await prisma.user.findMany({ where: { email: { ...isDemoEmail, startsWith: "demo-bus-customer-" } }, select: { id: true } });
  // Transactions are not cascaded from bookings, so remove the demo customers' bus payments first.
  await prisma.transaction.deleteMany({ where: { type: "bus_ticket", userId: { in: customers.map((c) => c.id) } } });
  const removed = await prisma.user.deleteMany({ where: { id: { in: ids } } }); // cascades operators, routes, trips, bookings, tickets
  log(`Cleared demo bus data: ${removed.count} users (companies + customers).`);
}

async function main() {
  await clearDemo();
  if (process.argv.includes("--clear")) return;

  const catalog = new BusCatalogService();
  const typeByName = new Map();
  for (const t of TYPES) {
    let row = await prisma.busType.findFirst({ where: { name: t.name } });
    if (!row) row = await catalog.createType(t);
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
  const operators = [];
  for (const c of COMPANIES) {
    const user = await prisma.user.create({ data: { name: `${c.companyName} (demo)`, email: `demo-bus-${c.key}@${DEMO_DOMAIN}`, phone: c.phone, passwordHash, role: "bus_operator" } });
    const operator = await prisma.busOperator.create({
      data: {
        userId: user.id,
        companyName: c.companyName,
        slug: slugify(c.companyName),
        description: c.description,
        parkName: c.parkName,
        parkDistrict: c.parkDistrict,
        parkAddress: c.parkAddress,
        parkLat: c.parkLat,
        parkLng: c.parkLng,
        fleetSize: c.fleet,
        contactPhone: c.phone,
        whatsapp: c.phone,
        customFields: { licence_number: `UG-BUS-${Math.floor(1000 + Math.random() * 9000)}`, years_operating: 6, services: ["Air conditioning", "Charging ports"], has_insurance: true },
        onboardingStatus: "registered",
        registeredAt: new Date(),
        ratingAvg: 4 + Math.random() * 0.9,
        ratingCount: 20 + Math.floor(Math.random() * 180)
      }
    });
    for (const r of c.routes) {
      const type = typeByName.get(r.type);
      const origin = r.orig ?? "Kampala";
      await catalog.createRoute(operator.id, {
        name: `${origin} - ${r.dest}`,
        originName: origin,
        destinationName: r.dest,
        boardingPoint: c.parkName,
        dropoffPoint: `${r.dest} main bus park`,
        distanceKm: r.km,
        durationMinutes: r.mins,
        busTypeId: type.id,
        ticketTypes: r.prices.map(([name, price]) => ({ name, price })),
        departures: r.times.map((time) => ({ departureTime: time, daysOfWeek: r.days, name: time < "12:00" ? "Morning" : time < "18:00" ? "Afternoon" : "Night", seats: type.seats }))
      });
    }
    operators.push(operator);
  }

  // A few customers with paid tickets so the dashboards, customer lists and "my tickets" have life.
  const customers = [];
  for (const [i, name] of ["Aisha Namukasa", "Brian Okello", "Grace Atim", "Moses Byaruhanga", "Sarah Nakato"].entries()) {
    customers.push(await prisma.user.create({ data: { name, email: `demo-bus-customer-${i + 1}@${DEMO_DOMAIN}`, phone: `07010000${10 + i}`, passwordHash, role: "user" } }));
  }

  let bookings = 0;
  for (const operator of operators) {
    const trips = await prisma.busTrip.findMany({
      where: { operatorId: operator.id, departureAt: { gt: new Date() } },
      orderBy: { departureAt: "asc" },
      take: 6,
      include: { route: { include: { ticketTypes: { orderBy: { sortOrder: "asc" } } } } }
    });
    for (const [index, trip] of trips.entries()) {
      const customer = customers[(index + bookings) % customers.length];
      const type = trip.route.ticketTypes[0];
      if (!type) continue;
      const qty = 1 + (index % 3);
      const subtotal = Number(type.price) * qty;
      const fee = Math.round((subtotal * Number(operator.commissionPercent)) / 100);
      const txn = await prisma.transaction.create({
        data: { type: "bus_ticket", userId: customer.id, amount: new Prisma.Decimal(subtotal), fee: new Prisma.Decimal(fee), netAmount: new Prisma.Decimal(subtotal - fee), status: "succeeded", reference: `bus-demo-${operator.slug}-${index}-${Date.now()}`, metadata: { demo: true } }
      });
      const booking = await prisma.busBooking.create({
        data: {
          reference: makeBookingReference(),
          userId: customer.id,
          tripId: trip.id,
          operatorId: operator.id,
          transactionId: txn.id,
          status: "confirmed",
          seatCount: qty,
          passengerName: customer.name,
          passengerPhone: customer.phone,
          passengerEmail: customer.email,
          payPhone: customer.phone,
          subtotal: new Prisma.Decimal(subtotal),
          fee: new Prisma.Decimal(fee),
          total: new Prisma.Decimal(subtotal),
          lines: [{ ticketTypeId: type.id, name: type.name, quantity: qty, unitPrice: type.price.toString() }],
          expiresAt: new Date(Date.now() + 600000),
          confirmedAt: new Date(Date.now() - (index + 1) * 3600 * 1000)
        }
      });
      for (let s = 0; s < qty; s += 1) {
        await prisma.busTicket.create({
          data: { bookingId: booking.id, tripId: trip.id, operatorId: operator.id, ticketTypeId: type.id, ticketTypeName: type.name, ticketNumber: makeTicketNumber(), seatNumber: index * 4 + s + 1, price: type.price, passengerName: customer.name }
        });
      }
      await prisma.busOperator.update({ where: { id: operator.id }, data: { walletBalance: { increment: new Prisma.Decimal(subtotal - fee) } } });
      bookings += 1;
    }
  }

  const tripCount = await prisma.busTrip.count({ where: { operatorId: { in: operators.map((o) => o.id) } } });
  log(`Seeded ${operators.length} bus companies, ${tripCount} upcoming trips (next ${addDaysToDateString(todayEat(), 30)}), ${bookings} paid bookings.`);
  log("Demo operator sign-in: demo-bus-swift@seed.gabla.test / DemoBus#2026 (also pearl, nile, rwenzori, savannah, teso). Remove with: node scripts/seed-demo-bus.js --clear");
}

main()
  .catch((e) => {
    process.stderr.write(`${e.stack}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
