import { AppError } from "../utils/AppError.js";
import { prisma } from "../config/db.js";
import { addDaysToDateString, eatDateString, eatDayBounds, isDateString, todayEat } from "../utils/busTime.js";
import { parseMoneyToCents, centsToDecimal } from "../utils/money.js";

const bad = (message, code, statusCode = 400) => new AppError({ message, statusCode, code });
const money = (v) => (v === null || v === undefined ? "0" : v.toString());
const MIN_PAYOUT_UGX = 10000;

// Everything a bus company does day to day once its trips are on sale: run trips, watch sales,
// check passengers in, talk to its customers and get paid.
export class BusOperationsService {
  constructor({ emailService, catalogService, bookingService }) {
    this.emailService = emailService;
    this.catalogService = catalogService;
    this.bookingService = bookingService;
  }

  // ------------------------------------------------------------------ trips
  async listTrips({ operatorId, from, to, status }) {
    const start = isDateString(from) ? from : todayEat();
    const end = isDateString(to) ? to : addDaysToDateString(start, 13);
    await this.catalogService.ensureTripsForOperator(operatorId, start, end);

    const trips = await prisma.busTrip.findMany({
      where: { operatorId, departureAt: { gte: eatDayBounds(start).start, lt: eatDayBounds(end).end }, ...(status ? { status } : {}) },
      include: { route: { select: { name: true, originName: true, destinationName: true } }, busType: { select: { name: true } } },
      orderBy: { departureAt: "asc" },
      take: 500
    });
    const taken = await this.bookingService.seatsTaken(trips.map((t) => t.id));
    const sales = await prisma.busTicket.groupBy({ by: ["tripId"], where: { tripId: { in: trips.map((t) => t.id) }, status: { not: "cancelled" } }, _sum: { price: true }, _count: true });
    const salesByTrip = new Map(sales.map((s) => [s.tripId, s]));
    return {
      from: start,
      to: end,
      items: trips.map((t) => ({
        id: t.id,
        departureAt: t.departureAt,
        status: t.status,
        delayMinutes: t.delayMinutes,
        note: t.note,
        seats: t.seats,
        seatsTaken: taken.get(t.id) ?? 0,
        ticketsSold: salesByTrip.get(t.id)?._count ?? 0,
        revenue: money(salesByTrip.get(t.id)?._sum.price),
        route: t.route,
        busType: t.busType?.name ?? null,
        fromSchedule: Boolean(t.scheduleId)
      }))
    };
  }

  async _requireTrip(operatorId, tripId) {
    const trip = await prisma.busTrip.findFirst({ where: { id: tripId, operatorId }, include: { route: true, operator: true } });
    if (!trip) throw bad("Trip not found", "BUS_TRIP_NOT_FOUND", 404);
    return trip;
  }

