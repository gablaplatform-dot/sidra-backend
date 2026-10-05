import crypto from "crypto";
import QRCode from "qrcode";

import { AppError } from "../utils/AppError.js";
import { prisma } from "../config/db.js";
import { centsToDecimal, feeFromPercentCents, parseMoneyToCents } from "../utils/money.js";
import { makeBookingReference, makeTicketNumber } from "../utils/busIds.js";
import { addDaysToDateString, eatDateString, eatDayBounds, isDateString, todayEat } from "../utils/busTime.js";
import { qrUrl } from "./busEmail.service.js";

const bad = (message, code, statusCode = 400) => new AppError({ message, statusCode, code });
const MAX_TICKETS_PER_BOOKING = 10;
const BOARDING_CUTOFF_MS = 10 * 60 * 1000; // sales close 10 minutes before departure
const MAX_CALENDAR_DAYS = 62;
const ACTIVE_OPERATOR = { status: "active", onboardingStatus: "registered" };

const money = (value) => (value === null || value === undefined ? "0" : value.toString());

// A route is bookable only while the company, the route and its trip are all live.
const liveRouteWhere = ({ from, to, operatorId, operatorSlug, busTypeId } = {}) => ({
  isActive: true,
  operator: { ...ACTIVE_OPERATOR, ...(operatorSlug ? { slug: operatorSlug } : {}) },
  ...(operatorId ? { operatorId } : {}),
  ...(from ? { originName: { contains: from.trim() } } : {}),
  ...(to ? { destinationName: { contains: to.trim() } } : {}),
  ...(busTypeId ? { busTypeId } : {})
});

export class BusBookingService {
  constructor({ mobileMoneyService, emailService, walletService, catalogService, operatorService, callbackUrls }) {
    this.mobileMoneyService = mobileMoneyService;
    this.emailService = emailService;
    this.walletService = walletService;
    this.catalogService = catalogService;
    this.operatorService = operatorService;
    this.callbackUrls = callbackUrls;
  }

  // ------------------------------------------------------------------ availability
  // Seats that are gone for a trip: sold tickets plus seats held by bookings still awaiting
  // payment (a hold lapses after the settings' hold window so an abandoned checkout frees up).
  async seatsTaken(tripIds, db = prisma) {
    const taken = new Map(tripIds.map((id) => [id, 0]));
    if (!tripIds.length) return taken;
    const [sold, held] = await Promise.all([
      db.busTicket.groupBy({ by: ["tripId"], where: { tripId: { in: tripIds }, status: { not: "cancelled" } }, _count: true }),
      db.busBooking.groupBy({ by: ["tripId"], where: { tripId: { in: tripIds }, status: "pending_payment", expiresAt: { gt: new Date() } }, _sum: { seatCount: true } })
    ]);
    for (const row of sold) taken.set(row.tripId, (taken.get(row.tripId) ?? 0) + row._count);
    for (const row of held) taken.set(row.tripId, (taken.get(row.tripId) ?? 0) + (row._sum.seatCount ?? 0));
    return taken;
  }

  _tripDto(trip, taken, extra = {}) {
    const ticketTypes = (trip.route.ticketTypes ?? []).filter((t) => t.isActive);
    const prices = ticketTypes.map((t) => Number(t.price));
    const seatsLeft = Math.max(0, trip.seats - (taken.get(trip.id) ?? 0));
    const bookable = trip.status === "scheduled" && trip.departureAt.getTime() - Date.now() > BOARDING_CUTOFF_MS && ticketTypes.length > 0;
    return {
      id: trip.id,
      departureAt: trip.departureAt,
      delayMinutes: trip.delayMinutes,
      status: trip.status,
      note: trip.note,
      seats: trip.seats,
      seatsLeft,
      soldOut: seatsLeft === 0,
      bookable: bookable && seatsLeft > 0,
      priceFrom: prices.length ? String(Math.min(...prices)) : null,
      route: {
        id: trip.route.id,
        name: trip.route.name,
        originName: trip.route.originName,
        destinationName: trip.route.destinationName,
        boardingPoint: trip.route.boardingPoint,
        dropoffPoint: trip.route.dropoffPoint,
        durationMinutes: trip.route.durationMinutes,
        distanceKm: trip.route.distanceKm,
        stops: trip.route.stops
      },
      operator: {
        id: trip.operator.id,
        companyName: trip.operator.companyName,
        slug: trip.operator.slug,
        logoUrl: trip.operator.logoUrl,
        parkName: trip.operator.parkName,
        parkDistrict: trip.operator.parkDistrict,
        ratingAvg: trip.operator.ratingAvg,
        ratingCount: trip.operator.ratingCount
      },
      busType: trip.busType ? { id: trip.busType.id, name: trip.busType.name, slug: trip.busType.slug, imageUrl: trip.busType.imageUrl, amenities: trip.busType.amenities } : null,
      ...extra
    };
  }

