import crypto from "crypto";
import jwt from "jsonwebtoken";

import { AppError } from "../utils/AppError.js";
import { prisma } from "../config/db.js";
import { PaymentService } from "./payment.service.js";
import { env } from "../config/env.js";
import { AudienceService, audienceProviderWhere } from "./audience.service.js";
import { verifyGoogleIdToken } from "../utils/googleAuth.js";
import { geohashEncode } from "../utils/geohash.js";
import { signAccessToken } from "../utils/jwt.js";
import { sendMail } from "../emails/mailer.js";
import { providerInvite, providerRelink } from "../emails/templates.js";

const GEOHASH_PRECISION_FINE = 6; // ~1.2km x 0.6km cells - the primary search
const GEOHASH_PRECISION_COARSE = 5; // ~4.9km x 4.9km cells - fallback for wider radii

// Keeps the indexed lat/lng/geohash/district columns in sync with the location JSON blob
// (geo.coordinates, GeoJSON [lng, lat]; district is a direct passthrough, admin-picked from a
// fixed list) so nearby search can query indexed columns instead of scanning JSON.
const buildGeoColumns = (location) => {
  const coords = location?.geo?.coordinates;
  const district = location?.district ?? null;
  if (Array.isArray(coords) && coords.length === 2 && Number.isFinite(coords[0]) && Number.isFinite(coords[1])) {
    const [lng, lat] = coords;
    return {
      lat,
      lng,
      geohash5: geohashEncode(lat, lng, GEOHASH_PRECISION_COARSE),
      geohash6: geohashEncode(lat, lng, GEOHASH_PRECISION_FINE),
      district
    };
  }
  return { lat: null, lng: null, geohash5: null, geohash6: null, district };
};

const uniqueError = (e, field) => e?.code === "P2002" && Array.isArray(e?.meta?.target) && e.meta.target.includes(field);
const safeSlug = (value) =>
  String(value ?? "provider")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "provider";
const tokenHash = (token) => crypto.createHash("sha256").update(token).digest("hex");
export class ProviderService {
  constructor({ hashPassword, paymentService = new PaymentService() }) {
    this.hashPassword = hashPassword;
    this.paymentService = paymentService;
    this.audienceService = new AudienceService();
  }

  normalizeEmail(email) {
    return String(email ?? "").trim().toLowerCase() || null;
  }

  normalizePhone(phone) {
    return String(phone ?? "").trim() || null;
  }

  async getEffectiveSettingsForProvider(provider) {
    const global = await this.paymentService.getSettings();
    return this.paymentService.computeEffectiveForProvider({ global, provider });
  }

  redactContact(contact) {
    if (!contact) return { phone: null, whatsapp: null, email: null, website: null };
    return {
      phone: null,
      whatsapp: null,
      email: null,
      website: null
    };
  }

  redactLocation(location) {
    return {
      address: null,
      city: location?.city ?? null,
      region: location?.region ?? null,
      country: location?.country ?? null,
      geo: null
    };
  }

  // kind "invite": the emailed onboarding link (one use, backed by a ProviderInvitation row).
  // kind "relink": only reconnects Google sign-in for an existing provider; it can't change a password or approval.
  signOnboardingToken({ userId, providerId, kind = "invite" }) {
    return jwt.sign(
      { sub: String(userId), providerId: String(providerId), purpose: "provider_onboarding", kind },
      env.jwtSecret,
      { issuer: env.jwtIssuer, expiresIn: "7d" }
    );
  }

  onboardingUrl(token) {
    const base = env.providerOnboardingBaseUrl || `${env.appBaseUrl.replace(/\/$/, "")}/provider/onboarding`;
    return `${base.replace(/\/$/, "")}?token=${encodeURIComponent(token)}`;
  }

  async sendInvitationEmail({ to, businessName, token }) {
    return sendMail({ to, email: providerInvite({ businessName, link: this.onboardingUrl(token) }) });
  }

  makeProviderSlug(businessName) {
    return `${safeSlug(businessName)}-${crypto.randomBytes(3).toString("hex")}`;
  }

  verifyOnboardingToken(token) {
    const payload = jwt.verify(token, env.jwtSecret, { issuer: env.jwtIssuer });
    if (payload?.purpose !== "provider_onboarding") {
      throw new AppError({ message: "Invalid token", statusCode: 400, code: "INVALID_TOKEN" });
    }
    return payload;
  }

