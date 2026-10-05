import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";

import { AppError } from "../utils/AppError.js";
import { prisma } from "../config/db.js";
import { env } from "../config/env.js";
import { Roles } from "../constants/enums.js";
import { verifyGoogleIdToken } from "../utils/googleAuth.js";
import { slugify } from "../utils/busIds.js";
import { buildFieldSchema } from "../constants/dynamicFieldSchema.js";

const INVITE_DAYS = 7;
const bad = (message, code, statusCode = 400) => new AppError({ message, statusCode, code });
const tokenHash = (token) => crypto.createHash("sha256").update(token).digest("hex");
const normalizeEmail = (email) => String(email ?? "").trim().toLowerCase();
const uniqueError = (e, field) => e?.code === "P2002" && (!field || (Array.isArray(e?.meta?.target) && e.meta.target.includes(field)));
const fieldSchema = buildFieldSchema();

const decimalString = (value) => (value === null || value === undefined ? "0" : value.toString());

// The bus company as seen by the admin and the operator themselves.
export const operatorDto = (op) => ({
  id: op.id,
  userId: op.userId,
  companyName: op.companyName,
  slug: op.slug,
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
  customFields: op.customFields ?? {},
  onboardingStatus: op.onboardingStatus,
  status: op.status,
  commissionPercent: decimalString(op.commissionPercent),
  walletBalance: decimalString(op.walletBalance),
  ratingAvg: op.ratingAvg,
  ratingCount: op.ratingCount,
  invitationSentAt: op.invitationSentAt,
  registeredAt: op.registeredAt,
  createdAt: op.createdAt,
  ...(op.user ? { email: op.user.email, contactName: op.user.name } : {})
});

export class BusOperatorService {
  constructor({ emailService, catalogService, hashPassword }) {
    this.emailService = emailService;
    this.catalogService = catalogService;
    this.hashPassword = hashPassword;
  }

  // ---------------------------------------------------------------- platform settings
  async getSettings() {
    const row = await prisma.busSettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
    return {
      onboardingFields: Array.isArray(row.onboardingFields) ? row.onboardingFields : [],
      defaultCommissionPercent: decimalString(row.defaultCommissionPercent),
      holdMinutes: row.holdMinutes
    };
  }

  async updateSettings({ onboardingFields, defaultCommissionPercent, holdMinutes }) {
    const data = {};
    if (onboardingFields !== undefined) {
      const seen = new Set();
      data.onboardingFields = onboardingFields.map((raw) => {
        const { value, error } = fieldSchema.validate(raw, { stripUnknown: true });
        if (error) throw bad(error.details[0].message, "BUS_FIELD_INVALID");
        if (seen.has(value.key)) throw bad(`Two questions share the key "${value.key}"`, "BUS_FIELD_DUPLICATE");
        seen.add(value.key);
        return value;
      });
    }
    if (defaultCommissionPercent !== undefined) data.defaultCommissionPercent = new Prisma.Decimal(defaultCommissionPercent);
    if (holdMinutes !== undefined) data.holdMinutes = holdMinutes;
    await prisma.busSettings.upsert({ where: { id: "singleton" }, update: data, create: { id: "singleton", ...data } });
    return this.getSettings();
  }

  // ---------------------------------------------------------------- invitations (admin)
  signOnboardingToken({ userId, operatorId }) {
    return jwt.sign({ sub: String(userId), operatorId: String(operatorId), purpose: "bus_operator_onboarding" }, env.jwtSecret, {
      issuer: env.jwtIssuer,
      expiresIn: `${INVITE_DAYS}d`
    });
  }

