import crypto from "node:crypto";

import { prisma } from "../config/db.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { flagRefundDue } from "../utils/refunds.js";
import { sendMail } from "../emails/mailer.js";
import { bookingEmail } from "../emails/templates.js";
import { addDaysToDateString, eatDateString, eatTimeString, eatToUtc, isDateString, isTimeString, todayEat } from "../utils/busTime.js";

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const makeReference = () => {
  const bytes = crypto.randomBytes(7);
  return `BK${Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("")}`;
};

export const BOOKING_MODES = ["none", "request", "instant"];
export const POLICIES = {
  flexible: "Free cancellation up to 24 hours before the start.",
  moderate: "Free cancellation up to 5 days before the start; after that the provider may keep the deposit.",
  strict: "Deposits are non-refundable once the booking is confirmed."
};
const HOLDING = ["pending", "confirmed"];
const HOUR_MS = 3600 * 1000;

const err = (message, code, statusCode = 400, details) => new AppError({ message, statusCode, code, details });
const int = (v, fallback, min, max) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

// What a provider sets when they mark a service as a booking service. Anything missing or out of range falls
// back to a sensible value so a half-filled form can never produce an unbookable listing.
export const normalizeBookingConfig = (input = {}) => {
  const unit = ["night", "day", "hour"].includes(input.unit) ? input.unit : "night";
  const maxDefault = unit === "night" ? 30 : unit === "day" ? 14 : 12;
  const time = (v, fallback) => (isTimeString(v) ? v : fallback);
  const blocked = (Array.isArray(input.blockedDates) ? input.blockedDates : []).filter(isDateString);
  return {
    unit,
    inventory: int(input.inventory, 1, 1, 500),
    capacity: int(input.capacity, 2, 1, 5000),
    minUnits: int(input.minUnits, 1, 1, maxDefault),
    maxUnits: int(input.maxUnits, maxDefault, 1, 365),
    leadTimeHours: int(input.leadTimeHours, 0, 0, 24 * 30),
    advanceDays: int(input.advanceDays, 365, 1, 730),
    responseHours: int(input.responseHours, 24, 2, 72),
    checkIn: time(input.checkIn, "14:00"),
    checkOut: time(input.checkOut, "11:00"),
    openFrom: time(input.openFrom, "08:00"),
    openTo: time(input.openTo, "22:00"),
    cancellation: Object.keys(POLICIES).includes(input.cancellation) ? input.cancellation : "flexible",
    // Share of the total the guest pays online once the provider has confirmed (0 = no online payment).
    depositPercent: [0, 20, 30, 50, 100].includes(Number(input.depositPercent)) ? Number(input.depositPercent) : 0,
    payWithinHours: int(input.payWithinHours, 24, 1, 72),
    depositNote: String(input.depositNote ?? "").trim().slice(0, 200),
    instructions: String(input.instructions ?? "").trim().slice(0, 600),
    blockedDates: [...new Set(blocked)].sort().slice(0, 500)
  };
};

export class ServiceBookingService {
  constructor({ emailService } = {}) {
    this.email = emailService ?? null;
  }

  // ----- availability -------------------------------------------------------------------------

  async _expireStale() {
    const now = new Date();
    await prisma.serviceBooking.updateMany({ where: { status: "pending", expiresAt: { lt: now } }, data: { status: "expired" } });
    // A confirmed booking that asked for payment but wasn't paid in time frees its dates.
    await prisma.serviceBooking.updateMany({ where: { status: "confirmed", paymentStatus: "payable", payBy: { lt: now } }, data: { status: "expired", paymentStatus: "none" } });
  }

  async _listing(listingId) {
    const listing = await prisma.serviceProduct.findFirst({
      where: { id: listingId, type: "service", status: "approved", provider: { isApproved: true, moderationStatus: "approved" } },
      include: { provider: { select: { id: true, userId: true, businessName: true, onlinePaymentsEnabled: true } } }
    });
    if (!listing || listing.bookingMode === "none") throw err("This service can't be booked online.", "NOT_BOOKABLE", 404);
    return { listing, config: normalizeBookingConfig(listing.booking) };
  }

