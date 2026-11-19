import { prisma } from "../config/db.js";
import { AppError } from "../utils/AppError.js";
import {
  eatToUtc,
  eatDateString,
  todayEat,
  addDaysToDateString,
} from "../utils/busTime.js";
const bad = (message, code = "BUS_ROUTE_INVALID", statusCode = 400) =>
  new AppError({ message, code, statusCode });
const clean = (v) =>
  String(v || "")
    .trim()
    .replace(/\s+/g, " ");
export class BusRouteDeskService {
  constructor({ catalogService }) {
    this.catalogService = catalogService;
  }
  async create(input) {
    const originName = clean(input.originName),
      destinationName = clean(input.destinationName);
    if (
      !originName ||
      !destinationName ||
      originName.toLowerCase() === destinationName.toLowerCase()
    )
      throw bad("Choose two different towns");
    try {
      return await prisma.busCorridor.create({
        data: {
          originName,
          destinationName,
          key: `${originName.toLowerCase()}|${destinationName.toLowerCase()}`,
          durationMinutes: input.durationMinutes ?? 180,
        },
      });
    } catch (e) {
      if (e.code === "P2002")
        throw bad(
          "This route already exists. Open its card to add another bus.",
          "BUS_ROUTE_EXISTS",
          409,
        );
      throw e;
    }
  }
  async list({ q = "" } = {}) {
    const items = await prisma.busCorridor.findMany({
      where: q
        ? {
            OR: [
              { originName: { contains: q } },
              { destinationName: { contains: q } },
            ],
          }
        : {},
      orderBy: [{ originName: "asc" }, { destinationName: "asc" }],
      include: {
        departures: {
          where: { isActive: true },
          select: {
            operatorId: true,
            vehicleId: true,
            ticketTypes: { where: { isActive: true }, select: { price: true } },
            schedules: { where: { isActive: true }, select: { id: true } },
          },
        },
      },
      take: 200,
    });
    return {
      items: items.map(({ departures, ...r }) => ({
        ...r,
        buses: departures.length,
        companies: new Set(departures.map((x) => x.operatorId)).size,
        departures: departures.reduce((n, d) => n + d.schedules.length, 0),
        priceFrom:
          departures
            .flatMap((d) => d.ticketTypes.map((t) => Number(t.price)))
            .sort((a, b) => a - b)[0] ?? null,
      })),
    };
  }
  async get(id) {
    const route = await prisma.busCorridor.findUnique({
      where: { id },
      include: {
        departures: {
          include: {
            operator: {
              select: {
                id: true,
                companyName: true,
                logoUrl: true,
                isDemo: true,
                status: true,
              },
            },
            vehicle: true,
            ticketTypes: { orderBy: { sortOrder: "asc" } },
            schedules: { orderBy: { departureTime: "asc" } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!route) throw bad("Route not found", "BUS_ROUTE_NOT_FOUND", 404);
    return route;
  }
  async addBus(corridorId, input) {
    const corridor = await this.get(corridorId);
    if (!corridor.isActive) throw bad("This route is paused.");
    const departureAt = eatToUtc(input.date, input.departureTime);
    if (
      !Number.isFinite(+departureAt) ||
      eatDateString(departureAt) !== input.date ||
      departureAt <= new Date()
    )
      throw bad("Choose a departure date and time in the future.");
    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.busOperator.findFirst({
        where: {
          id: input.operatorId,
          status: "active",
          onboardingStatus: "registered",
        },
      });
      if (!company)
        throw bad("Choose an active company", "BUS_OPERATOR_INVALID");
      let vehicle = input.vehicleId
        ? await tx.busVehicle.findFirst({
            where: {
              id: input.vehicleId,
              operatorId: company.id,
              isActive: true,
            },
          })
        : null;
      if (input.vehicleId && !vehicle)
        throw bad(
          "That bus does not belong to the selected company",
          "BUS_VEHICLE_INVALID",
        );
      if (!vehicle) {
        if (!input.bus) throw bad("Choose a bus or enter its details");
        try {
          vehicle = await tx.busVehicle.create({
            data: { operatorId: company.id, ...input.bus },
          });
        } catch (e) {
          if (e.code === "P2002")
            throw bad(
              "This registration is already in this company. Choose the existing bus.",
            );
          throw e;
        }
      }
      const offer = await tx.busRoute.create({
        data: {
          corridorId,
          operatorId: company.id,
          vehicleId: vehicle.id,
          name: `${corridor.originName} → ${corridor.destinationName}`,
          originName: corridor.originName,
          destinationName: corridor.destinationName,
          boardingPoint: input.pickupName,
          boardingLat: input.pickupLat,
          boardingLng: input.pickupLng,
          dropoffPoint: input.dropoffPoint || corridor.destinationName,
          durationMinutes: input.durationMinutes ?? corridor.durationMinutes,
          ticketTypes: {
            create: [
              {
                name: input.fareName || "Standard",
                price: input.price,
                description: input.extras || "",
              },
            ],
          },
        },
      });
      const schedule = await tx.busSchedule.create({
        data: {
          operatorId: company.id,
          routeId: offer.id,
          departureTime: input.departureTime,
          startDate: eatToUtc(input.date, "00:00"),
          endDate: input.repeatDaily ? null : eatToUtc(input.date, "00:00"),
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          seats: vehicle.seats,
        },
      });
      return { offer, schedule };
    });
    await this.catalogService.ensureTrips({
      schedules: [result.schedule],
      fromDate: input.date,
      toDate: input.repeatDaily
        ? addDaysToDateString(input.date, 21)
        : input.date,
    });
    return result.offer;
  }
  async trips(id, { from, to } = {}) {
    await this.get(id);
    const start = from || todayEat(),
      end = to || addDaysToDateString(start, 6);
    if (end < start || end > addDaysToDateString(start, 31))
      throw bad("Choose a date range of up to 31 days");
    const schedules = await prisma.busSchedule.findMany({
      where: { isActive: true, route: { corridorId: id, isActive: true } },
      include: { route: true },
    });
    await this.catalogService.ensureTrips({
      schedules,
      fromDate: start,
      toDate: end,
    });
    const items = await prisma.busTrip.findMany({
      where: {
        route: { corridorId: id },
        departureAt: {
          gte: eatToUtc(start, "00:00"),
          lt: eatToUtc(addDaysToDateString(end, 1), "00:00"),
        },
      },
      include: {
        operator: { select: { id: true, companyName: true, isDemo: true } },
        vehicle: true,
        route: { include: { ticketTypes: true } },
        _count: { select: { tickets: true } },
      },
      orderBy: { departureAt: "asc" },
      take: 500,
    });
    return { items };
  }
}