  get _tripInclude() {
    return {
      route: { include: { ticketTypes: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { price: "asc" }] } } },
      operator: { select: { id: true, companyName: true, slug: true, logoUrl: true, parkName: true, parkDistrict: true, parkAddress: true, contactPhone: true, whatsapp: true, ratingAvg: true, ratingCount: true } },
      busType: true
    };
  }

  // ------------------------------------------------------------------ discovery
  async places() {
    const routes = await prisma.busRoute.findMany({ where: liveRouteWhere(), select: { originName: true, destinationName: true } });
    const uniq = (list) => [...new Set(list)].sort((a, b) => a.localeCompare(b));
    return { origins: uniq(routes.map((r) => r.originName)), destinations: uniq(routes.map((r) => r.destinationName)) };
  }

  async popularRoutes({ limit = 8 } = {}) {
    const routes = await prisma.busRoute.findMany({
      where: liveRouteWhere(),
      select: { originName: true, destinationName: true, operatorId: true, ticketTypes: { where: { isActive: true }, select: { price: true } }, _count: { select: { trips: true } } }
    });
    const pairs = new Map();
    for (const r of routes) {
      const key = `${r.originName}|${r.destinationName}`;
      const entry = pairs.get(key) ?? { from: r.originName, to: r.destinationName, operators: new Set(), minPrice: null, trips: 0 };
      entry.operators.add(r.operatorId);
      entry.trips += r._count.trips;
      for (const t of r.ticketTypes) entry.minPrice = entry.minPrice === null ? Number(t.price) : Math.min(entry.minPrice, Number(t.price));
      pairs.set(key, entry);
    }
    return {
      items: [...pairs.values()]
        .sort((a, b) => b.operators.size - a.operators.size || b.trips - a.trips)
        .slice(0, limit)
        .map((p) => ({ from: p.from, to: p.to, companies: p.operators.size, minPrice: p.minPrice === null ? null : String(p.minPrice) }))
    };
  }

  async listTypes() {
    const { items } = await this.catalogService.listTypes();
    const upcoming = await prisma.busTrip.groupBy({
      by: ["busTypeId"],
      where: { status: "scheduled", departureAt: { gt: new Date() }, route: liveRouteWhere() },
      _count: true
    });
    const counts = new Map(upcoming.map((u) => [u.busTypeId, u._count]));
    return { items: items.map((t) => ({ ...t, upcomingTrips: counts.get(t.id) ?? 0 })) };
  }

  _parkDto(op, extra = {}) {
    return {
      id: op.id,
      slug: op.slug,
      companyName: op.companyName,
      description: op.description,
      logoUrl: op.logoUrl,
      coverUrl: op.coverUrl,
      parkName: op.parkName,
      parkDistrict: op.parkDistrict,
      parkAddress: op.parkAddress,
      parkLat: op.parkLat,
      parkLng: op.parkLng,
      fleetSize: op.fleetSize,
      contactPhone: op.contactPhone,
      whatsapp: op.whatsapp,
      ratingAvg: op.ratingAvg,
      ratingCount: op.ratingCount,
      ...extra
    };
  }

  async listParks({ q, district, busTypeId } = {}) {
    const operators = await prisma.busOperator.findMany({
      where: {
        ...ACTIVE_OPERATOR,
        ...(district ? { parkDistrict: district } : {}),
        ...(q ? { OR: [{ companyName: { contains: q } }, { parkName: { contains: q } }] } : {}),
        ...(busTypeId ? { routes: { some: { busTypeId, isActive: true } } } : {})
      },
      orderBy: [{ ratingAvg: "desc" }, { companyName: "asc" }],
      include: { routes: { where: { isActive: true }, select: { originName: true, destinationName: true, ticketTypes: { where: { isActive: true }, select: { price: true } } } } },
      take: 100
    });
    return {
      items: operators
        .filter((op) => op.routes.length)
        .map((op) => {
          const prices = op.routes.flatMap((r) => r.ticketTypes.map((t) => Number(t.price)));
          return this._parkDto(op, {
            routeCount: op.routes.length,
            destinations: [...new Set(op.routes.map((r) => r.destinationName))].slice(0, 4),
            priceFrom: prices.length ? String(Math.min(...prices)) : null
          });
        })
    };
  }

  async getPark(slug) {
    const op = await prisma.busOperator.findFirst({
      where: { slug, ...ACTIVE_OPERATOR },
      include: { routes: { where: { isActive: true }, include: { busType: true, ticketTypes: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { price: "asc" }] } } } }
    });
    if (!op) throw bad("Bus company not found", "BUS_OPERATOR_NOT_FOUND", 404);
    return {
      ...this._parkDto(op),
      routes: op.routes.map((r) => ({
        id: r.id,
        name: r.name,
        originName: r.originName,
        destinationName: r.destinationName,
        boardingPoint: r.boardingPoint,
        durationMinutes: r.durationMinutes,
        busType: r.busType ? { id: r.busType.id, name: r.busType.name, slug: r.busType.slug } : null,
        ticketTypes: r.ticketTypes.map((t) => ({ id: t.id, name: t.name, description: t.description, price: money(t.price) }))
      }))
    };
  }

  async _ensureForFilters(filters, fromDate, toDate) {
    const schedules = await prisma.busSchedule.findMany({
      where: { isActive: true, route: liveRouteWhere(filters) },
      include: { route: { select: { busTypeId: true, isActive: true } } },
      take: 300
    });
    await this.catalogService.ensureTrips({ schedules, fromDate, toDate });
  }

  async searchTrips({ date, from, to, operatorSlug, busTypeId, limit = 100 } = {}) {
    const day = isDateString(date) ? date : todayEat();
    const filters = { from, to, operatorSlug, busTypeId };
    await this._ensureForFilters(filters, day, day);

    const { start, end } = eatDayBounds(day);
    const earliest = new Date(Math.max(start.getTime(), Date.now()));
    const trips = await prisma.busTrip.findMany({
      where: { status: "scheduled", departureAt: { gte: earliest, lt: end }, route: liveRouteWhere(filters), operator: ACTIVE_OPERATOR },
      include: this._tripInclude,
      orderBy: { departureAt: "asc" },
      take: Math.min(200, Number(limit) || 100)
    });
    const taken = await this.seatsTaken(trips.map((t) => t.id));
    return { date: day, items: trips.map((t) => this._tripDto(t, taken)), total: trips.length };
  }

  // Per-day availability for the date strip / month calendar: how many departures, from what price.
  async calendar({ from, to, fromPlace, toPlace, operatorSlug, busTypeId } = {}) {
    const start = isDateString(from) ? from : todayEat();
    let end = isDateString(to) ? to : addDaysToDateString(start, 30);
    if (end > addDaysToDateString(start, MAX_CALENDAR_DAYS - 1)) end = addDaysToDateString(start, MAX_CALENDAR_DAYS - 1);
    const filters = { from: fromPlace, to: toPlace, operatorSlug, busTypeId };
    await this._ensureForFilters(filters, start, end);

    const trips = await prisma.busTrip.findMany({
      where: { status: "scheduled", departureAt: { gte: new Date(Math.max(eatDayBounds(start).start.getTime(), Date.now())), lt: eatDayBounds(end).end }, route: liveRouteWhere(filters), operator: ACTIVE_OPERATOR },
      include: { route: { select: { ticketTypes: { where: { isActive: true }, select: { price: true } } } } },
      take: 3000
    });
    const taken = await this.seatsTaken(trips.map((t) => t.id));
    const days = {};
    for (const trip of trips) {
      const key = eatDateString(trip.departureAt);
      const left = Math.max(0, trip.seats - (taken.get(trip.id) ?? 0));
      const prices = trip.route.ticketTypes.map((t) => Number(t.price));
      const entry = (days[key] ??= { trips: 0, seatsLeft: 0, minPrice: null });
      entry.trips += 1;
      entry.seatsLeft += left;
      if (prices.length) entry.minPrice = entry.minPrice === null ? Math.min(...prices) : Math.min(entry.minPrice, ...prices);
    }
    return { from: start, to: end, days };
  }

  async getTrip(id) {
    const trip = await prisma.busTrip.findFirst({ where: { id, operator: ACTIVE_OPERATOR }, include: this._tripInclude });
    if (!trip) throw bad("Trip not found", "BUS_TRIP_NOT_FOUND", 404);
    const taken = await this.seatsTaken([trip.id]);
    const settings = await this.operatorService.getSettings();
    return {
      ...this._tripDto(trip, taken, {
        ticketTypes: trip.route.ticketTypes.map((t) => ({ id: t.id, name: t.name, description: t.description, price: money(t.price) })),
        holdMinutes: settings.holdMinutes,
        maxPerBooking: MAX_TICKETS_PER_BOOKING
      }),
      operator: { ...this._tripDto(trip, taken).operator, parkAddress: trip.operator.parkAddress, contactPhone: trip.operator.contactPhone, whatsapp: trip.operator.whatsapp }
    };
  }

  // ------------------------------------------------------------------ booking + payment
  async createBooking({ userId, tripId, items, passenger, payPhone }) {
    const wanted = (Array.isArray(items) ? items : []).filter((i) => Number(i.quantity) > 0);
    const seatCount = wanted.reduce((sum, i) => sum + Number(i.quantity), 0);
    if (!seatCount) throw bad("Choose at least one ticket", "BUS_NO_TICKETS");
    if (seatCount > MAX_TICKETS_PER_BOOKING) throw bad(`You can buy up to ${MAX_TICKETS_PER_BOOKING} tickets at a time`, "BUS_TOO_MANY_TICKETS");
    if (!payPhone) throw bad("Enter the mobile money number to pay from", "PHONE_REQUIRED");

    const settings = await this.operatorService.getSettings();

    const created = await prisma.$transaction(async (tx) => {
      const trip = await tx.busTrip.findFirst({
        where: { id: tripId, operator: ACTIVE_OPERATOR },
        include: { route: { include: { ticketTypes: true } }, operator: true }
      });
      if (!trip || !trip.route.isActive) throw bad("This trip isn't available any more", "BUS_TRIP_NOT_FOUND", 404);
      if (trip.status !== "scheduled") throw bad("This trip has been cancelled", "BUS_TRIP_CANCELLED", 409);
      if (trip.departureAt.getTime() - Date.now() <= BOARDING_CUTOFF_MS) throw bad("Ticket sales for this trip have closed", "BUS_SALES_CLOSED", 409);

      const typeById = new Map(trip.route.ticketTypes.filter((t) => t.isActive).map((t) => [t.id, t]));
      const lines = [];
      let subtotalCents = 0n;
      for (const item of wanted) {
        const type = typeById.get(item.ticketTypeId);
        if (!type) throw bad("One of the ticket types is no longer available", "BUS_TICKET_TYPE_INVALID");
        const quantity = Math.floor(Number(item.quantity));
        const unitCents = parseMoneyToCents(type.price);
        subtotalCents += unitCents * BigInt(quantity);
        lines.push({ ticketTypeId: type.id, name: type.name, quantity, unitPrice: money(type.price) });
      }

      // Seat check and hold happen in one transaction, so two people can't both take the last seat.
      const taken = (await this.seatsTaken([trip.id], tx)).get(trip.id) ?? 0;
      if (taken + seatCount > trip.seats) {
        const left = Math.max(0, trip.seats - taken);
        throw bad(left ? `Only ${left} seat${left === 1 ? "" : "s"} left on this trip` : "This trip is sold out", "BUS_NOT_ENOUGH_SEATS", 409);
      }

      const feeCents = feeFromPercentCents({ amountCents: subtotalCents, percent: trip.operator.commissionPercent });
      const reference = `bus-${crypto.randomUUID()}`;
      const transaction = await tx.transaction.create({
        data: {
          type: "bus_ticket",
          userId,
          providerId: null,
          amount: centsToDecimal(subtotalCents),
          fee: centsToDecimal(feeCents),
          netAmount: centsToDecimal(subtotalCents - feeCents),
          status: "pending",
          reference,
          metadata: { tripId: trip.id, operatorId: trip.operatorId, seatCount, phone: payPhone }
        }
      });
      const booking = await tx.busBooking.create({
        data: {
          reference: makeBookingReference(),
          userId,
          tripId: trip.id,
          operatorId: trip.operatorId,
          transactionId: transaction.id,
          seatCount,
          passengerName: passenger.name.trim(),
          passengerPhone: passenger.phone.trim(),
          passengerEmail: passenger.email?.trim().toLowerCase() || null,
          payPhone,
          subtotal: centsToDecimal(subtotalCents),
          fee: centsToDecimal(feeCents),
          total: centsToDecimal(subtotalCents),
          lines,
          expiresAt: new Date(Date.now() + settings.holdMinutes * 60 * 1000)
        }
      });
      await tx.transaction.update({ where: { id: transaction.id }, data: { metadata: { ...transaction.metadata, bookingId: booking.id } } });
      return { booking, reference, amount: centsToDecimal(subtotalCents) };
    });

    try {
      await this.mobileMoneyService.initiateDeposit({ amount: created.amount, phone: payPhone, reference: created.reference, ...this.callbackUrls() });
    } catch (gatewayError) {
      // The prompt never went out, so release the seats straight away.
      await prisma.$transaction([
        prisma.transaction.update({ where: { id: created.booking.transactionId }, data: { status: "failed" } }),
        prisma.busBooking.update({ where: { id: created.booking.id }, data: { status: "failed" } })
      ]);
      throw gatewayError;
    }

    return { bookingId: created.booking.id, reference: created.booking.reference, status: "pending_payment", expiresAt: created.booking.expiresAt, total: money(created.booking.total), message: "Check your phone to approve the mobile money payment." };
  }

  // Called by PaymentService inside its own database transaction when the gateway reports success.
  async confirmPayment({ tx, transaction, walletService }) {
    const booking = await tx.busBooking.findUnique({ where: { id: String(transaction.metadata?.bookingId ?? "") }, include: { trip: true } });
    if (!booking || booking.status === "confirmed") return null;

    const existing = await tx.busTicket.aggregate({ where: { tripId: booking.tripId, status: { not: "cancelled" } }, _count: true, _max: { seatNumber: true } });
    const full = existing._count + booking.seatCount > booking.trip.seats;
    if (full || booking.trip.status !== "scheduled") {
      // Money arrived but the seats are gone (hold lapsed + sold elsewhere, or the trip was cancelled
      // in the meantime). Flag it for a refund instead of issuing tickets that can't be honoured.
      await tx.busBooking.update({ where: { id: booking.id }, data: { status: "refund_due" } });
      return { bookingId: booking.id, refundDue: true };
    }

    let seat = existing._max.seatNumber ?? 0;
    const tickets = [];
    for (const line of Array.isArray(booking.lines) ? booking.lines : []) {
      for (let i = 0; i < line.quantity; i += 1) {
        seat += 1;
        tickets.push({
          bookingId: booking.id,
          tripId: booking.tripId,
          operatorId: booking.operatorId,
          ticketTypeId: line.ticketTypeId,
          ticketTypeName: line.name,
          ticketNumber: makeTicketNumber(),
          seatNumber: seat,
          price: line.unitPrice,
          passengerName: booking.passengerName
        });
      }
    }
    for (const data of tickets) await tx.busTicket.create({ data });

    await tx.busBooking.update({ where: { id: booking.id }, data: { status: "confirmed", confirmedAt: new Date() } });
    await tx.busOperator.update({ where: { id: booking.operatorId }, data: { walletBalance: { increment: transaction.netAmount } } });
    if (Number(transaction.fee) > 0) await walletService.creditBalance({ providerId: null, amountDec: transaction.fee, session: tx });
    return { bookingId: booking.id, confirmed: true };
  }

  async failPayment(transaction) {
    const bookingId = transaction.metadata?.bookingId;
    if (!bookingId) return;
    await prisma.busBooking.updateMany({ where: { id: bookingId, status: "pending_payment" }, data: { status: "failed" } });
  }

  async sendTicketEmail(bookingId) {
    const booking = await prisma.busBooking.findUnique({
      where: { id: bookingId },
      include: { tickets: { orderBy: { seatNumber: "asc" } }, trip: { include: { route: true } }, operator: true, user: true }
    });
    if (!booking || booking.status !== "confirmed") return { sent: false };
    const to = booking.passengerEmail || booking.user?.email;
    return this.emailService.sendTicketEmail({ to, booking, trip: booking.trip, route: booking.trip.route, operator: booking.operator, tickets: booking.tickets });
  }

  // ------------------------------------------------------------------ the customer's side
  _ticketDto(t) {
    return { id: t.id, ticketNumber: t.ticketNumber, ticketTypeName: t.ticketTypeName, seatNumber: t.seatNumber, price: money(t.price), passengerName: t.passengerName, status: t.status, checkedInAt: t.checkedInAt, qrUrl: qrUrl(t.ticketNumber) };
  }

  _bookingDto(b) {
    return {
      id: b.id,
      reference: b.reference,
      status: b.status,
      seatCount: b.seatCount,
      total: money(b.total),
      passengerName: b.passengerName,
      passengerPhone: b.passengerPhone,
      passengerEmail: b.passengerEmail,
      lines: b.lines,
      expiresAt: b.expiresAt,
      expired: b.status === "pending_payment" && b.expiresAt.getTime() < Date.now(),
      confirmedAt: b.confirmedAt,
      createdAt: b.createdAt,
      trip: b.trip && {
        id: b.trip.id,
        departureAt: b.trip.departureAt,
        delayMinutes: b.trip.delayMinutes,
        status: b.trip.status,
        route: b.trip.route && { name: b.trip.route.name, originName: b.trip.route.originName, destinationName: b.trip.route.destinationName, boardingPoint: b.trip.route.boardingPoint, dropoffPoint: b.trip.route.dropoffPoint, stops: b.trip.route.stops, durationMinutes: b.trip.route.durationMinutes },
        busType: b.trip.busType && { name: b.trip.busType.name, imageUrl: b.trip.busType.imageUrl, amenities: b.trip.busType.amenities }
      },
      operator: b.operator && { companyName: b.operator.companyName, slug: b.operator.slug, logoUrl: b.operator.logoUrl, coverUrl: b.operator.coverUrl, parkName: b.operator.parkName, contactPhone: b.operator.contactPhone, whatsapp: b.operator.whatsapp },
      tickets: (b.tickets ?? []).map((t) => this._ticketDto(t))
    };
  }

  get _bookingInclude() {
    return { tickets: { orderBy: { seatNumber: "asc" } }, trip: { include: { route: true, busType: true } }, operator: true };
  }

  async getBooking({ userId, bookingId }) {
    const booking = await prisma.busBooking.findFirst({ where: { id: bookingId, userId }, include: this._bookingInclude });
    if (!booking) throw bad("Booking not found", "BUS_BOOKING_NOT_FOUND", 404);
    return this._bookingDto(booking);
  }

  async myTickets({ userId }) {
    const bookings = await prisma.busBooking.findMany({
      where: { userId, status: { in: ["confirmed", "refund_due", "cancelled"] } },
      include: this._bookingInclude,
      orderBy: { createdAt: "desc" },
      take: 100
    });
    const now = Date.now();
    const dto = bookings.map((b) => this._bookingDto(b));
    return {
      upcoming: dto.filter((b) => new Date(b.trip.departureAt).getTime() > now - 6 * 3600 * 1000).sort((a, b) => new Date(a.trip.departureAt) - new Date(b.trip.departureAt)),
      past: dto.filter((b) => new Date(b.trip.departureAt).getTime() <= now - 6 * 3600 * 1000)
    };
  }

  async getTicket({ userId, ticketNumber }) {
    const ticket = await prisma.busTicket.findFirst({ where: { ticketNumber, booking: { userId } }, include: { booking: { include: this._bookingInclude } } });
    if (!ticket) throw bad("Ticket not found", "BUS_TICKET_NOT_FOUND", 404);
    return { ticket: this._ticketDto(ticket), booking: this._bookingDto(ticket.booking) };
  }

  // Messages from the companies the customer has travelled with (delays, cancellations, offers).
  async myMessages({ userId }) {
    const bookings = await prisma.busBooking.findMany({ where: { userId, status: "confirmed" }, select: { operatorId: true, tripId: true } });
    if (!bookings.length) return { items: [] };
    const rows = await prisma.busAnnouncement.findMany({
      where: { OR: [{ operatorId: { in: [...new Set(bookings.map((b) => b.operatorId))] }, tripId: null }, { tripId: { in: bookings.map((b) => b.tripId) } }] },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { operator: { select: { companyName: true, logoUrl: true } } }
    });
    return { items: rows.map((a) => ({ id: a.id, title: a.title, message: a.message, kind: a.kind, createdAt: a.createdAt, companyName: a.operator.companyName, logoUrl: a.operator.logoUrl })) };
  }

  async ticketQr(ticketNumber) {
    const exists = await prisma.busTicket.findUnique({ where: { ticketNumber }, select: { id: true } });
    if (!exists) throw bad("Ticket not found", "BUS_TICKET_NOT_FOUND", 404);
    return QRCode.toBuffer(ticketNumber, { width: 320, margin: 1, color: { dark: "#0b2046", light: "#ffffff" } });
  }
}