  verifyOnboardingToken(token) {
    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret, { issuer: env.jwtIssuer });
    } catch {
      throw bad("This invitation link has expired or is invalid. Ask for a new one.", "INVALID_TOKEN");
    }
    if (payload?.purpose !== "bus_operator_onboarding") throw bad("Invalid token", "INVALID_TOKEN");
    return payload;
  }

  onboardingUrl(token) {
    return `${env.appBaseUrl.replace(/\/$/, "")}/bus/onboarding?token=${encodeURIComponent(token)}`;
  }

  async _uniqueSlug(companyName) {
    const base = slugify(companyName);
    for (let i = 0; i < 20; i += 1) {
      const slug = i ? `${base}-${i + 1}` : base;
      if (!(await prisma.busOperator.findUnique({ where: { slug } }))) return slug;
    }
    return `${base}-${crypto.randomBytes(2).toString("hex")}`;
  }

  async invite({ companyName, contactName, email, phone, commissionPercent }) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) throw bad("An email address is required for the invitation", "EMAIL_REQUIRED");
    const settings = await this.getSettings();

    let user;
    let operator;
    try {
      ({ user, operator } = await prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            name: contactName || companyName,
            email: normalizedEmail,
            phone: phone ? String(phone).trim() : null,
            passwordHash: await this.hashPassword(crypto.randomBytes(32).toString("hex")),
            role: Roles.BUS_OPERATOR
          }
        });
        const createdOperator = await tx.busOperator.create({
          data: {
            userId: createdUser.id,
            companyName: companyName.trim(),
            slug: await this._uniqueSlug(companyName),
            contactPhone: phone ? String(phone).trim() : null,
            commissionPercent: new Prisma.Decimal(commissionPercent ?? settings.defaultCommissionPercent)
          }
        });
        return { user: createdUser, operator: createdOperator };
      }));
    } catch (e) {
      if (uniqueError(e, "email")) throw bad("That email already has a Gabla account. Use a different email for the bus company.", "EMAIL_IN_USE", 409);
      if (uniqueError(e, "phone")) throw bad("That phone number is already in use", "PHONE_IN_USE", 409);
      throw e;
    }

    const delivery = await this._sendInvitation({ operator, email: normalizedEmail, userId: user.id });
    const fresh = await prisma.busOperator.findUnique({ where: { id: operator.id }, include: { user: true } });
    return { operator: operatorDto(fresh), delivery };
  }

  async _sendInvitation({ operator, email, userId, existingInvitationId }) {
    const token = this.signOnboardingToken({ userId, operatorId: operator.id });
    const link = this.onboardingUrl(token);
    const delivery = await this.emailService.sendOperatorInvitation({ to: email, companyName: operator.companyName, link });
    const now = new Date();
    const expiresAt = new Date(now.getTime() + INVITE_DAYS * 24 * 3600 * 1000);
    const data = { email, tokenHash: tokenHash(token), status: "sent", lastSentAt: now, expiresAt, metadata: { deliveryProvider: "resend", ...delivery } };
    if (existingInvitationId) {
      await prisma.busOperatorInvitation.update({ where: { id: existingInvitationId }, data: { ...data, resentCount: { increment: 1 } } });
    } else {
      await prisma.busOperatorInvitation.create({ data: { operatorId: operator.id, sentAt: now, ...data } });
    }
    await prisma.busOperator.update({ where: { id: operator.id }, data: { onboardingStatus: "invitation_sent", invitationSentAt: now } });
    return { ...delivery, link: delivery.sent ? undefined : link }; // when email isn't configured the admin can copy the link
  }

  async resendInvitation(operatorId) {
    const operator = await prisma.busOperator.findUnique({ where: { id: operatorId }, include: { user: true } });
    if (!operator) throw bad("Bus operator not found", "BUS_OPERATOR_NOT_FOUND", 404);
    if (operator.onboardingStatus === "registered") throw bad("This operator has already completed registration", "ALREADY_REGISTERED", 409);
    const existing = await prisma.busOperatorInvitation.findFirst({ where: { operatorId }, orderBy: { createdAt: "desc" } });
    return this._sendInvitation({ operator, email: operator.user.email, userId: operator.userId, existingInvitationId: existing?.id });
  }

  // ---------------------------------------------------------------- admin management
  async listOperators({ q, status, page = 1, limit = 50 } = {}) {
    const take = Math.min(100, Math.max(1, Number(limit) || 50));
    const where = {
      ...(status ? { status } : {}),
      ...(q ? { OR: [{ companyName: { contains: q } }, { parkName: { contains: q } }, { user: { email: { contains: q } } }] } : {})
    };
    const [rows, total] = await Promise.all([
      prisma.busOperator.findMany({ where, orderBy: { createdAt: "desc" }, skip: (Math.max(1, Number(page)) - 1) * take, take, include: { user: true } }),
      prisma.busOperator.count({ where })
    ]);
    const ids = rows.map((r) => r.id);
    const [sales, routes, upcoming] = await Promise.all([
      prisma.busBooking.groupBy({ by: ["operatorId"], where: { operatorId: { in: ids }, status: "confirmed" }, _sum: { total: true, fee: true }, _count: true }),
      prisma.busRoute.groupBy({ by: ["operatorId"], where: { operatorId: { in: ids }, isActive: true }, _count: true }),
      prisma.busTrip.groupBy({ by: ["operatorId"], where: { operatorId: { in: ids }, status: "scheduled", departureAt: { gt: new Date() } }, _count: true })
    ]);
    const by = (list) => new Map(list.map((x) => [x.operatorId, x]));
    const salesBy = by(sales);
    const routesBy = by(routes);
    const upcomingBy = by(upcoming);
    return {
      items: rows.map((r) => ({
        ...operatorDto(r),
        stats: {
          bookings: salesBy.get(r.id)?._count ?? 0,
          revenue: decimalString(salesBy.get(r.id)?._sum.total),
          commission: decimalString(salesBy.get(r.id)?._sum.fee),
          routes: routesBy.get(r.id)?._count ?? 0,
          upcomingTrips: upcomingBy.get(r.id)?._count ?? 0
        }
      })),
      page: Number(page) || 1,
      limit: take,
      total
    };
  }

  async getOperator(id) {
    const operator = await prisma.busOperator.findUnique({ where: { id }, include: { user: true } });
    if (!operator) throw bad("Bus operator not found", "BUS_OPERATOR_NOT_FOUND", 404);
    return operatorDto(operator);
  }

  async updateOperator(id, patch) {
    const data = {};
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.commissionPercent !== undefined) data.commissionPercent = new Prisma.Decimal(patch.commissionPercent);
    if (patch.companyName !== undefined) data.companyName = patch.companyName;
    if (patch.contactPhone !== undefined) data.contactPhone = patch.contactPhone;
    const operator = await prisma.busOperator.update({ where: { id }, data, include: { user: true } }).catch((e) => {
      if (e?.code === "P2025") throw bad("Bus operator not found", "BUS_OPERATOR_NOT_FOUND", 404);
      throw e;
    });
    // A suspended operator simply stops appearing in search (every public query filters on status), so nothing else changes.
    return operatorDto(operator);
  }

  // ---------------------------------------------------------------- onboarding (by emailed link)
  async getOnboardingInfo({ token }) {
    const payload = this.verifyOnboardingToken(token);
    const operator = await prisma.busOperator.findUnique({ where: { id: String(payload.operatorId) }, include: { user: true } });
    if (!operator) throw bad("Bus operator not found", "BUS_OPERATOR_NOT_FOUND", 404);
    const [settings, types] = await Promise.all([this.getSettings(), this.catalogService.listTypes()]);
    return {
      operator: operatorDto(operator),
      email: operator.user.email,
      questions: settings.onboardingFields,
      busTypes: types.items
    };
  }

  async completeOnboarding({ token, profile, routes, password }) {
    const payload = this.verifyOnboardingToken(token);
    const operator = await prisma.busOperator.findUnique({ where: { id: String(payload.operatorId) } });
    if (!operator) throw bad("Bus operator not found", "BUS_OPERATOR_NOT_FOUND", 404);

    // Required admin-defined questions must be answered.
    const settings = await this.getSettings();
    const answers = profile.customFields ?? {};
    for (const field of settings.onboardingFields) {
      if (!field.required) continue;
      const value = answers[field.key];
      const empty = value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
      if (empty) throw bad(`Please answer: ${field.label}`, "BUS_QUESTION_REQUIRED");
    }
    if (!Array.isArray(routes) || !routes.length) throw bad("Add at least one route so passengers can book", "BUS_ROUTE_REQUIRED");

    await prisma.busOperator.update({
      where: { id: operator.id },
      data: {
        companyName: profile.companyName?.trim() || operator.companyName,
        description: profile.description ?? "",
        logoUrl: profile.logoUrl ?? null,
        coverUrl: profile.coverUrl ?? null,
        contactPhone: profile.contactPhone ?? operator.contactPhone,
        whatsapp: profile.whatsapp ?? null,
        parkName: profile.parkName.trim(),
        parkDistrict: profile.parkDistrict,
        parkAddress: profile.parkAddress ?? null,
        parkLat: profile.parkLat ?? null,
        parkLng: profile.parkLng ?? null,
        fleetSize: profile.fleetSize ?? 0,
        customFields: answers
      }
    });

    // Routes are created after the profile so a bad route (e.g. an invalid bus type) leaves the
    // operator able to correct it and resubmit; the profile save above is safe to repeat.
    const created = [];
    const existing = await prisma.busRoute.count({ where: { operatorId: operator.id } });
    if (!existing) {
      for (const route of routes) {
        created.push(await this.catalogService.createRoute(operator.id, { boardingPoint: profile.parkName, ...route }));
      }
    }

    await prisma.busOperator.update({ where: { id: operator.id }, data: { onboardingStatus: "registered", registeredAt: new Date() } });
    // Operators who prefer email + password set it here; those using Google can skip it.
    if (password) await prisma.user.update({ where: { id: operator.userId }, data: { passwordHash: await this.hashPassword(password) } });
    await prisma.busOperatorInvitation.updateMany({
      where: { operatorId: operator.id, tokenHash: tokenHash(token), status: "sent" },
      data: { status: "accepted", acceptedAt: new Date() }
    });
    const user = await prisma.user.findUnique({ where: { id: operator.userId } });
    const accessToken = jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { issuer: env.jwtIssuer, expiresIn: env.jwtAccessTtlSeconds });
    return {
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone, authProvider: user.authProvider, avatarUrl: user.avatarUrl, profile: user.profile ?? {} },
      busOperator: await this.getOperator(operator.id)
    };
  }

  // Signing in with Google is only possible for the exact email that was invited: the link proves
  // someone holds the invitation, the matching Google email proves it is the invited person.
  async linkGoogleAccount({ onboardingToken, idToken }) {
    const payload = this.verifyOnboardingToken(onboardingToken);
    if (!env.googleClientId) throw bad("Google login is not configured", "GOOGLE_LOGIN_NOT_CONFIGURED", 503);
    const profile = await verifyGoogleIdToken(idToken, env.googleClientId);
    const googleSub = String(profile.sub);

    const user = await prisma.user.findUnique({ where: { id: String(payload.sub) } });
    if (!user) throw bad("User not found", "USER_NOT_FOUND", 404);
    const conflict = await prisma.user.findFirst({ where: { googleSub, NOT: { id: user.id } } });
    if (conflict) {
      throw bad("This Google account is already linked to a different Gabla account. Use the Google account for the invited email.", "GOOGLE_ACCOUNT_ALREADY_LINKED", 409);
    }
    if (normalizeEmail(profile.email) !== normalizeEmail(user.email)) {
      throw bad(`This invitation was sent to ${user.email}. Please sign in with the Google account for that email address.`, "GOOGLE_EMAIL_MISMATCH", 409);
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { googleSub, authProvider: "google", avatarUrl: profile.picture ?? user.avatarUrl, name: user.name || profile.name || user.email }
    });
    const operator = await prisma.busOperator.findUnique({ where: { userId: user.id } });
    const accessToken = jwt.sign({ sub: updated.id, role: updated.role }, env.jwtSecret, { issuer: env.jwtIssuer, expiresIn: env.jwtAccessTtlSeconds });
    return {
      accessToken,
      user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, phone: updated.phone, authProvider: updated.authProvider, avatarUrl: updated.avatarUrl, profile: updated.profile ?? {} },
      busOperator: operator ? { id: operator.id, userId: operator.userId, slug: operator.slug } : null
    };
  }

  // ---------------------------------------------------------------- the operator themselves
  async requireOperator(userId) {
    const operator = await prisma.busOperator.findUnique({ where: { userId } });
    if (!operator) throw bad("Bus operator account not found", "BUS_OPERATOR_NOT_FOUND", 404);
    if (operator.status === "suspended") throw bad("This bus company has been suspended. Contact Gabla support.", "BUS_OPERATOR_SUSPENDED", 403);
    return operator;
  }

  async getMe(userId) {
    const operator = await prisma.busOperator.findUnique({ where: { userId }, include: { user: true } });
    if (!operator) throw bad("Bus operator account not found", "BUS_OPERATOR_NOT_FOUND", 404);
    const settings = await this.getSettings();
    return { operator: operatorDto(operator), questions: settings.onboardingFields };
  }

  async updateMe(userId, patch) {
    const operator = await this.requireOperator(userId);
    const data = {};
    for (const key of ["companyName", "description", "logoUrl", "coverUrl", "contactPhone", "whatsapp", "parkName", "parkDistrict", "parkAddress", "parkLat", "parkLng", "fleetSize", "customFields"]) {
      if (patch[key] !== undefined) data[key] = patch[key];
    }
    const updated = await prisma.busOperator.update({ where: { id: operator.id }, data, include: { user: true } });
    return operatorDto(updated);
  }
}
