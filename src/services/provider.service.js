import crypto from "crypto";
import jwt from "jsonwebtoken";

import { AppError } from "../utils/AppError.js";
import { prisma } from "../config/db.js";
import { PaymentService } from "./payment.service.js";
import { env } from "../config/env.js";

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

  signOnboardingToken({ userId, providerId }) {
    return jwt.sign(
      { sub: String(userId), providerId: String(providerId), purpose: "provider_onboarding" },
      env.jwtSecret,
      { issuer: env.jwtIssuer, expiresIn: "7d" }
    );
  }

  onboardingUrl(token) {
    const base = env.providerOnboardingBaseUrl || `${env.appBaseUrl.replace(/\/$/, "")}/provider/onboarding`;
    return `${base.replace(/\/$/, "")}?token=${encodeURIComponent(token)}`;
  }

  async sendInvitationEmail({ to, businessName, token }) {
    if (!env.resendApiKey || !env.resendFromEmail) {
      return { sent: false, deliveryStatus: "not_configured" };
    }
    const link = this.onboardingUrl(token);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: env.resendFromEmail,
        to,
        subject: `Complete your Sidra provider profile`,
        html: `<p>Hello,</p><p>You have been invited to complete the provider profile for <strong>${businessName}</strong> on Sidra.</p><p><a href="${link}">Complete registration</a></p>`
      })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { sent: false, deliveryStatus: "failed", providerResponse: body };
    return { sent: true, deliveryStatus: "sent", providerResponse: body };
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
      onboardingToken,
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
    await prisma.provider.update({ where: { id: provider.id }, data: { onboardingStatus: "invitation_sent", invitationSentAt: now } });
    return { onboardingToken: token, invitationId: invitation.id, delivery: emailDelivery };
  }

  async getOnboardingInfo({ token }) {
    const payload = this.verifyOnboardingToken(token);
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
        ratingAvg: provider.ratingAvg ?? 0,
        ratingCount: provider.ratingCount ?? 0,
        subscriptionStatus: provider.subscriptionStatus,
        walletEnabled: provider.walletEnabled,
        createdAt: provider.createdAt,
        updatedAt: provider.updatedAt
      }
    };
  }

  async completeOnboarding({ token, password, profile }) {
    const payload = this.verifyOnboardingToken(token);
    const provider = await prisma.provider.findUnique({ where: { id: String(payload.providerId) } });
    if (!provider) {
      throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    }

    const passwordHash = await this.hashPassword(password);
    await prisma.user.update({ where: { id: provider.userId }, data: { passwordHash } });

    const data = {};
    if (profile?.businessName !== undefined) data.businessName = profile.businessName;
    if (profile?.description !== undefined) data.description = profile.description ?? "";
    if (profile?.categoryId !== undefined) data.categoryId = profile.categoryId ?? null;
    if (profile?.location !== undefined) data.location = profile.location ?? {};
    if (profile?.contact !== undefined) data.contact = profile.contact ?? {};
    if (profile?.media !== undefined) data.media = profile.media ?? {};
    if (profile?.customFields !== undefined) data.customFields = profile.customFields ?? {};
    data.onboardingStatus = "registered";
    data.registeredAt = new Date();
    data.invitationAcceptedAt = new Date();

    if (Object.keys(data).length) {
      await prisma.provider.update({ where: { id: provider.id }, data });
    }
    await prisma.providerInvitation.updateMany({
      where: { providerId: provider.id, tokenHash: tokenHash(token), status: "sent" },
      data: { status: "accepted", acceptedAt: new Date() }
    });

    return this.getProviderProfile({ providerId: provider.id, includeUnapproved: true });
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
    if (updates.location !== undefined) data.location = updates.location ?? {};
    if (updates.contact !== undefined) data.contact = updates.contact ?? {};
    if (updates.media !== undefined) data.media = updates.media ?? {};
    if (updates.customFields !== undefined) data.customFields = updates.customFields ?? {};

    if (Object.keys(data).length) {
      await prisma.provider.update({ where: { id: provider.id }, data });
    }

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

    const [items, total, globalSettings] = await Promise.all([
      prisma.provider.findMany({ where, orderBy, skip, take: normalizedLimit }),
      prisma.provider.count({ where }),
      this.paymentService.getSettings()
    ]);

    return {
      items: items.map((p) => ({
        ...(() => {
          const effective = this.paymentService.computeEffectiveForProvider({ global: globalSettings, provider: p });
          const contactLocked = Boolean(effective.enableContactFee);
          return {
            contact: contactLocked ? this.redactContact(p.contact) : p.contact,
            contactLocked
          };
        })(),
        id: p.id,
        businessName: p.businessName,
        description: p.description,
        categoryId: p.categoryId,
        location: p.location,
        media: p.media,
        customFields: p.customFields,
        isApproved: p.isApproved,
        ratingAvg: p.ratingAvg ?? 0,
        ratingCount: p.ratingCount ?? 0,
        subscriptionStatus: p.subscriptionStatus,
        walletEnabled: p.walletEnabled,
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

    return {
      id: provider.id,
      userId: provider.userId,
      businessName: provider.businessName,
      description: provider.description,
      categoryId: provider.categoryId,
      location: provider.location,
      contact: contactLocked ? this.redactContact(provider.contact) : provider.contact,
      contactLocked,
      media: provider.media,
      customFields: provider.customFields,
      isApproved: provider.isApproved,
      ratingAvg: provider.ratingAvg ?? 0,
      ratingCount: provider.ratingCount ?? 0,
      subscriptionStatus: provider.subscriptionStatus,
      walletEnabled: provider.walletEnabled,
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
      return { providerId: provider.id, unlocked: true, contact: provider.contact };
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

    return { providerId: provider.id, unlocked: true, contact: provider.contact };
  }
}
