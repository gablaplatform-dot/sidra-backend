import crypto from "node:crypto";
import { prisma } from "../config/db.js";
import { AppError } from "../utils/AppError.js";
import {
  departureTime,
  cancellationDeadline,
  canCancelBooking,
} from "../domain/busPolicy.js";
import { busBookingUpdate } from "../emails/busBookingUpdate.js";
import { sendMail } from "../emails/mailer.js";
import { centsToDecimal, parseMoneyToCents } from "../utils/money.js";

const fail = (message, code = "BUS_INVALID", statusCode = 409) =>
  new AppError({ message, code, statusCode });
export class BusManagementService {
  constructor({
    catalogService,
    operatorService,
    bookingService,
    mail = sendMail,
  }) {
    Object.assign(this, {
      catalogService,
      operatorService,
      bookingService,
      mail,
    });
  }
  async createCompany(input) {
    const slug = await this.operatorService._uniqueSlug(input.companyName);
    const email = input.email?.trim().toLowerCase() || null;
    // The operational contact is not a sign-in account. Never claim a customer's existing email.
    const company = await prisma.busOperator.create({
      data: {
        user: {
          create: {
            name: input.contactName,
            role: "bus_operator",
            email: `bus-managed-${crypto.randomUUID()}@internal.gabla.invalid`,
            isActive: false,
          },
        },
        companyName: input.companyName,
        slug,
        contactName: input.contactName,
        contactPhone: input.contactPhone,
        parkName: input.parkName,
        parkDistrict: input.parkDistrict,
        parkAddress: input.parkAddress,
        parkLat: input.parkLat,
        parkLng: input.parkLng,
        logoUrl: input.logoUrl || null,
        coverUrl: input.coverUrl || null,
        description: input.description || "",
        managedByGabla: true,
        onboardingStatus: "registered",
        registeredAt: new Date(),
        commissionPercent: input.commissionPercent ?? 5,
        customFields: { contactEmail: email },
      },
    });
    return company;
  }
  async company(id) {
    const company = await prisma.busOperator.findUnique({
      where: { id },
      include: { vehicles: { orderBy: { createdAt: "desc" } } },
    });
    if (!company)
      throw fail("Company not found", "BUS_OPERATOR_NOT_FOUND", 404);
    const [routes, schedules] = await Promise.all([
      this.catalogService.listRoutes(id),
      this.catalogService.listSchedules(id),
    ]);
    return {
      ...company,
      contactEmail: company.customFields?.contactEmail || "",
      routes: routes.items,
      schedules: schedules.items,
    };
  }
  async updateCompany(id, input) {
    await this.company(id);
    const { email, ...data } = input;
    if (email !== undefined) {
      const company = await prisma.busOperator.findUnique({ where: { id } });
      data.customFields = { ...company.customFields, contactEmail: email };
    }
    return prisma.busOperator.update({ where: { id }, data });
  }
  async saveVehicle(operatorId, id, input) {
    if (
      id &&
      !(await prisma.busVehicle.findFirst({ where: { id, operatorId } }))
    )
      throw fail("Bus not found", "BUS_VEHICLE_NOT_FOUND", 404);
    const company = await prisma.busOperator.findUnique({
      where: { id: operatorId },
    });
    if (!company)
      throw fail("Company not found", "BUS_OPERATOR_NOT_FOUND", 404);
    try {
      return id
        ? await prisma.busVehicle.update({ where: { id }, data: input })
        : await prisma.busVehicle.create({ data: { ...input, operatorId } });
    } catch (e) {
      if (e.code === "P2002")
        throw fail("A bus with that registration already exists");
      throw e;
    }
  }
  async bookings({
    operatorId,
    status,
    operationStatus,
    q,
    page = 1,
    limit = 30,
  } = {}) {
    const where = {
      ...(operatorId ? { operatorId } : {}),
      ...(status ? { status } : {}),
      ...(operationStatus ? { operationStatus } : {}),
      ...(q
        ? {
            OR: [
              { reference: { contains: q } },
              { passengerName: { contains: q } },
              { passengerPhone: { contains: q } },
              { payPhone: { contains: q } },
            ],
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      prisma.busBooking.count({ where }),
      prisma.busBooking.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          trip: { include: { route: true, vehicle: true } },
          operator: true,
          tickets: true,
          notifications: true,
        },
      }),
    ]);
    return {
      total,
      page,
      items: items.map((b) => ({
        ...b,
        canCancel: canCancelBooking(b),
        cancellationClosesAt: cancellationDeadline(b),
        effectiveDepartureAt: departureTime(b.trip),
        netAmount: centsToDecimal(
          parseMoneyToCents(b.total) - parseMoneyToCents(b.fee),
        ).toString(),
      })),
    };
  }
  async verifyAvailability({ bookingId, available, note, actorId }) {
    return prisma.$transaction(async (tx) => {
      const b = await tx.busBooking.findUnique({
        where: { id: bookingId },
        include: { trip: true },
      });
      if (!b || b.status !== "confirmed" || b.handoverAt)
        throw fail("Only a paid booking awaiting handover can be checked");
      if (b.trip.status !== "scheduled" || departureTime(b.trip) <= new Date())
        throw fail(
          "This bus has already departed. Review the trip before confirming availability.",
        );
      await tx.busTrip.update({
        where: { id: b.tripId },
        data: {
          availability: available ? "available" : "unavailable",
          availabilityCheckedAt: new Date(),
          availabilityNote: note,
        },
      });
      return tx.busBooking.update({
        where: { id: bookingId },
        data: {
          operationStatus: available ? "bus_confirmed" : "needs_attention",
          operationNote: note,
          checkedAt: new Date(),
          checkedById: actorId,
        },
      });
    });
  }
  async handover({ bookingId, actorId, recipient, phone, reference, amount }) {
    return prisma.$transaction(async (tx) => {
      const b = await tx.busBooking.findUnique({
        where: { id: bookingId },
        include: { trip: true },
      });
      if (
        !b ||
        b.status !== "confirmed" ||
        b.handoverAt ||
        b.operationStatus !== "bus_confirmed"
      )
        throw fail(
          "Confirm bus availability before recording one cash handover",
        );
      if (canCancelBooking(b))
        throw fail(
          "The cancellation window is still open. Wait until the booking is locked.",
        );
      if (
        b.trip.status === "cancelled" ||
        b.trip.availability === "unavailable"
      )
        throw fail("This bus is unavailable");
      const net = parseMoneyToCents(b.total) - parseMoneyToCents(b.fee);
      if (parseMoneyToCents(amount) !== net)
        throw fail("Handover must equal the operator amount shown");
      const changed = await tx.busBooking.updateMany({
        where: {
          id: bookingId,
          status: "confirmed",
          handoverAt: null,
          operationStatus: "bus_confirmed",
        },
        data: {
          handoverAt: new Date(),
          handoverAmount: centsToDecimal(net),
          handoverRecipient: recipient,
          handoverPhone: phone,
          handoverReference: reference,
          handoverById: actorId,
          operationStatus: "handed_over",
        },
      });
      if (!changed.count) throw fail("This handover was already recorded");
      const debit = await tx.busOperator.updateMany({
        where: {
          id: b.operatorId,
          walletBalance: { gte: centsToDecimal(net) },
        },
        data: { walletBalance: { decrement: centsToDecimal(net) } },
      });
      if (!debit.count)
        throw fail(
          "Operator funds are already reserved or paid. Review payouts first.",
        );
      return { ok: true };
    });
  }
  async cancelBooking({ bookingId, userId }) {
    return prisma.$transaction(async (tx) => {
      const b = await tx.busBooking.findFirst({
        where: { id: bookingId, userId },
        include: { trip: true, tickets: true, transaction: true },
      });
      if (!b) throw fail("Booking not found", "BUS_BOOKING_NOT_FOUND", 404);
      if (!canCancelBooking(b))
        throw fail(
          "The cancellation period has ended or this booking cannot be cancelled",
          "BUS_CANCELLATION_CLOSED",
        );
      const changed = await tx.busBooking.updateMany({
        where: {
          id: bookingId,
          status: "confirmed",
          lockedAt: null,
          handoverAt: null,
        },
        data: {
          status: "refund_due",
          cancelledAt: new Date(),
          operationStatus: "cancelled",
        },
      });
      if (!changed.count) throw fail("This booking was already updated");
      await tx.busTicket.updateMany({
        where: { bookingId },
        data: { status: "cancelled" },
      });
      if (b.transaction)
        await tx.busOperator.update({
          where: { id: b.operatorId },
          data: { walletBalance: { decrement: b.transaction.netAmount } },
        });
      await this.queue(bookingId, "cancelled", tx);
      return {
        ok: true,
        status: "refund_due",
        message:
          "Booking cancelled. Gabla will return the payment to the number you paid from.",
      };
    });
  }
  async queue(bookingId, kind, db = prisma) {
    return db.busNotification.upsert({
      where: { bookingId_kind: { bookingId, kind } },
      update: {},
      create: { bookingId, kind },
    });
  }
  async maintenance() {
    const now = new Date();
    await prisma.busBooking.updateMany({
      where: { status: "pending_payment", expiresAt: { lte: now } },
      data: { status: "expired" },
    });
    // These indexes narrow work to live trips; delay is added before making the transition.
    const trips = await prisma.busTrip.findMany({
      where: {
        status: { in: ["scheduled", "departed"] },
        departureAt: { lte: now },
      },
      include: { route: true },
      take: 1000,
    });
    for (const t of trips) {
      if (departureTime(t) <= now)
        await prisma.busTrip.updateMany({
          where: { id: t.id, status: t.status },
          data: {
            status:
              departureTime(t).getTime() + t.route.durationMinutes * 60000 <=
              now.getTime()
                ? "completed"
                : "departed",
          },
        });
    }
    const active = await prisma.busBooking.findMany({
      where: { status: "confirmed", lockedAt: null, cancellationClosesAt:{not:null} },
      include: { trip: true, tickets: true },
      take: 1000,
    });
    for (const b of active) {
      if (b.trip.status === "cancelled") continue;
      if (!canCancelBooking(b, now))
        await prisma.$transaction(async (tx) => {
          const changed = await tx.busBooking.updateMany({
            where: { id: b.id, status: "confirmed", lockedAt: null },
            data: { lockedAt: now },
          });
          if (changed.count) await this.queue(b.id, "locked", tx);
        });
    }
    // Also recover paid booking emails if a process stopped just after the gateway commit.
    const unpaidMail = await prisma.busBooking.findMany({
      where: {
        status: "confirmed",
        cancellationClosesAt:{not:null},
        notifications: { none: { kind: "ticket" } },
      },
      select: { id: true },
      take: 100,
    });
    for (const b of unpaidMail) await this.queue(b.id, "ticket");
    await this.deliver();
  }
  async deliver() {
    const now = new Date();
    const jobs = await prisma.busNotification.findMany({
      where: {
        status: { not: "sent" },
        nextAttemptAt: { lte: now },
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
      },
      orderBy: { createdAt: "asc" },
      take: 20,
    });
    for (const j of jobs) {
      const claim = await prisma.busNotification.updateMany({
        where: {
          id: j.id,
          status: { not: "sent" },
          OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
        },
        data: {
          leaseUntil: new Date(Date.now() + 120000),
          attempts: { increment: 1 },
        },
      });
      if (!claim.count) continue;
      try {
        const b = await prisma.busBooking.findUnique({
          where: { id: j.bookingId },
          include: {
            user: true,
            operator: true,
            trip: { include: { route: true } },
            tickets: true,
          },
        });
        if (["locked","ticket"].includes(j.kind) && b.status !== "confirmed") {
          await prisma.busNotification.update({
            where: { id: j.id },
            data: { status: "sent", lastError: "superseded", leaseUntil: null },
          });
          continue;
        }
        const email = busBookingUpdate({ booking: b, kind: j.kind });
        const result = await this.mail({
          to: b.passengerEmail || b.user.email,
          email,
          idempotencyKey: `bus-${j.id}`,
        });
        if (!result?.sent)
          throw new Error(result?.deliveryStatus || "delivery_failed");
        await prisma.busNotification.update({
          where: { id: j.id },
          data: {
            status: "sent",
            sentAt: new Date(),
            leaseUntil: null,
            lastError: "",
          },
        });
      } catch (e) {
        await prisma.busNotification.update({
          where: { id: j.id },
          data: {
            status: "pending",
            leaseUntil: null,
            lastError: String(e.message).slice(0, 200),
            nextAttemptAt: new Date(
              Date.now() +
                Math.min(3600000, 60000 * 2 ** Math.min(j.attempts, 6)),
            ),
          },
        });
      }
    }
  }
}