  // Bookings that hold dates (confirmed, or a request still waiting for an answer) overlapping [startAt, endAt).
  _holding(db, listingId, startAt, endAt) {
    return db.serviceBooking.findMany({
      where: { listingId, status: { in: HOLDING }, startAt: { lt: endAt }, endAt: { gt: startAt }, OR: [{ status: "confirmed" }, { expiresAt: { gt: new Date() } }] },
      select: { startAt: true, endAt: true, quantity: true }
    });
  }

  // The time steps a booking occupies: whole days for nights/days, whole hours for slots.
  _steps(unit, startAt, endAt) {
    const steps = [];
    const stepMs = unit === "hour" ? HOUR_MS : 24 * HOUR_MS;
    for (let t = startAt.getTime(); t < endAt.getTime(); t += stepMs) steps.push(new Date(t));
    return steps;
  }

  _loadAt(bookings, stepStart, stepMs) {
    const end = stepStart.getTime() + stepMs;
    return bookings.reduce((sum, b) => (b.startAt.getTime() < end && b.endAt.getTime() > stepStart.getTime() ? sum + b.quantity : sum), 0);
  }

  // Turns what the guest picked into the exact interval, validating it against the listing's rules.
  _interval(config, input) {
    const now = new Date();
    const { unit } = config;
    let startAt;
    let endAt;
    let units;
    let startDate;
    let endDate;
    let startTime = null;
    let endTime = null;

    if (!isDateString(input.startDate)) throw err("Choose a start date.", "INVALID_DATES");
    startDate = input.startDate;

    if (unit === "hour") {
      if (!isTimeString(input.startTime) || input.startTime.slice(3) !== "00") throw err("Choose a start time on the hour.", "INVALID_TIME");
      units = int(input.hours, 0, 0, 24);
      if (units < 1) throw err("Choose how many hours.", "INVALID_DURATION");
      startAt = eatToUtc(startDate, input.startTime);
      endAt = new Date(startAt.getTime() + units * HOUR_MS);
      startTime = input.startTime;
      endTime = eatTimeString(endAt);
      endDate = eatDateString(endAt);
      const openFrom = eatToUtc(startDate, config.openFrom);
      const closes = eatToUtc(startDate, config.openTo);
      if (startAt < openFrom || endAt > closes) throw err(`Bookings are taken between ${config.openFrom} and ${config.openTo}.`, "OUTSIDE_HOURS");
    } else {
      if (!isDateString(input.endDate)) throw err("Choose an end date.", "INVALID_DATES");
      endDate = input.endDate;
      const span = Math.round((eatToUtc(endDate, "00:00") - eatToUtc(startDate, "00:00")) / (24 * HOUR_MS));
      if (unit === "night") {
        if (span < 1) throw err("Check-out must be after check-in.", "INVALID_DATES");
        units = span;
        endAt = eatToUtc(endDate, "00:00");
        startTime = config.checkIn;
        endTime = config.checkOut;
      } else {
        if (span < 0) throw err("The end date can't be before the start date.", "INVALID_DATES");
        units = span + 1;
        endAt = eatToUtc(addDaysToDateString(endDate, 1), "00:00");
      }
      startAt = eatToUtc(startDate, "00:00");
    }

    if (units < config.minUnits) throw err(`The minimum booking is ${config.minUnits} ${unit}${config.minUnits > 1 ? "s" : ""}.`, "BELOW_MINIMUM");
    if (units > config.maxUnits) throw err(`The maximum booking is ${config.maxUnits} ${unit}s.`, "ABOVE_MAXIMUM");
    if (unit !== "hour" ? startDate < todayEat() : startAt <= now) throw err("That date has already passed.", "PAST_DATE");
    if (startAt.getTime() - now.getTime() < config.leadTimeHours * HOUR_MS && unit === "hour") throw err(`Please book at least ${config.leadTimeHours} hours ahead.`, "TOO_SOON");
    if (unit !== "hour" && config.leadTimeHours >= 24 && eatToUtc(startDate, config.checkIn).getTime() - now.getTime() < config.leadTimeHours * HOUR_MS) throw err(`Please book at least ${Math.round(config.leadTimeHours / 24)} day(s) ahead.`, "TOO_SOON");
    if (startAt.getTime() - now.getTime() > config.advanceDays * 24 * HOUR_MS) throw err(`Bookings open up to ${config.advanceDays} days ahead.`, "TOO_FAR");

    return { startAt, endAt, units, startDate, endDate, startTime, endTime };
  }