  async getTrip({ operatorId, tripId }) {
    const trip = await this._requireTrip(operatorId, tripId);
    const tickets = await prisma.busTicket.findMany({
      where: { tripId },
      orderBy: { seatNumber: "asc" },
      include: { booking: { select: { reference: true, passengerPhone: true, status: true } } }
    });
    const taken = (await this.bookingService.seatsTaken([tripId])).get(tripId) ?? 0;
    return {
      id: trip.id,
      departureAt: trip.departureAt,
      status: trip.status,
      delayMinutes: trip.delayMinutes,
      note: trip.note,
      seats: trip.seats,
      seatsTaken: taken,
      route: { name: trip.route.name, originName: trip.route.originName, destinationName: trip.route.destinationName, boardingPoint: trip.route.boardingPoint },
      passengers: tickets.map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        seatNumber: t.seatNumber,
        ticketTypeName: t.ticketTypeName,
        passengerName: t.passengerName,
        phone: t.booking.passengerPhone,
        reference: t.booking.reference,
        status: t.status,
        checkedInAt: t.checkedInAt
      }))
    };
  }

  // People who must be told about something that happens to a trip.
  async _tripAudience(tripId) {
    const bookings = await prisma.busBooking.findMany({ where: { tripId, status: "confirmed" }, include: { user: { select: { email: true } } } });
    const byEmail = new Map();
    for (const b of bookings) {
      const email = b.passengerEmail || b.user?.email;
      if (email && !byEmail.has(email.toLowerCase())) byEmail.set(email.toLowerCase(), email);
    }
    return [...byEmail.values()];
  }

  async _notify({ operator, trip, route, title, message, kind, emails }) {
    // Fire the emails without blocking the request: a slow mail provider must not stall the operator.
    Promise.allSettled(emails.map((to) => this.emailService.sendAnnouncement({ to, operator, title, message, kind, trip, route }))).catch(() => {});
    return prisma.busAnnouncement.create({ data: { operatorId: operator.id, tripId: trip?.id ?? null, title, message, kind, recipients: emails.length } });
  }

  async cancelTrip({ operatorId, tripId, reason }) {
    const trip = await this._requireTrip(operatorId, tripId);
    if (trip.status === "cancelled") throw bad("This trip is already cancelled", "BUS_TRIP_CANCELLED", 409);
    if (trip.status === "departed" || trip.status === "completed") throw bad("This trip has already left", "BUS_TRIP_DEPARTED", 409);

    const emails = await this._tripAudience(tripId);
    await prisma.$transaction(async (tx) => {
      const confirmed = await tx.busBooking.findMany({ where: { tripId, status: "confirmed" }, include: { transaction: true } });
      for (const b of confirmed) {
        await tx.busBooking.update({ where: { id: b.id }, data: { status: "refund_due" } });
        await tx.busTicket.updateMany({ where: { bookingId: b.id }, data: { status: "cancelled" } });
        // The takings from a cancelled trip are no longer the company's to withdraw.
        if (b.transaction) await tx.busOperator.update({ where: { id: operatorId }, data: { walletBalance: { decrement: b.transaction.netAmount } } });
      }
      await tx.busBooking.updateMany({ where: { tripId, status: "pending_payment" }, data: { status: "expired" } });
      await tx.busTrip.update({ where: { id: tripId }, data: { status: "cancelled", note: reason ?? "" } });
    });

    if (emails.length) {
      await this._notify({
        operator: trip.operator,
        trip,
        route: trip.route,
        kind: "cancellation",
        title: "Your trip has been cancelled",
        message: `We're sorry - this trip has been cancelled${reason ? `: ${reason}` : "."}\nYour money will be refunded to the mobile money number you paid from. Contact ${trip.operator.companyName}${trip.operator.contactPhone ? ` on ${trip.operator.contactPhone}` : ""} if you need help.`,
        emails
      });
    }
    return { ok: true, notified: emails.length };
  }

  async delayTrip({ operatorId, tripId, delayMinutes, note }) {
    const trip = await this._requireTrip(operatorId, tripId);
    if (trip.status !== "scheduled") throw bad("Only upcoming trips can be delayed", "BUS_TRIP_NOT_SCHEDULED", 409);
    const minutes = Math.max(0, Math.min(720, Math.floor(Number(delayMinutes) || 0)));
    await prisma.busTrip.update({ where: { id: tripId }, data: { delayMinutes: minutes, note: note ?? "" } });

    const emails = minutes ? await this._tripAudience(tripId) : [];
    if (emails.length) {
      const hrs = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const human = `${hrs ? `${hrs} hour${hrs > 1 ? "s" : ""}` : ""}${hrs && mins ? " " : ""}${mins ? `${mins} minutes` : ""}`;
      await this._notify({
        operator: trip.operator,
        trip,
        route: trip.route,
        kind: "delay",
        title: `Your bus is delayed by ${human}`,
        message: `Your trip will now leave about ${human} later than planned.${note ? `\n${note}` : ""}\nYour ticket stays valid - please keep it handy.`,
        emails
      });
    }
    return { ok: true, notified: emails.length };
  }

  async markTrip({ operatorId, tripId, status }) {
    if (!["departed", "completed"].includes(status)) throw bad("Invalid status", "BUS_TRIP_STATUS_INVALID");
    const trip = await this._requireTrip(operatorId, tripId);
    if (trip.status === "cancelled") throw bad("This trip was cancelled", "BUS_TRIP_CANCELLED", 409);
    await prisma.busTrip.update({ where: { id: tripId }, data: { status } });
    return { ok: true };
  }

  // ------------------------------------------------------------------ bookings + tickets
  async listBookings({ operatorId, status, q, page = 1, limit = 30 }) {
    const where = {
      operatorId,
      status: status || { in: ["confirmed", "refund_due", "cancelled"] },
      ...(q ? { OR: [{ reference: { contains: q.toUpperCase() } }, { passengerName: { contains: q } }, { passengerPhone: { contains: q } }, { tickets: { some: { ticketNumber: { contains: q.toUpperCase() } } } }] } : {})
    };
    const [total, rows] = await Promise.all([
      prisma.busBooking.count({ where }),
      prisma.busBooking.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { trip: { include: { route: { select: { name: true, originName: true, destinationName: true } } } }, tickets: { select: { ticketNumber: true, status: true, ticketTypeName: true } } }
      })
    ]);
    return {
      total,
      page,
      items: rows.map((b) => ({
        id: b.id,
        reference: b.reference,
        status: b.status,
        passengerName: b.passengerName,
        passengerPhone: b.passengerPhone,
        seatCount: b.seatCount,
        total: money(b.total),
        fee: money(b.fee),
        createdAt: b.createdAt,
        departureAt: b.trip.departureAt,
        route: b.trip.route,
        tickets: b.tickets
      }))
    };
  }

  async verifyTicket({ operatorId, ticketNumber, checkIn = false }) {
    const code = String(ticketNumber ?? "").trim().toUpperCase();
    const ticket = await prisma.busTicket.findUnique({ where: { ticketNumber: code }, include: { trip: { include: { route: true } }, booking: true } });
    if (!ticket || ticket.operatorId !== operatorId) return { valid: false, reason: "not_found", message: "No ticket with this number for your company." };

    const base = {
      ticketNumber: ticket.ticketNumber,
      passengerName: ticket.passengerName,
      seatNumber: ticket.seatNumber,
      ticketTypeName: ticket.ticketTypeName,
      route: ticket.trip.route.name,
      departureAt: ticket.trip.departureAt,
      checkedInAt: ticket.checkedInAt
    };
    if (ticket.status === "cancelled" || ticket.trip.status === "cancelled") return { valid: false, reason: "cancelled", message: "This ticket was cancelled.", ...base };
    if (ticket.status === "used") return { valid: false, reason: "used", message: "This ticket has already been used.", ...base };
    if (ticket.booking.status !== "confirmed") return { valid: false, reason: "unpaid", message: "This ticket isn't paid for.", ...base };
    // Tickets are only good around their own trip: from the day before until a day after.
    const gap = Math.abs(Date.now() - ticket.trip.departureAt.getTime());
    if (gap > 36 * 3600 * 1000) return { valid: false, reason: "wrong_day", message: "This ticket is for a different day.", ...base };

    if (checkIn) {
      const result = await prisma.busTicket.updateMany({ where: { id: ticket.id, status: "valid" }, data: { status: "used", checkedInAt: new Date() } });
      if (!result.count) return { valid: false, reason: "used", message: "This ticket has already been used.", ...base };
      return { valid: true, checkedIn: true, message: "Checked in. Welcome aboard!", ...base, checkedInAt: new Date() };
    }
    return { valid: true, checkedIn: false, message: "Valid ticket.", ...base };
  }

  // ------------------------------------------------------------------ customers
  async listCustomers({ operatorId, q }) {
    const bookings = await prisma.busBooking.findMany({
      where: { operatorId, status: "confirmed" },
      include: { trip: { select: { departureAt: true } }, user: { select: { id: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 5000
    });
    const people = new Map();
    for (const b of bookings) {
      const key = b.userId;
      const person = people.get(key) ?? { userId: key, name: b.passengerName, phone: b.passengerPhone, email: b.passengerEmail || b.user?.email || null, bookings: 0, tickets: 0, spent: 0n, lastTravelAt: null, firstBookedAt: b.createdAt };
      person.bookings += 1;
      person.tickets += b.seatCount;
      person.spent += parseMoneyToCents(b.total);
      if (!person.lastTravelAt || b.trip.departureAt > person.lastTravelAt) person.lastTravelAt = b.trip.departureAt;
      if (b.createdAt < person.firstBookedAt) person.firstBookedAt = b.createdAt;
      people.set(key, person);
    }
    let items = [...people.values()].map((p) => ({ ...p, spent: money(centsToDecimal(p.spent)), loyal: p.bookings >= 3 }));
    if (q) {
      const needle = q.toLowerCase();
      items = items.filter((p) => [p.name, p.phone, p.email].some((v) => String(v ?? "").toLowerCase().includes(needle)));
    }
    items.sort((a, b) => new Date(b.lastTravelAt) - new Date(a.lastTravelAt));
    return { total: items.length, items };
  }

  // ------------------------------------------------------------------ announcements
  async listAnnouncements(operatorId) {
    const rows = await prisma.busAnnouncement.findMany({ where: { operatorId }, orderBy: { createdAt: "desc" }, take: 50 });
    return { items: rows };
  }

  // audience: "all" (everyone who has travelled with the company), "upcoming" (people with a trip
  // still to take) or a tripId.
  async sendAnnouncement({ operatorId, title, message, kind = "notice", audience = "all", tripId }) {
    const operator = await prisma.busOperator.findUnique({ where: { id: operatorId } });
    let trip = null;
    let bookings;
    if (tripId) {
      trip = await this._requireTrip(operatorId, tripId);
      bookings = await prisma.busBooking.findMany({ where: { tripId, status: "confirmed" }, include: { user: { select: { email: true } } } });
    } else {
      bookings = await prisma.busBooking.findMany({
        where: { operatorId, status: "confirmed", ...(audience === "upcoming" ? { trip: { departureAt: { gt: new Date() }, status: "scheduled" } } : {}) },
        include: { user: { select: { email: true } } }
      });
    }
    const emails = [...new Set(bookings.map((b) => (b.passengerEmail || b.user?.email || "").toLowerCase()).filter(Boolean))];
    if (!emails.length) throw bad("There is nobody to send this to yet", "BUS_NO_RECIPIENTS");
    const row = await this._notify({ operator, trip, route: trip?.route, title, message, kind, emails });
    return { announcement: row, recipients: emails.length };
  }

  // ------------------------------------------------------------------ dashboard
  async stats(operatorId) {
    const today = todayEat();
    const { start: todayStart, end: todayEnd } = eatDayBounds(today);
    const monthStart = eatDayBounds(`${today.slice(0, 8)}01`).start;
    const [operator, todayAgg, monthAgg, allAgg, upcomingTrips, todaysTrips, pendingRefunds, topRoutes] = await Promise.all([
      prisma.busOperator.findUnique({ where: { id: operatorId } }),
      prisma.busBooking.aggregate({ where: { operatorId, status: "confirmed", confirmedAt: { gte: todayStart, lt: todayEnd } }, _sum: { total: true, seatCount: true }, _count: true }),
      prisma.busBooking.aggregate({ where: { operatorId, status: "confirmed", confirmedAt: { gte: monthStart } }, _sum: { total: true, seatCount: true }, _count: true }),
      prisma.busBooking.aggregate({ where: { operatorId, status: "confirmed" }, _sum: { total: true, seatCount: true }, _count: true }),
      prisma.busTrip.count({ where: { operatorId, status: "scheduled", departureAt: { gt: new Date() } } }),
      prisma.busTrip.count({ where: { operatorId, status: "scheduled", departureAt: { gte: todayStart, lt: todayEnd } } }),
      prisma.busBooking.count({ where: { operatorId, status: "refund_due" } }),
      prisma.busTicket.groupBy({ by: ["tripId"], where: { operatorId, status: { not: "cancelled" } }, _count: true })
    ]);

    // Revenue per route for the best performers.
    const tripRoutes = await prisma.busTrip.findMany({ where: { id: { in: topRoutes.map((t) => t.tripId) } }, select: { id: true, route: { select: { name: true } } } });
    const routeName = new Map(tripRoutes.map((t) => [t.id, t.route.name]));
    const perRoute = new Map();
    for (const row of topRoutes) {
      const name = routeName.get(row.tripId);
      if (name) perRoute.set(name, (perRoute.get(name) ?? 0) + row._count);
    }

    // Seven-day sales trend.
    const since = eatDayBounds(addDaysToDateString(today, -6)).start;
    const recent = await prisma.busBooking.findMany({ where: { operatorId, status: "confirmed", confirmedAt: { gte: since } }, select: { confirmedAt: true, total: true, seatCount: true } });
    const trend = Array.from({ length: 7 }, (_, i) => ({ date: addDaysToDateString(today, i - 6), revenue: 0, tickets: 0 }));
    for (const b of recent) {
      const slot = trend.find((d) => d.date === eatDateString(b.confirmedAt));
      if (slot) {
        slot.revenue += Number(b.total);
        slot.tickets += b.seatCount;
      }
    }

    const pendingPayouts = await prisma.busPayout.aggregate({ where: { operatorId, status: "requested" }, _sum: { amount: true } });
    return {
      today: { revenue: money(todayAgg._sum.total), tickets: todayAgg._sum.seatCount ?? 0, bookings: todayAgg._count, trips: todaysTrips },
      month: { revenue: money(monthAgg._sum.total), tickets: monthAgg._sum.seatCount ?? 0, bookings: monthAgg._count },
      allTime: { revenue: money(allAgg._sum.total), tickets: allAgg._sum.seatCount ?? 0, bookings: allAgg._count },
      upcomingTrips,
      pendingRefunds,
      walletBalance: money(operator.walletBalance),
      pendingPayouts: money(pendingPayouts._sum.amount),
      commissionPercent: money(operator.commissionPercent),
      topRoutes: [...perRoute.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, tickets]) => ({ name, tickets })),
      trend
    };
  }

  // ------------------------------------------------------------------ payouts
  async listPayouts(operatorId) {
    const rows = await prisma.busPayout.findMany({ where: { operatorId }, orderBy: { createdAt: "desc" }, take: 50 });
    return { items: rows.map((p) => ({ ...p, amount: money(p.amount) })) };
  }

  async requestPayout({ operatorId, amount, phone }) {
    const cents = parseMoneyToCents(amount);
    if (cents < BigInt(MIN_PAYOUT_UGX) * 100n) throw bad(`The smallest payout is UGX ${MIN_PAYOUT_UGX.toLocaleString("en-US")}`, "BUS_PAYOUT_TOO_SMALL");
    return prisma.$transaction(async (tx) => {
      // The balance is taken off straight away, so two requests can't spend the same money.
      const result = await tx.busOperator.updateMany({ where: { id: operatorId, walletBalance: { gte: centsToDecimal(cents) } }, data: { walletBalance: { decrement: centsToDecimal(cents) } } });
      if (!result.count) throw bad("That is more than your available balance", "BUS_INSUFFICIENT_FUNDS", 409);
      const payout = await tx.busPayout.create({ data: { operatorId, amount: centsToDecimal(cents), phone } });
      return { ...payout, amount: money(payout.amount) };
    });
  }

  // ------------------------------------------------------------------ admin side
  async adminListPayouts({ status } = {}) {
    const rows = await prisma.busPayout.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" }, take: 200, include: { operator: { select: { id: true, companyName: true, contactPhone: true, logoUrl: true } } } });
    return { items: rows.map((p) => ({ ...p, amount: money(p.amount) })) };
  }

  async adminProcessPayout({ payoutId, status, note }) {
    if (!["paid", "rejected"].includes(status)) throw bad("Choose paid or rejected", "BUS_PAYOUT_STATUS_INVALID");
    return prisma.$transaction(async (tx) => {
      const payout = await tx.busPayout.findUnique({ where: { id: payoutId } });
      if (!payout) throw bad("Payout not found", "BUS_PAYOUT_NOT_FOUND", 404);
      if (payout.status !== "requested") throw bad("This payout was already processed", "BUS_PAYOUT_DONE", 409);
      if (status === "rejected") await tx.busOperator.update({ where: { id: payout.operatorId }, data: { walletBalance: { increment: payout.amount } } });
      const updated = await tx.busPayout.update({ where: { id: payoutId }, data: { status, note: note ?? "", processedAt: new Date() } });
      return { ...updated, amount: money(updated.amount) };
    });
  }

  async adminListBookings({ status, q, page = 1, limit = 40 } = {}) {
    const where = {
      ...(status ? { status } : {}),
      ...(q ? { OR: [{ reference: { contains: q.toUpperCase() } }, { passengerName: { contains: q } }, { passengerPhone: { contains: q } }] } : {})
    };
    const [total, rows] = await Promise.all([
      prisma.busBooking.count({ where }),
      prisma.busBooking.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { operator: { select: { id: true, companyName: true, logoUrl: true } }, trip: { include: { route: { select: { name: true } } } } }
      })
    ]);
    return {
      total,
      items: rows.map((b) => ({ id: b.id, reference: b.reference, status: b.status, operatorId: b.operator.id, company: b.operator.companyName, companyLogoUrl: b.operator.logoUrl, route: b.trip.route.name, departureAt: b.trip.departureAt, passengerName: b.passengerName, passengerPhone: b.passengerPhone, payPhone: b.payPhone, seatCount: b.seatCount, total: money(b.total), fee: money(b.fee), createdAt: b.createdAt }))
    };
  }

  // The admin refunds the customer by mobile money outside the system, then marks it done here.
  async adminMarkRefunded(bookingId) {
    const booking = await prisma.busBooking.findUnique({ where: { id: bookingId } });
    if (!booking) throw bad("Booking not found", "BUS_BOOKING_NOT_FOUND", 404);
    if (booking.status !== "refund_due") throw bad("This booking isn't waiting for a refund", "BUS_NOT_REFUND_DUE", 409);
    await prisma.$transaction(async (tx) => {
      await tx.busBooking.update({ where: { id: bookingId }, data: { status: "cancelled" } });
      if (booking.transactionId) await tx.transaction.update({ where: { id: booking.transactionId }, data: { status: "refunded" } });
    });
    return { ok: true };
  }

  async adminOverview() {
    const [bookings, revenue, operators, tickets, refunds, payouts] = await Promise.all([
      prisma.busBooking.count({ where: { status: "confirmed" } }),
      prisma.busBooking.aggregate({ where: { status: "confirmed" }, _sum: { total: true, fee: true } }),
      prisma.busOperator.count({ where: { onboardingStatus: "registered" } }),
      prisma.busTicket.count({ where: { status: { not: "cancelled" } } }),
      prisma.busBooking.count({ where: { status: "refund_due" } }),
      prisma.busPayout.count({ where: { status: "requested" } })
    ]);
    return { bookings, tickets, operators, grossSales: money(revenue._sum.total), commissionEarned: money(revenue._sum.fee), refundsDue: refunds, payoutsPending: payouts };
  }
}