  // The invitation behind an emailed link: it must be the latest one sent (resending replaces the old link),
  // not yet used and not expired.
  async liveInvitation(token, payload, { statuses = ["sent"] } = {}) {
    const invitation = await prisma.providerInvitation.findFirst({
      where: { providerId: String(payload.providerId), tokenHash: tokenHash(token), status: { in: statuses }, expiresAt: { gt: new Date() } }
    });
    if (!invitation) {
      throw new AppError({ message: "This invitation link has already been used or replaced. Ask for a new one.", statusCode: 400, code: "INVALID_TOKEN" });
    }
    return invitation;
  }

  async adminCreateProvider({
    name,
    email,
    phone,
    businessName,
    description,
    categoryId,
    location,
    contact,
    media,
    customFields
  }) {
    const normalizedEmail = email ? this.normalizeEmail(email) : null;
    const normalizedPhone = phone ? this.normalizePhone(phone) : null;

    if (!normalizedEmail) {
      throw new AppError({
        message: "Email is required for provider invitations",
        statusCode: 400,
        code: "EMAIL_REQUIRED"
      });
    }

    const temporaryPassword = crypto.randomBytes(32).toString("hex");
    const passwordHash = await this.hashPassword(temporaryPassword);

    let createdUser;
    let createdProvider;
    try {
      const created = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name,
            email: normalizedEmail,
            phone: normalizedPhone,
            passwordHash,
            role: "provider"
          }
        });

        const provider = await tx.provider.create({
          data: {
            userId: user.id,
            businessName,
            publicSlug: this.makeProviderSlug(businessName),
            description: description ?? "",
            categoryId: categoryId ?? null,
            location: location ?? {},
            ...buildGeoColumns(location ?? {}),
            contact: contact ?? {},
            media: media ?? {},
            customFields: customFields ?? {},
            moderationStatus: "pending",
            onboardingStatus: "draft",
            walletEnabled: true
          }
        });

        return { user, provider };
      });

      createdUser = created.user;
      createdProvider = created.provider;
    } catch (e) {
      if (uniqueError(e, "email")) {
        throw new AppError({ message: "Email already in use", statusCode: 409, code: "EMAIL_IN_USE" });
      }
      if (uniqueError(e, "phone")) {
        throw new AppError({ message: "Phone already in use", statusCode: 409, code: "PHONE_IN_USE" });
      }
      throw e;
    }

    const onboardingToken = this.signOnboardingToken({ userId: createdUser.id, providerId: createdProvider.id });
    const now = new Date();
    const emailDelivery = await this.sendInvitationEmail({ to: normalizedEmail, businessName, token: onboardingToken });
    await prisma.$transaction([
      prisma.provider.update({
        where: { id: createdProvider.id },
        data: { onboardingStatus: "invitation_sent", invitationSentAt: now }
      }),
      prisma.providerInvitation.create({
        data: {
          providerId: createdProvider.id,
          email: normalizedEmail,
          tokenHash: tokenHash(onboardingToken),
          status: "sent",
          sentAt: now,
          lastSentAt: now,
          expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          metadata: { deliveryProvider: "resend", ...emailDelivery }
        }
      })
    ]);

    return {
      delivery: emailDelivery,
      user: {
        id: createdUser.id,
        name: createdUser.name,
        email: createdUser.email,
        phone: createdUser.phone,
        role: createdUser.role,
        createdAt: createdUser.createdAt,
        updatedAt: createdUser.updatedAt
      },
      provider: {
        id: createdProvider.id,
        userId: createdProvider.userId,
        businessName: createdProvider.businessName,
        publicSlug: createdProvider.publicSlug,
        description: createdProvider.description,
        categoryId: createdProvider.categoryId,
        location: createdProvider.location,
        contact: createdProvider.contact,
        media: createdProvider.media,
        customFields: createdProvider.customFields,
        isApproved: createdProvider.isApproved,
        onboardingStatus: "invitation_sent",
        invitationSentAt: now,
        ratingAvg: createdProvider.ratingAvg ?? 0,
        ratingCount: createdProvider.ratingCount ?? 0,
        subscriptionStatus: createdProvider.subscriptionStatus,
        walletEnabled: createdProvider.walletEnabled,
        onlinePaymentsEnabled: createdProvider.onlinePaymentsEnabled,
        createdAt: createdProvider.createdAt,
        updatedAt: createdProvider.updatedAt
      }
    };
  }

  async resendInvitation({ providerId }) {
    const provider = await prisma.provider.findUnique({ where: { id: providerId } });
    if (!provider) throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    const user = await prisma.user.findUnique({ where: { id: provider.userId } });
    if (!user?.email) throw new AppError({ message: "Provider email is required", statusCode: 400, code: "EMAIL_REQUIRED" });
    const token = this.signOnboardingToken({ userId: user.id, providerId: provider.id });
    const now = new Date();
    const emailDelivery = await this.sendInvitationEmail({ to: user.email, businessName: provider.businessName, token });
    const existing = await prisma.providerInvitation.findFirst({ where: { providerId: provider.id }, orderBy: { createdAt: "desc" } });
    const invitation = existing
      ? await prisma.providerInvitation.update({
          where: { id: existing.id },
          data: {
            email: user.email,
            tokenHash: tokenHash(token),
            status: "sent",
            resentCount: { increment: 1 },
            lastSentAt: now,
            expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
            metadata: { deliveryProvider: "resend", ...emailDelivery }
          }
        })
      : await prisma.providerInvitation.create({
          data: {
            providerId: provider.id,
            email: user.email,
            tokenHash: tokenHash(token),
            status: "sent",
            sentAt: now,
            lastSentAt: now,
            expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
            metadata: { deliveryProvider: "resend", ...emailDelivery }
          }
        });
    // A provider who already registered keeps their live status: this link only lets them set new sign-in details.
    await prisma.provider.update({ where: { id: provider.id }, data: provider.registeredAt ? { invitationSentAt: now } : { onboardingStatus: "invitation_sent", invitationSentAt: now } });
    return { invitationId: invitation.id, delivery: emailDelivery };
  }

  async sendLinkGoogleEmail({ to, businessName, token }) {
    return sendMail({ to, email: providerRelink({ businessName, link: this.onboardingUrl(token) }) });
  }

  // Reconnects an already-registered provider's Google sign-in without touching onboarding
  // status/approval — this is a distinct concern from the original invitation lifecycle
  // (resendInvitation), which mutates onboardingStatus in ways that would misrepresent an
  // active provider as "not yet onboarded".
  async resendGoogleLink({ providerId }) {
    const provider = await prisma.provider.findUnique({ where: { id: providerId } });
    if (!provider) throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    const user = await prisma.user.findUnique({ where: { id: provider.userId } });
    if (!user?.email) throw new AppError({ message: "Provider email is required", statusCode: 400, code: "EMAIL_REQUIRED" });
    const token = this.signOnboardingToken({ userId: user.id, providerId: provider.id, kind: "relink" });
    const delivery = await this.sendLinkGoogleEmail({ to: user.email, businessName: provider.businessName, token });
    return { delivery };
  }

  // Public, self-service version of the above — a provider who can't see their profile after
  // signing in can request their own reconnect link without waiting on an admin. Always returns
  // the same generic response regardless of whether the email matched, so this can't be used to
  // enumerate which emails have a provider account.
  async requestGoogleLink({ email }) {
    const normalizedEmail = this.normalizeEmail(email);
    if (normalizedEmail) {
      const user = await prisma.user.findFirst({ where: { email: normalizedEmail, role: "provider" } });
      if (user) {
        const provider = await prisma.provider.findUnique({ where: { userId: user.id } });
        if (provider) {
          const token = this.signOnboardingToken({ userId: user.id, providerId: provider.id, kind: "relink" });
          await this.sendLinkGoogleEmail({ to: user.email, businessName: provider.businessName, token });
        }
      }
    }
    return { requested: true };
  }

  async getOnboardingInfo({ token }) {
    const payload = this.verifyOnboardingToken(token);
    if (payload.kind !== "relink") await this.liveInvitation(token, payload, { statuses: ["sent", "accepted"] });
    const provider = await prisma.provider.findUnique({ where: { id: String(payload.providerId) } });
    if (!provider) {
      throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    }

    const user = await prisma.user.findUnique({ where: { id: provider.userId } });
    if (!user) {
      throw new AppError({ message: "User not found", statusCode: 404, code: "USER_NOT_FOUND" });
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      provider: {
        id: provider.id,
        userId: provider.userId,
        businessName: provider.businessName,
        description: provider.description,
        categoryId: provider.categoryId,
        location: provider.location,
        contact: provider.contact,
        media: provider.media,
        customFields: provider.customFields,
        isApproved: provider.isApproved,
        onboardingStatus: provider.onboardingStatus,
        ratingAvg: provider.ratingAvg ?? 0,
        ratingCount: provider.ratingCount ?? 0,
        subscriptionStatus: provider.subscriptionStatus,
        walletEnabled: provider.walletEnabled,
        onlinePaymentsEnabled: provider.onlinePaymentsEnabled,
        createdAt: provider.createdAt,
        updatedAt: provider.updatedAt
      }
    };
  }

  async completeOnboarding({ token, password, profile }) {
    const payload = this.verifyOnboardingToken(token);
    if (payload.kind === "relink") {
      throw new AppError({ message: "This link can only reconnect Google sign-in.", statusCode: 400, code: "INVALID_TOKEN" });
    }
    const provider = await prisma.provider.findUnique({ where: { id: String(payload.providerId) } });
    if (!provider) {
      throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    }

    // The link works once: claim its invitation before doing anything, so a copy of the link is dead afterwards.
    const claim = await prisma.providerInvitation.updateMany({
      where: { providerId: provider.id, tokenHash: tokenHash(token), status: "sent", expiresAt: { gt: new Date() } },
      data: { status: "accepted", acceptedAt: new Date() }
    });
    if (claim.count === 0) {
      throw new AppError({ message: "This invitation link has already been used or replaced. Ask for a new one.", statusCode: 400, code: "INVALID_TOKEN" });
    }

    // Providers sign in with Google; a typed password is optional and only replaces the old one when given.
    if (password) {
      await prisma.user.update({ where: { id: provider.userId }, data: { passwordHash: await this.hashPassword(password) } });
    }

    const data = {};
    if (profile?.businessName !== undefined) data.businessName = profile.businessName;
    if (profile?.description !== undefined) data.description = profile.description ?? "";
    if (profile?.categoryId !== undefined) data.categoryId = profile.categoryId ?? null;
    if (profile?.location !== undefined) {
      data.location = profile.location ?? {};
      Object.assign(data, buildGeoColumns(data.location));
    }
    if (profile?.contact !== undefined) data.contact = profile.contact ?? {};
    if (profile?.media !== undefined) data.media = profile.media ?? {};
    if (profile?.customFields !== undefined) data.customFields = profile.customFields ?? {};
    data.onboardingStatus = "registered";
    data.invitationAcceptedAt = new Date();
    // The first registration of an admin-invited provider goes live (the invitation is the approval). A provider who
    // already registered before keeps whatever moderation state an admin has since given them.
    if (!provider.registeredAt) {
      data.registeredAt = new Date();
      // Only a provider still awaiting approval goes live; one an admin rejected or suspended stays that way.
      if (provider.moderationStatus === "pending") {
        data.isApproved = true;
        data.moderationStatus = "approved";
      }
    }

    if (Object.keys(data).length) {
      await prisma.provider.update({ where: { id: provider.id }, data });
    }
    return this.getProviderProfile({ providerId: provider.id, includeUnapproved: true });
  }

  // Linking Google here — right after onboarding, while we still have proof of exactly which
  // account this is via the onboarding token — is what makes every later "Sign in with Google"
  // reliably land on the same account. Matching by email string alone (as the general login
  // does) silently fails whenever the invited email differs even slightly from the Google
  // account the provider actually signs in with, which is why providers were landing on a
  // fresh customer account instead of their own profile.
  async linkGoogleAccount({ onboardingToken, idToken }) {
    const payload = this.verifyOnboardingToken(onboardingToken);
    // An invitation link must still be backed by its invitation (used or replaced links stop working);
    // a reconnect link is bound by the Google-email match below.
    if (payload.kind !== "relink") await this.liveInvitation(onboardingToken, payload, { statuses: ["sent", "accepted"] });
    const userId = String(payload.sub);

    if (!env.googleClientId) {
      throw new AppError({ message: "Google login is not configured", statusCode: 503, code: "GOOGLE_LOGIN_NOT_CONFIGURED" });
    }
    const profile = await verifyGoogleIdToken(idToken, env.googleClientId);
    const googleSub = String(profile.sub);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError({ message: "User not found", statusCode: 404, code: "USER_NOT_FOUND" });
    }

    const conflict = await prisma.user.findFirst({ where: { googleSub, NOT: { id: userId } } });
    if (conflict) {
      throw new AppError({
        message: "This Google account is already linked to a different Gabla account. Please use a different Google account for this provider profile.",
        statusCode: 409,
        code: "GOOGLE_ACCOUNT_ALREADY_LINKED"
      });
    }

    const email = this.normalizeEmail(profile.email);
    // The invite/onboarding link is only proof that whoever clicked it holds the link, not that
    // they're the invited business - anyone who forwards or leaks it could otherwise link any
    // Google account and take over auto-approved provider access. Requiring the Google account's
    // own email to match the address the invite was actually sent to closes that gap.
    const invitedEmail = this.normalizeEmail(user.email);
    if (invitedEmail && email !== invitedEmail) {
      throw new AppError({
        message: `This invitation was sent to ${user.email}. Please sign in with the Google account for that email address.`,
        statusCode: 409,
        code: "GOOGLE_EMAIL_MISMATCH"
      });
    }

    let updatedUser;
    try {
      updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          googleSub,
          authProvider: "google",
          avatarUrl: profile.picture ?? user.avatarUrl,
          name: user.name || profile.name || email
        }
      });
    } catch (e) {
      if (uniqueError(e, "googleSub")) {
        throw new AppError({
          message: "This Google account is already linked to a different Gabla account. Please use a different Google account for this provider profile.",
          statusCode: 409,
          code: "GOOGLE_ACCOUNT_ALREADY_LINKED"
        });
      }
      throw e;
    }

    const accessToken = signAccessToken({ payload: { sub: updatedUser.id, role: updatedUser.role }, secret: env.jwtSecret, issuer: env.jwtIssuer, ttlSeconds: env.jwtAccessTtlSeconds });

    const provider = await prisma.provider.findUnique({ where: { userId: updatedUser.id } });

    return {
      accessToken,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        phone: updatedUser.phone,
        authProvider: updatedUser.authProvider,
        avatarUrl: updatedUser.avatarUrl,
        profile: updatedUser.profile ?? {},
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt
      },
      provider: provider ? { id: provider.id, userId: provider.userId } : null
    };
  }

  async updateMyProviderProfile({ actorUserId, updates }) {
    const provider = await prisma.provider.findUnique({ where: { userId: actorUserId } });
    if (!provider) {
      throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    }

    const data = {};
    if (updates.businessName !== undefined) data.businessName = updates.businessName;
    if (updates.description !== undefined) data.description = updates.description ?? "";
    if (updates.categoryId !== undefined) data.categoryId = updates.categoryId ?? null;
    if (updates.location !== undefined) {
      data.location = updates.location ?? {};
      Object.assign(data, buildGeoColumns(data.location));
    }
    if (updates.contact !== undefined) data.contact = updates.contact ?? {};
    if (updates.media !== undefined) data.media = updates.media ?? {};
    if (updates.customFields !== undefined) data.customFields = updates.customFields ?? {};
    if (updates.onlinePaymentsEnabled !== undefined) data.onlinePaymentsEnabled = Boolean(updates.onlinePaymentsEnabled);

    if (Object.keys(data).length) {
      await prisma.provider.update({ where: { id: provider.id }, data });
    }
    if (updates.audienceIds !== undefined || updates.newAudiences?.length) await this.audienceService.setProviderAudiences(provider.id, updates.audienceIds ?? (await this.audienceService.forProvider(provider.id, { includePending: true })).map((a) => a.id), updates.newAudiences);

    return this.getProviderProfile({ providerId: provider.id, includeUnapproved: true });
  }

  async getMyProviderProfile({ actorUserId }) {
    const provider = await prisma.provider.findUnique({ where: { userId: actorUserId } });
    if (!provider) {
      throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    }

    return this.getProviderProfile({ providerId: provider.id, includeUnapproved: true });
  }

  async adminSetApproval({ providerId, approved }) {
    const updated = await prisma.provider.update({
      where: { id: providerId },
      data: {
        isApproved: Boolean(approved),
        moderationStatus: approved ? "approved" : "rejected"
      }
    });

    return {
      id: updated.id,
      userId: updated.userId,
      businessName: updated.businessName,
      description: updated.description,
      categoryId: updated.categoryId,
      location: updated.location,
      contact: updated.contact,
      media: updated.media,
      customFields: updated.customFields,
      isApproved: updated.isApproved,
      ratingAvg: updated.ratingAvg ?? 0,
      ratingCount: updated.ratingCount ?? 0,
      subscriptionStatus: updated.subscriptionStatus,
      walletEnabled: updated.walletEnabled,
      onlinePaymentsEnabled: updated.onlinePaymentsEnabled,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    };
  }

  async listPublicProviders({
    page = 1,
    limit = 20,
    categoryId,
    q,
    city,
    region,
    country,
    lat,
    lng,
    radiusKm,
    minRating,
    countryId,
    cultureId,
    sort = "newest"
  }) {
    const normalizedPage = Math.max(1, Number(page) || 1);
    const normalizedLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (normalizedPage - 1) * normalizedLimit;
    void city;
    void region;
    void country;
    void lat;
    void lng;
    void radiusKm;

    const where = {
      isApproved: true,
      moderationStatus: "approved",
      ...(categoryId ? { categoryId } : {}),
      ...(audienceProviderWhere({ countryId, cultureId }) ?? {}),
      ...(minRating !== undefined ? { ratingAvg: { gte: Math.max(0, Math.min(5, Number(minRating) || 0)) } } : {}),
      ...(q
        ? {
            OR: [
              { businessName: { contains: String(q).trim() } },
              { description: { contains: String(q).trim() } }
            ]
          }
        : {})
    };

    const normalizedSort = String(sort ?? "newest").toLowerCase();
    const orderBy =
      normalizedSort === "top-rated" || normalizedSort === "top_rated" || normalizedSort === "toprated"
        ? [{ ratingAvg: "desc" }, { ratingCount: "desc" }, { createdAt: "desc" }]
        : normalizedSort === "random"
          ? [{ createdAt: "desc" }]
          : [{ createdAt: "desc" }];

    const [fetched, total, globalSettings] = await Promise.all([
      prisma.provider.findMany({ where, orderBy, skip, take: normalizedLimit }),
      prisma.provider.count({ where }),
      this.paymentService.getSettings()
    ]);
    // Providers that named the chosen country or culture come before those that serve everyone (stable within each group).
    let items = fetched;
    if (countryId || cultureId) {
      const matched = await this.audienceService.matchedProviderIds(fetched.map((p) => p.id), [countryId, cultureId]);
      items = [...fetched.filter((p) => matched.has(p.id)), ...fetched.filter((p) => !matched.has(p.id))];
    }

    return {
      items: items.map((p) => ({
        ...(() => {
          const effective = this.paymentService.computeEffectiveForProvider({ global: globalSettings, provider: p });
          const contactLocked = Boolean(effective.enableContactFee);
          return {
            contact: contactLocked ? this.redactContact(p.contact) : p.contact,
            location: contactLocked ? this.redactLocation(p.location) : p.location,
            contactLocked
          };
        })(),
        id: p.id,
        businessName: p.businessName,
        description: p.description,
        categoryId: p.categoryId,
        media: p.media,
        customFields: p.customFields,
        isApproved: p.isApproved,
        ratingAvg: p.ratingAvg ?? 0,
        ratingCount: p.ratingCount ?? 0,
        subscriptionStatus: p.subscriptionStatus,
        walletEnabled: p.walletEnabled,
        onlinePaymentsEnabled: p.onlinePaymentsEnabled,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      })),
      page: normalizedPage,
      limit: normalizedLimit,
      total
    };
  }

  async getProviderProfile({ providerId, includeUnapproved = false }) {
    const provider = await prisma.provider.findUnique({ where: { id: providerId } });
    if (!provider) {
      throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    }

    if (
      !includeUnapproved &&
      (!provider.isApproved || provider.moderationStatus !== "approved")
    ) {
      throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    }

    const effective = includeUnapproved ? null : await this.getEffectiveSettingsForProvider(provider);
    const contactLocked = Boolean(effective?.enableContactFee);

    // What the buyer gets by unlocking, without revealing it: which channels exist, and how many people
    // have already paid to unlock this provider.
    const rawContact = provider.contact ?? {};
    const rawLocation = provider.location ?? {};
    const hasPin = Array.isArray(rawLocation.geo?.coordinates) && rawLocation.geo.coordinates.length === 2;
    const [unlockCount, listingCount] = await Promise.all([
      prisma.contactUnlock.count({ where: { providerId: provider.id, paid: true } }),
      prisma.serviceProduct.count({ where: { providerId: provider.id, status: "approved" } })
    ]);

    return {
      id: provider.id,
      userId: provider.userId,
      businessName: provider.businessName,
      description: provider.description,
      categoryId: provider.categoryId,
      location: contactLocked ? this.redactLocation(provider.location) : provider.location,
      contact: contactLocked ? this.redactContact(provider.contact) : provider.contact,
      contactLocked,
      contactFee: effective ? (effective.contactFee?.toString?.() ?? "0.00") : null,
      contactAvailable: {
        phone: Boolean(rawContact.phone),
        whatsapp: Boolean(rawContact.whatsapp),
        email: Boolean(rawContact.email),
        website: Boolean(rawContact.website),
        address: Boolean(rawLocation.address),
        pin: hasPin
      },
      stats: { unlockCount, listingCount },
      audiences: await this.audienceService.forProvider(provider.id, { includePending: includeUnapproved }),
      media: provider.media,
      customFields: provider.customFields,
      isApproved: provider.isApproved,
      ratingAvg: provider.ratingAvg ?? 0,
      ratingCount: provider.ratingCount ?? 0,
      subscriptionStatus: provider.subscriptionStatus,
      walletEnabled: provider.walletEnabled,
      onlinePaymentsEnabled: provider.onlinePaymentsEnabled,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt
    };
  }

  async getProviderContactForUser({ actorUserId, providerId }) {
    if (!providerId) {
      throw new AppError({ message: "Invalid providerId", statusCode: 400, code: "INVALID_PROVIDER_ID" });
    }

    const provider = await prisma.provider.findUnique({ where: { id: providerId } });
    if (!provider || !provider.isApproved || provider.moderationStatus !== "approved") {
      throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    }

    const effective = await this.getEffectiveSettingsForProvider(provider);
    if (!effective.enableContactFee) {
      return { providerId: provider.id, unlocked: true, contact: provider.contact, location: provider.location };
    }

    const unlocked = await prisma.contactUnlock.findUnique({
      where: { userId_providerId: { userId: actorUserId, providerId } }
    });
    if (!unlocked?.paid) {
      throw new AppError({
        message: "Contact is locked",
        statusCode: 403,
        code: "CONTACT_LOCKED",
        details: { providerId: provider.id, fee: effective.contactFee?.toString?.() ?? "0.00" }
      });
    }

    return { providerId: provider.id, unlocked: true, contact: provider.contact, location: provider.location };
  }

  // Anonymous counterpart to getProviderContactForUser: no account to check "already unlocked"
  // against, so the caller instead proves payment by holding the ContactUnlock id it got back
  // from the original unlock request. Scoped to one provider per id+providerId pair, same as the
  // logged-in path — a proof for provider A can never reveal provider B's contact.
  async getUnlockedContactByProof({ providerId, unlockId }) {
    if (!providerId || !unlockId) {
      throw new AppError({ message: "Invalid request", statusCode: 400, code: "INVALID_REQUEST" });
    }

    const unlock = await prisma.contactUnlock.findFirst({ where: { id: unlockId, providerId, paid: true } });
    if (!unlock) {
      throw new AppError({ message: "Contact is locked", statusCode: 403, code: "CONTACT_LOCKED" });
    }

    const provider = await prisma.provider.findUnique({ where: { id: providerId } });
    if (!provider || !provider.isApproved || provider.moderationStatus !== "approved") {
      throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    }

    return { providerId: provider.id, unlocked: true, contact: provider.contact, location: provider.location };
  }
}