  // Throws when any step of the interval is blocked or out of stock.
  _assertFree({ config, interval, held, quantity }) {
    const stepMs = config.unit === "hour" ? HOUR_MS : 24 * HOUR_MS;
    for (const step of this._steps(config.unit, interval.startAt, interval.endAt)) {
      if (config.unit !== "hour" && config.blockedDates.includes(eatDateString(step))) throw err("The provider isn't taking bookings on some of those dates.", "DATES_BLOCKED", 409);
      if (config.unit === "hour" && config.blockedDates.includes(eatDateString(step))) throw err("The provider isn't taking bookings on that date.", "DATES_BLOCKED", 409);
      if (this._loadAt(held, step, stepMs) + quantity > config.inventory) {
        throw err(config.inventory > 1 ? "There aren't enough available for those dates." : "That time is already taken. Please pick other dates.", "NOT_AVAILABLE", 409);
      }
    }
  }

  // Calendar feed for the booking panel: per day how many are left; for hourly services, per-hour slots on `date`.
  async availability({ listingId, from, to, date }) {
    await this._expireStale();
    const { listing, config } = await this._listing(listingId);
    const today = todayEat();
    const first = isDateString(from) ? from : today;
    let last = isDateString(to) ? to : addDaysToDateString(first, 42);
    if (last > addDaysToDateString(first, 92)) last = addDaysToDateString(first, 92);

    const held = await this._holding(prisma, listing.id, eatToUtc(first, "00:00"), eatToUtc(addDaysToDateString(last, 1), "00:00"));
    const days = {};
    for (let d = first; d <= last; d = addDaysToDateString(d, 1)) {
      const dayStart = eatToUtc(d, "00:00");
      const peak = config.unit === "hour"
        ? Math.max(0, ...Array.from({ length: 24 }, (_, h) => this._loadAt(held, new Date(dayStart.getTime() + h * HOUR_MS), HOUR_MS)))
        : this._loadAt(held, dayStart, 24 * HOUR_MS);
      const blocked = config.blockedDates.includes(d);
      const past = d < today || d > addDaysToDateString(today, config.advanceDays);
      days[d] = { free: blocked || past ? 0 : Math.max(0, config.inventory - (config.unit === "hour" ? 0 : peak)), blocked, past, ...(config.unit === "hour" ? { partlyBooked: peak > 0 } : {}) };
    }

    let slots = null;
    if (config.unit === "hour" && isDateString(date)) {
      const open = eatToUtc(date, config.openFrom);
      const close = eatToUtc(date, config.openTo);
      const dayHeld = await this._holding(prisma, listing.id, open, close);
      slots = [];
      for (let t = open.getTime(); t < close.getTime(); t += HOUR_MS) {
        const at = new Date(t);
        const free = config.blockedDates.includes(date) ? 0 : Math.max(0, config.inventory - this._loadAt(dayHeld, at, HOUR_MS));
        slots.push({ time: eatTimeString(at), free: at.getTime() > Date.now() + config.leadTimeHours * HOUR_MS ? free : 0 });
      }
    }
    return { listingId: listing.id, unit: config.unit, inventory: config.inventory, days, slots };
  }

  // ----- creating and answering bookings --------------------------------------------------------

