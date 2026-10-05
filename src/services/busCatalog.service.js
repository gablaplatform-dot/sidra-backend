import { Prisma } from "@prisma/client";

import { AppError } from "../utils/AppError.js";
import { prisma } from "../config/db.js";
import { slugify } from "../utils/busIds.js";
import { addDaysToDateString, eatDateString, eatToUtc, enumerateDates, isDateString, isTimeString, todayEat, weekdayOf } from "../utils/busTime.js";

const notFound = (what, code) => new AppError({ message: `${what} not found`, statusCode: 404, code });
const bad = (message, code) => new AppError({ message, statusCode: 400, code });
const uniqueError = (e) => e?.code === "P2002";

const TRIP_HORIZON_DAYS = 21; // how far ahead trips are materialised when a session is saved

const cleanStops = (stops) =>
  (Array.isArray(stops) ? stops : [])
    .map((s) => ({ name: String(s?.name ?? "").trim().slice(0, 80), offsetMinutes: Math.max(0, Number(s?.offsetMinutes) || 0) }))
    .filter((s) => s.name)
    .slice(0, 20);

const cleanDays = (days) => {
  const list = [...new Set((Array.isArray(days) ? days : []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  return list.length ? list : [0, 1, 2, 3, 4, 5, 6];
};

export class BusCatalogService {
  // ---------------------------------------------------------------- bus types (admin catalog)
  async listTypes({ includeInactive = false } = {}) {
    const rows = await prisma.busType.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
    return { items: rows };
  }

  async createType({ name, description, seats, imageUrl, amenities, sortOrder }) {
    const base = slugify(name);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await prisma.busType.create({
          data: {
            name: String(name).trim(),
            slug: attempt ? `${base}-${attempt + 1}` : base,
            description: description ?? "",
            seats: seats ?? 60,
            imageUrl: imageUrl ?? null,
            amenities: Array.isArray(amenities) ? amenities : [],
            sortOrder: sortOrder ?? 0
          }
        });
      } catch (e) {
        if (!uniqueError(e)) throw e;
      }
    }
    throw bad("Could not create a unique bus type", "BUS_TYPE_SLUG_TAKEN");
  }

  async updateType(id, patch) {
    const existing = await prisma.busType.findUnique({ where: { id } });
    if (!existing) throw notFound("Bus type", "BUS_TYPE_NOT_FOUND");
    const data = {};
    for (const key of ["name", "description", "seats", "imageUrl", "amenities", "sortOrder", "isActive"]) {
      if (patch[key] !== undefined) data[key] = patch[key];
    }
    return prisma.busType.update({ where: { id }, data });
  }

  async deleteType(id) {
    const inUse = await prisma.busRoute.count({ where: { busTypeId: id } });
    if (inUse) return prisma.busType.update({ where: { id }, data: { isActive: false } }); // keep history, just hide it
    await prisma.busType.delete({ where: { id } });
    return { deleted: true };
  }

  // ---------------------------------------------------------------- routes + ticket types
  async _requireRoute(operatorId, routeId) {
    const route = await prisma.busRoute.findFirst({ where: { id: routeId, operatorId } });
    if (!route) throw notFound("Route", "BUS_ROUTE_NOT_FOUND");
    return route;
  }

  async _assertBusType(busTypeId) {
    if (!busTypeId) return null;
    const type = await prisma.busType.findFirst({ where: { id: busTypeId, isActive: true } });
    if (!type) throw bad("Choose a valid bus type", "BUS_TYPE_INVALID");
    return type;
  }

  async listRoutes(operatorId) {
    const rows = await prisma.busRoute.findMany({
      where: { operatorId },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      include: {
        busType: { select: { id: true, name: true, slug: true } },
        ticketTypes: { orderBy: [{ sortOrder: "asc" }, { price: "asc" }] },
        _count: { select: { schedules: true } }
      }
    });
    return { items: rows };
  }

  // Creates a route with its ticket types and (optionally) its first sessions in one go - the same
  // call the onboarding form uses for a new operator's first route.
  async createRoute(operatorId, input) {
    const busType = await this._assertBusType(input.busTypeId);
    const originName = String(input.originName ?? "").trim();
    const destinationName = String(input.destinationName ?? "").trim();
    if (!originName || !destinationName) throw bad("Both the origin and destination are needed", "BUS_ROUTE_PLACES_REQUIRED");
    if (originName.toLowerCase() === destinationName.toLowerCase()) throw bad("Origin and destination must be different", "BUS_ROUTE_SAME_PLACE");

    const ticketTypes = (Array.isArray(input.ticketTypes) ? input.ticketTypes : []).filter((t) => String(t?.name ?? "").trim());
    for (const t of ticketTypes) {
      if (!Number.isFinite(Number(t.price)) || Number(t.price) < 0) throw bad("Ticket prices must be valid amounts in UGX", "BUS_TICKET_PRICE_INVALID");
    }

    const route = await prisma.busRoute.create({
      data: {
        operatorId,
        name: String(input.name || `${originName} - ${destinationName}`).trim().slice(0, 120),
        originName,
        originDistrict: input.originDistrict ?? null,
        destinationName,
        destinationDistrict: input.destinationDistrict ?? null,
        boardingPoint: String(input.boardingPoint ?? "").trim().slice(0, 160),
        dropoffPoint: String(input.dropoffPoint ?? "").trim().slice(0, 160),
        distanceKm: input.distanceKm ?? null,
        durationMinutes: input.durationMinutes ?? 180,
        stops: cleanStops(input.stops),
        busTypeId: busType?.id ?? null,
        ticketTypes: {
          create: ticketTypes.map((t, index) => ({
            name: String(t.name).trim().slice(0, 60),
            description: String(t.description ?? "").slice(0, 200),
            price: new Prisma.Decimal(Math.round(Number(t.price))),
            sortOrder: index
          }))
        }
      },
      include: { ticketTypes: true }
    });

    const schedules = [];
    for (const departure of Array.isArray(input.departures) ? input.departures : []) {
      schedules.push(await this.createSchedule(operatorId, { ...departure, routeId: route.id, seats: departure.seats ?? busType?.seats }));
    }
    return { ...route, schedules };
  }

  async updateRoute(operatorId, routeId, patch) {
    await this._requireRoute(operatorId, routeId);
    const data = {};
    for (const key of ["name", "originName", "originDistrict", "destinationName", "destinationDistrict", "boardingPoint", "dropoffPoint", "distanceKm", "durationMinutes", "isActive"]) {
      if (patch[key] !== undefined) data[key] = patch[key];
    }
    if (patch.stops !== undefined) data.stops = cleanStops(patch.stops);
    if (patch.busTypeId !== undefined) {
      await this._assertBusType(patch.busTypeId);
      data.busTypeId = patch.busTypeId;
    }
    const route = await prisma.busRoute.update({ where: { id: routeId }, data, include: { ticketTypes: true } });
    if (data.isActive === false) await this._dropFutureEmptyTrips({ routeId });
    return route;
  }

  async _ticketTypeFor(operatorId, ticketTypeId) {
    const type = await prisma.busTicketType.findUnique({ where: { id: ticketTypeId }, include: { route: { select: { operatorId: true } } } });
    if (!type || type.route.operatorId !== operatorId) throw notFound("Ticket type", "BUS_TICKET_TYPE_NOT_FOUND");
    return type;
  }

  async createTicketType(operatorId, routeId, { name, price, description }) {
    await this._requireRoute(operatorId, routeId);
    const count = await prisma.busTicketType.count({ where: { routeId } });
    return prisma.busTicketType.create({
      data: { routeId, name: String(name).trim().slice(0, 60), description: description ?? "", price: new Prisma.Decimal(Math.round(Number(price))), sortOrder: count }
    });
  }

  async updateTicketType(operatorId, ticketTypeId, patch) {
    await this._ticketTypeFor(operatorId, ticketTypeId);
    const data = {};
    if (patch.name !== undefined) data.name = String(patch.name).trim().slice(0, 60);
    if (patch.description !== undefined) data.description = patch.description;
    if (patch.price !== undefined) data.price = new Prisma.Decimal(Math.round(Number(patch.price)));
    if (patch.isActive !== undefined) data.isActive = Boolean(patch.isActive);
    if (patch.sortOrder !== undefined) data.sortOrder = patch.sortOrder;
    return prisma.busTicketType.update({ where: { id: ticketTypeId }, data });
  }

  async deleteTicketType(operatorId, ticketTypeId) {
    await this._ticketTypeFor(operatorId, ticketTypeId);
    const sold = await prisma.busTicket.count({ where: { ticketTypeId } });
    if (sold) return prisma.busTicketType.update({ where: { id: ticketTypeId }, data: { isActive: false } }); // sold tickets keep pointing at it
    await prisma.busTicketType.delete({ where: { id: ticketTypeId } });
    return { deleted: true };
  }

  // ---------------------------------------------------------------- sessions (recurring departures)
  async listSchedules(operatorId) {
    const rows = await prisma.busSchedule.findMany({
      where: { operatorId },
      orderBy: [{ isActive: "desc" }, { departureTime: "asc" }],
      include: { route: { select: { id: true, name: true, originName: true, destinationName: true } } }
    });
    return { items: rows.map((s) => ({ ...s, startDate: eatDateString(s.startDate), endDate: s.endDate ? eatDateString(s.endDate) : null })) };
  }

  async createSchedule(operatorId, input) {
    const route = await this._requireRoute(operatorId, input.routeId);
    if (!isTimeString(input.departureTime)) throw bad("Departure time must look like 07:30", "BUS_TIME_INVALID");
    const startDate = input.startDate && isDateString(input.startDate) ? input.startDate : todayEat();
    const endDate = input.endDate && isDateString(input.endDate) ? input.endDate : null;
    if (endDate && endDate < startDate) throw bad("The end date can't be before the start date", "BUS_DATES_INVALID");

    const busType = route.busTypeId ? await prisma.busType.findUnique({ where: { id: route.busTypeId } }) : null;
    const schedule = await prisma.busSchedule.create({
      data: {
        operatorId,
        routeId: route.id,
        name: String(input.name ?? "").trim().slice(0, 80),
        departureTime: input.departureTime,
        daysOfWeek: cleanDays(input.daysOfWeek),
        startDate: eatToUtc(startDate, "00:00"),
        endDate: endDate ? eatToUtc(endDate, "00:00") : null,
        seats: Math.min(120, Math.max(1, Number(input.seats) || busType?.seats || 60))
      }
    });
    await this.ensureTrips({ schedules: [schedule], fromDate: todayEat(), toDate: addDaysToDateString(todayEat(), TRIP_HORIZON_DAYS) });
    return { ...schedule, startDate, endDate };
  }

  async updateSchedule(operatorId, scheduleId, patch) {
    const existing = await prisma.busSchedule.findFirst({ where: { id: scheduleId, operatorId } });
    if (!existing) throw notFound("Session", "BUS_SCHEDULE_NOT_FOUND");
    const data = {};
    if (patch.name !== undefined) data.name = String(patch.name).trim().slice(0, 80);
    if (patch.departureTime !== undefined) {
      if (!isTimeString(patch.departureTime)) throw bad("Departure time must look like 07:30", "BUS_TIME_INVALID");
      data.departureTime = patch.departureTime;
    }
    if (patch.daysOfWeek !== undefined) data.daysOfWeek = cleanDays(patch.daysOfWeek);
    if (patch.startDate !== undefined && isDateString(patch.startDate)) data.startDate = eatToUtc(patch.startDate, "00:00");
    if (patch.endDate !== undefined) data.endDate = patch.endDate && isDateString(patch.endDate) ? eatToUtc(patch.endDate, "00:00") : null;
    if (patch.seats !== undefined) data.seats = Math.min(120, Math.max(1, Number(patch.seats) || existing.seats));
    if (patch.isActive !== undefined) data.isActive = Boolean(patch.isActive);

    const schedule = await prisma.busSchedule.update({ where: { id: scheduleId }, data });
    // Trips nobody has booked yet are rebuilt from the new rule; booked ones are never touched.
    await this._dropFutureEmptyTrips({ scheduleId });
    if (schedule.isActive) {
      await this.ensureTrips({ schedules: [schedule], fromDate: todayEat(), toDate: addDaysToDateString(todayEat(), TRIP_HORIZON_DAYS) });
    }
    return schedule;
  }

  async deleteSchedule(operatorId, scheduleId) {
    const existing = await prisma.busSchedule.findFirst({ where: { id: scheduleId, operatorId } });
    if (!existing) throw notFound("Session", "BUS_SCHEDULE_NOT_FOUND");
    await prisma.busSchedule.update({ where: { id: scheduleId }, data: { isActive: false } });
    await this._dropFutureEmptyTrips({ scheduleId });
    return { deactivated: true };
  }

  // Removes upcoming trips that have no live booking on them (so they stop showing up in search).
  async _dropFutureEmptyTrips({ scheduleId, routeId }) {
    await prisma.busTrip.deleteMany({
      where: {
        ...(scheduleId ? { scheduleId } : {}),
        ...(routeId ? { routeId } : {}),
        departureAt: { gt: new Date() },
        bookings: { none: { status: { in: ["confirmed", "pending_payment", "refund_due"] } } }
      }
    });
  }

  // ---------------------------------------------------------------- trips
  // Idempotently creates the concrete departures a set of sessions implies between two EAT dates.
  // Called when a session is saved and again whenever a customer browses a date range, so nothing
  // needs a background job and a session set up once keeps producing trips forever.
  async ensureTrips({ schedules, fromDate, toDate }) {
    const today = todayEat();
    for (const schedule of schedules) {
      if (!schedule.isActive) continue;
      const route = schedule.route ?? (await prisma.busRoute.findUnique({ where: { id: schedule.routeId }, select: { busTypeId: true, isActive: true } }));
      if (!route?.isActive) continue;

      const scheduleStart = eatDateString(schedule.startDate);
      const scheduleEnd = schedule.endDate ? eatDateString(schedule.endDate) : null;
      const from = [fromDate, scheduleStart, today].sort().pop();
      const to = scheduleEnd && scheduleEnd < toDate ? scheduleEnd : toDate;
      if (from > to) continue;

      const days = new Set(Array.isArray(schedule.daysOfWeek) ? schedule.daysOfWeek : []);
      const wanted = enumerateDates(from, to)
        .filter((date) => days.has(weekdayOf(date)))
        .map((date) => eatToUtc(date, schedule.departureTime))
        .filter((at) => at.getTime() > Date.now());
      if (!wanted.length) continue;

      const existing = await prisma.busTrip.findMany({ where: { scheduleId: schedule.id, departureAt: { in: wanted } }, select: { departureAt: true } });
      const have = new Set(existing.map((t) => t.departureAt.getTime()));
      for (const at of wanted) {
        if (have.has(at.getTime())) continue;
        try {
          await prisma.busTrip.create({
            data: { scheduleId: schedule.id, operatorId: schedule.operatorId, routeId: schedule.routeId, busTypeId: route.busTypeId ?? null, departureAt: at, seats: schedule.seats }
          });
        } catch (e) {
          if (!uniqueError(e)) throw e; // another request created it first: fine
        }
      }
    }
  }

  async ensureTripsForOperator(operatorId, fromDate, toDate) {
    const schedules = await prisma.busSchedule.findMany({ where: { operatorId, isActive: true }, include: { route: { select: { busTypeId: true, isActive: true } } } });
    await this.ensureTrips({ schedules, fromDate, toDate });
  }

  // A single departure that doesn't repeat (a special trip, an extra bus on a busy day).
  async createOneOffTrip(operatorId, { routeId, date, time, seats }) {
    const route = await this._requireRoute(operatorId, routeId);
    if (!isDateString(date) || !isTimeString(time)) throw bad("Choose a valid date and time", "BUS_TRIP_TIME_INVALID");
    const departureAt = eatToUtc(date, time);
    if (departureAt.getTime() <= Date.now()) throw bad("That time has already passed", "BUS_TRIP_IN_PAST");
    const busType = route.busTypeId ? await prisma.busType.findUnique({ where: { id: route.busTypeId } }) : null;
    return prisma.busTrip.create({
      data: { operatorId, routeId, busTypeId: route.busTypeId ?? null, departureAt, seats: Math.min(120, Math.max(1, Number(seats) || busType?.seats || 60)) }
    });
  }
}
