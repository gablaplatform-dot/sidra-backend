/* eslint-disable no-console */
// Additive presentation fixtures. No customers, bookings, payments, ratings or withdrawals.
// Demo companies cannot accept payments; their contacts and bus registrations are fictional.
import { prisma } from "../src/config/db.js";
import { BusCatalogService } from "../src/services/busCatalog.service.js";
import { todayEat, addDaysToDateString } from "../src/utils/busTime.js";
if (
  process.env.NODE_ENV === "production" &&
  !process.argv.includes("--allow-demo-catalogue")
)
  throw Error(
    "Use a test database, or explicitly allow the payment-disabled demo catalogue.",
  );
const catalog = new BusCatalogService();
const companies = [
  {
    key: "western",
    name: "Demo · Western Uganda Coaches",
    stage: "Kisenyi Bus Terminal",
    district: "Kampala",
    lat: 0.3076,
    lng: 32.5708,
    destinations: [
      ["Mbarara", 270, 35000],
      ["Kabale", 420, 50000],
      ["Fort Portal", 300, 40000],
      ["Hoima", 210, 30000],
    ],
  },
  {
    key: "northern",
    name: "Demo · Northern Uganda Express",
    stage: "Namayiba Bus Park",
    district: "Kampala",
    lat: 0.3198,
    lng: 32.5702,
    destinations: [
      ["Gulu", 330, 40000],
      ["Lira", 330, 40000],
      ["Arua", 480, 60000],
      ["Hoima", 240, 28000],
    ],
  },
  {
    key: "eastern",
    name: "Demo · Eastern Uganda Link",
    stage: "Kampala Coach Stage",
    district: "Kampala",
    lat: 0.3151,
    lng: 32.5791,
    destinations: [
      ["Jinja", 120, 18000],
      ["Mbale", 270, 30000],
      ["Soroti", 360, 40000],
    ],
  },
  {
    key: "lakeside",
    name: "Demo · Lakeside Shuttle",
    stage: "Entebbe Taxi Park",
    district: "Entebbe",
    lat: 0.0612,
    lng: 32.4611,
    destinations: [
      ["Kampala", 90, 15000],
      ["Masaka", 210, 30000],
    ],
  },
];
let buses = 0,
  routes = 0;
try {
  for (const [i, c] of companies.entries()) {
    const id = `demo-managed-bus-${c.key}`;
    const user = await prisma.user.upsert({
      where: { id },
      update: {},
      create: {
        id,
        name: "Demo bus contact",
        role: "bus_operator",
        isActive: false,
        email: `${id}@seed.gabla.test`,
      },
    });
    const op = await prisma.busOperator.upsert({
      where: { id },
      update: {},
      create: {
        id,
        userId: user.id,
        companyName: c.name,
        slug: id,
        contactName: "Demo operations contact",
        contactPhone: "0000000000",
        description:
          "Fictional Uganda operator for presentation and testing only. Not a real transport company. Payments disabled.",
        parkName: c.stage,
        parkDistrict: c.district,
        parkAddress: `${c.stage}, ${c.district}, Uganda`,
        parkLat: c.lat,
        parkLng: c.lng,
        managedByGabla: true,
        isDemo: true,
        onboardingStatus: "registered",
        registeredAt: new Date(),
        commissionPercent: 5,
      },
    });
    for (const [n, [destination, minutes, price]] of c.destinations.entries()) {
      const vehicleId = `${id}-bus-${n + 1}`,
        routeId = `${id}-route-${n + 1}`;
      const vehicle = await prisma.busVehicle.upsert({
        where: { id: vehicleId },
        update: {},
        create: {
          id: vehicleId,
          operatorId: op.id,
          name: `${n % 2 ? "Executive" : "Standard"} coach`,
          registration: `DEMO-${i + 1}0${n + 1}`,
          contactName: `Demo ${destination} dispatcher`,
          contactPhone: "0000000000",
          seats: n % 2 ? 45 : 60,
          cancellationMinutes: n % 2 ? 180 : 120,
          amenities: [
            "USB charging",
            "Luggage hold",
            ...(n % 2 ? ["Air conditioning", "Extra legroom"] : []),
          ],
        },
      });
      buses++;
      const corridor = await prisma.busCorridor.upsert({
        where: {
          key: `${c.district.toLowerCase()}|${destination.toLowerCase()}`,
        },
        update: {},
        create: {
          key: `${c.district.toLowerCase()}|${destination.toLowerCase()}`,
          originName: c.district,
          destinationName: destination,
          durationMinutes: minutes,
        },
      });
      let route = await prisma.busRoute.findUnique({ where: { id: routeId } });
      if (!route) {
        route = await prisma.busRoute.create({
          data: {
            id: routeId,
            operatorId: op.id,
            corridorId: corridor.id,
            boardingLat: c.lat,
            boardingLng: c.lng,
            vehicleId,
            name: `${c.district} → ${destination}`,
            originName: c.district,
            destinationName: destination,
            boardingPoint: c.stage,
            dropoffPoint: `${destination} town stage`,
            durationMinutes: minutes,
            ticketTypes: {
              create: [
                { name: "Standard", price },
                {
                  name: "Extra comfort",
                  price: price + 10000,
                  description: "Reclining seat and extra legroom",
                  sortOrder: 1,
                },
              ],
            },
          },
        });
      }
      if (!route.corridorId)
        await prisma.busRoute.update({
          where: { id: route.id },
          data: {
            corridorId: corridor.id,
            boardingLat: c.lat,
            boardingLng: c.lng,
          },
        });
      routes++;
      for (const time of ["07:00", "13:00", "20:00"]) {
        const existing = await prisma.busSchedule.findFirst({
          where: { routeId: route.id, departureTime: time },
        });
        if (!existing)
          await catalog.createSchedule(op.id, {
            routeId: route.id,
            departureTime: time,
            seats: vehicle.seats,
          });
      }
    }
    await catalog.ensureTripsForOperator(
      op.id,
      todayEat(),
      addDaysToDateString(todayEat(), 21),
    );
  }
  console.log(
    JSON.stringify({
      companies: companies.length,
      buses,
      routes,
      note: "Additive fixtures; no transactions or bookings; payments disabled.",
    }),
  );
} finally {
  await prisma.$disconnect();
}