  async create({ userId, input }) {
    await this._expireStale();
    const { listing, config } = await this._listing(input.listingId);
    if (listing.provider.userId === userId) throw err("You can't book your own service.", "OWN_LISTING", 403);

    const quantity = int(input.quantity, 1, 1, config.inventory);
    const guests = int(input.guests, 1, 1, 100000);
    if (guests > config.capacity * quantity) throw err(`This holds up to ${config.capacity * quantity} guests.`, "OVER_CAPACITY");
    const customer = {
      name: String(input.customer?.name ?? "").trim().slice(0, 120),
      phone: String(input.customer?.phone ?? "").trim().slice(0, 40),
      email: String(input.customer?.email ?? "").trim().slice(0, 200),
      notes: String(input.customer?.notes ?? "").trim().slice(0, 800)
    };
    if (customer.name.length < 2) throw err("Enter your name.", "INVALID_CUSTOMER");
    if (customer.phone.replace(/\D/g, "").length < 7) throw err("Enter a phone number the provider can reach you on.", "INVALID_CUSTOMER");

    const interval = this._interval(config, input);
    const instant = listing.bookingMode === "instant";
    const unitPrice = Number(listing.price);
    const total = unitPrice * interval.units * quantity;
    // Online payment is asked only after approval; instant bookings are approved on the spot, so it opens right away.
    const amountDue = config.depositPercent > 0 && listing.provider.onlinePaymentsEnabled !== false ? Math.round((total * config.depositPercent) / 100) : 0;
    const paymentStatus = amountDue > 0 ? (instant ? "payable" : "awaiting_approval") : "none";

    const booking = await prisma.$transaction(async (tx) => {
      const held = await this._holding(tx, listing.id, interval.startAt, interval.endAt);
      this._assertFree({ config, interval, held, quantity });
      return tx.serviceBooking.create({
        data: {
          reference: makeReference(),
          listingId: listing.id,
          providerId: listing.providerId,
          userId,
          status: instant ? "confirmed" : "pending",
          mode: instant ? "instant" : "request",
          unit: config.unit,
          startAt: interval.startAt,
          endAt: interval.endAt,
          startDate: interval.startDate,
          endDate: interval.endDate,
          startTime: interval.startTime,
          endTime: interval.endTime,
          quantity,
          guests,
          units: interval.units,
          unitPrice,
          total,
          customer,
          listingName: listing.name,
          policy: config.cancellation,
          expiresAt: instant ? null : new Date(Date.now() + config.responseHours * HOUR_MS),
          respondedAt: instant ? new Date() : null,
          amountDue,
          paymentStatus,
          payBy: paymentStatus === "payable" ? new Date(Date.now() + config.payWithinHours * HOUR_MS) : null
        }
      });
    });

    this._notify("created", booking.id).catch(() => {});
    return this.toDto(await this._load(booking.id), { viewer: "customer" });
  }

  _load(id) {
    return prisma.serviceBooking.findUnique({
      where: { id },
      include: {
        listing: { select: { id: true, name: true, media: true, price: true, booking: true } },
        provider: { select: { id: true, businessName: true, contact: true, location: true, district: true, user: { select: { email: true } } } },
        user: { select: { id: true, email: true } }
      }
    });
  }

  async listMine(userId) {
    await this._expireStale();
    const rows = await prisma.serviceBooking.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }],
      take: 100,
      include: {
        listing: { select: { id: true, name: true, media: true, price: true, booking: true } },
        provider: { select: { id: true, businessName: true, contact: true, location: true, district: true, user: { select: { email: true } } } },
        user: { select: { id: true, email: true } }
      }
    });
    return { items: rows.map((r) => this.toDto(r, { viewer: "customer" })) };
  }

  async listForProvider(userId, { status } = {}) {
    await this._expireStale();
    const provider = await this._provider(userId);
    const rows = await prisma.serviceBooking.findMany({
      where: { providerId: provider.id, ...(status ? { status } : {}) },
      orderBy: [{ startAt: "asc" }],
      take: 300,
      include: {
        listing: { select: { id: true, name: true, media: true, price: true, booking: true } },
        provider: { select: { id: true, businessName: true, contact: true, location: true, district: true, user: { select: { email: true } } } },
        user: { select: { id: true, email: true } }
      }
    });
    return { items: rows.map((r) => this.toDto(r, { viewer: "provider" })) };
  }

  async _provider(userId) {
    const provider = await prisma.provider.findUnique({ where: { userId } });
    if (!provider) throw err("Provider not found", "PROVIDER_NOT_FOUND", 404);
    return provider;
  }

  async respond({ userId, id, action, note }) {
    await this._expireStale();
    const provider = await this._provider(userId);
    const booking = await prisma.serviceBooking.findFirst({ where: { id, providerId: provider.id } });
    if (!booking) throw err("Booking not found", "BOOKING_NOT_FOUND", 404);
    const cleanNote = String(note ?? "").trim().slice(0, 500) || null;

    const transitions = {
      accept: { from: ["pending"], to: "confirmed" },
      decline: { from: ["pending"], to: "declined" },
      cancel: { from: ["confirmed"], to: "cancelled" },
      complete: { from: ["confirmed"], to: "completed" }
    };
    const rule = transitions[action];
    if (!rule) throw err("Unknown action", "INVALID_ACTION");
    if (!rule.from.includes(booking.status)) {
      throw err(booking.status === "expired" ? "This request has expired." : `This booking is already ${booking.status}.`, "INVALID_STATUS", 409);
    }
    if (action === "complete" && booking.startAt > new Date()) throw err("You can mark it complete once it has started.", "TOO_EARLY", 409);

    const extra = {};
    if (action === "accept" && booking.paymentStatus === "awaiting_approval") {
      const hours = normalizeBookingConfig((await prisma.serviceProduct.findUnique({ where: { id: booking.listingId }, select: { booking: true } }))?.booking).payWithinHours;
      extra.paymentStatus = "payable";
      extra.payBy = new Date(Date.now() + hours * HOUR_MS);
    }
    if ((action === "decline" || action === "cancel") && booking.paymentStatus !== "paid") extra.paymentStatus = "none";
    // Cancelling a booking the guest already paid for sends the payment to the refund queue.
    if (action === "cancel" && booking.paymentStatus === "paid") {
      extra.paymentStatus = "refund_pending";
      if (booking.transactionId) await flagRefundDue({ transactionId: booking.transactionId, reason: "booking_cancelled_by_provider", needsReversal: true });
    }
    await prisma.serviceBooking.update({
      where: { id },
      data: { status: rule.to, providerNote: cleanNote, respondedAt: new Date(), ...extra, ...(action === "cancel" ? { cancelledBy: "provider" } : {}) }
    });
    if (action !== "complete") this._notify(action === "accept" ? "confirmed" : action === "decline" ? "declined" : "cancelled_by_provider", id).catch(() => {});
    return this.toDto(await this._load(id), { viewer: "provider" });
  }

  async cancelMine({ userId, id }) {
    await this._expireStale();
    const booking = await prisma.serviceBooking.findFirst({ where: { id, userId } });
    if (!booking) throw err("Booking not found", "BOOKING_NOT_FOUND", 404);
    if (!HOLDING.includes(booking.status)) throw err(`This booking is already ${booking.status}.`, "INVALID_STATUS", 409);
    await prisma.serviceBooking.update({ where: { id }, data: { status: "cancelled", cancelledBy: "customer", respondedAt: new Date(), paymentStatus: booking.paymentStatus === "paid" ? "refund_pending" : "none" } });
    // The guest cancelled after paying: whether and how much to return follows the cancellation policy, so it's queued for a person to decide.
    if (booking.paymentStatus === "paid" && booking.transactionId) await flagRefundDue({ transactionId: booking.transactionId, reason: "booking_cancelled_by_guest", needsReversal: true });
    this._notify("cancelled_by_customer", id).catch(() => {});
    return this.toDto(await this._load(id), { viewer: "customer" });
  }

  // ----- output ---------------------------------------------------------------------------------

  toDto(b, { viewer }) {
    const confirmed = ["confirmed", "completed"].includes(b.status);
    const base = {
      id: b.id,
      reference: b.reference,
      status: b.status,
      mode: b.mode,
      unit: b.unit,
      listing: { id: b.listing?.id ?? b.listingId, name: b.listingName || b.listing?.name, imageUrl: b.listing?.media?.imageUrl ?? null },
      provider: { id: b.provider?.id ?? b.providerId, businessName: b.provider?.businessName ?? "" },
      startDate: b.startDate,
      endDate: b.endDate,
      startTime: b.startTime,
      endTime: b.endTime,
      units: b.units,
      quantity: b.quantity,
      guests: b.guests,
      unitPrice: Number(b.unitPrice),
      total: Number(b.total),
      policy: b.policy,
      policyText: POLICIES[b.policy] ?? POLICIES.flexible,
      depositNote: b.listing?.booking?.depositNote || "",
      instructions: confirmed ? b.listing?.booking?.instructions || "" : "",
      providerNote: b.providerNote,
      expiresAt: b.expiresAt,
      createdAt: b.createdAt,
      cancelledBy: b.cancelledBy,
      paymentStatus: b.paymentStatus,
      amountDue: Number(b.amountDue),
      amountPaid: Number(b.amountPaid),
      payBy: b.payBy,
      paidAt: b.paidAt
    };
    if (viewer === "provider") {
      return { ...base, customer: b.customer, canComplete: b.status === "confirmed" && b.startAt <= new Date() };
    }
    // Once the provider has said yes, the guest gets what they need to find and reach them.
    const contact = confirmed
      ? {
          phone: b.provider?.contact?.phone ?? null,
          whatsapp: b.provider?.contact?.whatsapp ?? null,
          address: b.provider?.location?.address ?? null,
          district: b.provider?.district ?? null,
          mapsUrl: Number.isFinite(b.provider?.location?.geo?.coordinates?.[1]) ? `https://www.google.com/maps/search/?api=1&query=${b.provider.location.geo.coordinates[1]},${b.provider.location.geo.coordinates[0]}` : null
        }
      : null;
    return { ...base, contact, canCancel: HOLDING.includes(b.status), canPay: b.status === "confirmed" && b.paymentStatus === "payable" && (!b.payBy || b.payBy > new Date()) };
  }

  // ----- emails (best effort, never block a booking) ----------------------------------------------

  async _send({ to, email }) {
    if (!to || !email) return;
    await sendMail({ to, email });
  }

  notifyPaid(id) {
    return this._notify("paid", id);
  }

  _when(b) {
    if (b.unit === "hour") return `${b.startDate}, ${b.startTime} to ${b.endTime}`;
    return b.startDate === b.endDate ? b.startDate : `${b.startDate} to ${b.endDate}`;
  }

  async _notify(event, id) {
    const b = await this._load(id);
    if (!b) return;
    const providerEmail = b.provider?.user?.email;
    const customerEmail = b.customer?.email || b.user?.email;
    const contact = event === "confirmed" ? this.toDto(b, { viewer: "customer" }).contact : null;
    const ctx = {
      listingName: b.listingName,
      when: this._when(b),
      size: `${b.quantity > 1 ? `${b.quantity} × ` : ""}${b.units} ${b.unit}${b.units > 1 ? "s" : ""}`,
      total: b.total,
      reference: b.reference,
      status: b.status,
      paymentStatus: b.paymentStatus,
      guest: { name: b.customer?.name, phone: b.customer?.phone, notes: b.customer?.notes },
      hoursToAnswer: b.expiresAt && b.createdAt ? Math.round((b.expiresAt - b.createdAt) / HOUR_MS) : null,
      hoursToPay: b.payBy ? Math.max(1, Math.round((b.payBy - Date.now()) / HOUR_MS)) : null,
      amountDue: b.amountDue,
      amountPaid: b.amountPaid,
      policy: POLICIES[b.policy],
      providerNote: b.providerNote,
      address: contact?.address,
      phone: contact?.phone,
      depositNote: b.listing?.booking?.depositNote
    };
    const jobs = {
      created: [["provider", providerEmail], ["customer", customerEmail]],
      confirmed: [["customer", customerEmail]],
      paid: [["provider", providerEmail], ["customer", customerEmail]],
      declined: [["customer", customerEmail]],
      cancelled_by_provider: [["customer", customerEmail]],
      cancelled_by_customer: [["provider", providerEmail]]
    }[event] || [];
    for (const [audience, to] of jobs) await this._send({ to, email: bookingEmail({ event, to: audience, ctx }) });
  }
}
