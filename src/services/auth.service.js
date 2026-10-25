import { AppError } from "../utils/AppError.js";
import { prisma } from "../config/db.js";
import { env } from "../config/env.js";
import { verifyGoogleIdToken } from "../utils/googleAuth.js";
import { SYSTEM_ROLES } from "../constants/permissions.js";
import { forgetUserActive } from "../middlewares/auth.middleware.js";

const uniqueError = (e, field) => e?.code === "P2002" && Array.isArray(e?.meta?.target) && e.meta.target.includes(field);

export class AuthService {
  constructor({ hashPassword, verifyPassword, signAccessToken, jwt }) {
    this.hashPassword = hashPassword;
    this.verifyPassword = verifyPassword;
    this.signAccessToken = signAccessToken;
    this.jwt = jwt;
  }

  normalizeEmail(email) {
    return String(email ?? "").trim().toLowerCase();
  }

  normalizePhone(phone) {
    return String(phone ?? "").trim() || null;
  }

  async registerUser({ name, email, phone, password }) {
    const normalizedEmail = email ? this.normalizeEmail(email) : null;
    const normalizedPhone = phone ? this.normalizePhone(phone) : null;

    if (!normalizedEmail && !normalizedPhone) {
      throw new AppError({
        message: "Email or phone is required",
        statusCode: 400,
        code: "IDENTIFIER_REQUIRED"
      });
    }

    try {
      const passwordHash = await this.hashPassword(password);
      const created = await prisma.user.create({
        data: {
          name,
          email: normalizedEmail,
          phone: normalizedPhone,
          passwordHash,
          role: "user"
        }
      });

      const obj = created;
      return {
        user: {
          id: obj.id,
          name: obj.name,
          email: obj.email,
          role: obj.role,
          phone: obj.phone,
          createdAt: obj.createdAt,
          updatedAt: obj.updatedAt
        }
      };
    } catch (e) {
      if (uniqueError(e, "email")) {
        throw new AppError({ message: "Email already in use", statusCode: 409, code: "EMAIL_IN_USE" });
      }
      if (uniqueError(e, "phone")) {
        throw new AppError({ message: "Phone already in use", statusCode: 409, code: "PHONE_IN_USE" });
      }
      throw e;
    }
  }

  async registerProvider({
    name,
    email,
    phone,
    password,
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

    if (!normalizedEmail && !normalizedPhone) {
      throw new AppError({
        message: "Email or phone is required",
        statusCode: 400,
        code: "IDENTIFIER_REQUIRED"
      });
    }

    let createdUser;
    let createdProvider;
    try {
      const passwordHash = await this.hashPassword(password);

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
            description: description ?? "",
            categoryId: categoryId ?? null,
            location: location ?? {},
            contact: contact ?? {},
            media: media ?? {},
            customFields: customFields ?? {},
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

    return {
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
        description: createdProvider.description,
        categoryId: createdProvider.categoryId,
        location: createdProvider.location,
        contact: createdProvider.contact,
        media: createdProvider.media,
        customFields: createdProvider.customFields,
        isApproved: createdProvider.isApproved,
        subscriptionStatus: createdProvider.subscriptionStatus,
        walletEnabled: createdProvider.walletEnabled,
        createdAt: createdProvider.createdAt,
        updatedAt: createdProvider.updatedAt
      }
    };
  }

  async login({ email, phone, password }) {
    const normalizedEmail = email ? this.normalizeEmail(email) : null;
    const normalizedPhone = phone ? this.normalizePhone(phone) : null;

    if (!normalizedEmail && !normalizedPhone) {
      throw new AppError({
        message: "Email or phone is required",
        statusCode: 400,
        code: "IDENTIFIER_REQUIRED"
      });
    }

    const user = await prisma.user.findFirst({
      where: normalizedEmail ? { email: normalizedEmail } : { phone: normalizedPhone }
    });
    if (!user) {
      throw new AppError({ message: "Invalid credentials", statusCode: 401, code: "INVALID_CREDENTIALS" });
    }
    if (user.isActive === false) {
      throw new AppError({ message: "Account suspended", statusCode: 403, code: "ACCOUNT_SUSPENDED" });
    }

    const ok = await this.verifyPassword({ plain: password, hash: user.passwordHash });
    if (!ok) {
      throw new AppError({ message: "Invalid credentials", statusCode: 401, code: "INVALID_CREDENTIALS" });
    }

    const accessToken = this.signAccessToken({
      payload: { sub: user.id, role: user.role, roleId: user.role === "admin" ? user.adminRoleId : undefined },
      secret: this.jwt.secret,
      issuer: this.jwt.issuer,
      ttlSeconds: this.jwt.accessTtlSeconds
    });

    const provider =
      user.role === "provider"
        ? await prisma.provider.findUnique({ where: { userId: user.id } })
        : null;

    return {
      accessToken,
      user: await this.userDto(user),
      provider: provider ? { id: provider.id, userId: provider.userId } : null,
      busOperator: await this.busOperatorSummary(user)
    };
  }

  async loginWithGoogle({ idToken }) {
    if (!env.googleClientId) {
      throw new AppError({ message: "Google login is not configured", statusCode: 503, code: "GOOGLE_LOGIN_NOT_CONFIGURED" });
    }
    const profile = await verifyGoogleIdToken(idToken, env.googleClientId);

    const email = this.normalizeEmail(profile.email);
    const googleSub = String(profile.sub);
    const existing = await prisma.user.findFirst({ where: { OR: [{ googleSub }, { email }] } });
    if (existing && existing.isActive === false) {
      throw new AppError({ message: "This account has been suspended.", statusCode: 403, code: "ACCOUNT_INACTIVE" });
    }
    // Admin accounts sign in with their password only: an email match must never hand one over to a Google identity.
    if (existing && existing.role === "admin" && existing.googleSub !== googleSub) {
      throw new AppError({ message: "Admins sign in with email and password.", statusCode: 403, code: "ADMIN_PASSWORD_ONLY" });
    }
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            // Someone may have registered this email with a password before its owner ever signed in with Google
            // (the email was never verified then). Linking Google proves ownership, so that password is dropped.
            ...(existing.googleSub !== googleSub && existing.role === "user" && existing.passwordHash ? { passwordHash: "" } : {}),
            googleSub,
            authProvider: existing.authProvider === "password" ? "google" : existing.authProvider,
            avatarUrl: profile.picture ?? existing.avatarUrl,
            name: existing.name || profile.name || email
          }
        })
      : await prisma.user.create({
          data: {
            name: profile.name || email,
            email,
            passwordHash: "",
            role: "user",
            authProvider: "google",
            googleSub,
            avatarUrl: profile.picture ?? null,
            profile: { emailVerified: profile.email_verified === "true" || profile.email_verified === true }
          }
        });

    const accessToken = this.signAccessToken({
      payload: { sub: user.id, role: user.role, roleId: user.role === "admin" ? user.adminRoleId : undefined },
      secret: this.jwt.secret,
      issuer: this.jwt.issuer,
      ttlSeconds: this.jwt.accessTtlSeconds
    });

    const provider = user.role === "provider" ? await prisma.provider.findUnique({ where: { userId: user.id } }) : null;

    return {
      accessToken,
      user: await this.userDto(user),
      provider: provider ? { id: provider.id, userId: provider.userId } : null,
      busOperator: await this.busOperatorSummary(user),
      // True only on the sign-in that created the account, so the app can show its welcome form once.
      isNewUser: !existing
    };
  }

  async getMe({ actorUserId }) {
    const user = await prisma.user.findUnique({ where: { id: actorUserId } });
    if (!user) throw new AppError({ message: "User not found", statusCode: 404, code: "USER_NOT_FOUND" });
    const provider = user.role === "provider" ? await prisma.provider.findUnique({ where: { userId: user.id } }) : null;
    return {
      user: await this.userDto(user),
      provider: provider ? { id: provider.id, userId: provider.userId } : null,
      busOperator: await this.busOperatorSummary(user)
    };
  }

  async updateMe({ actorUserId, patch }) {
    const update = {};
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.phone !== undefined) update.phone = this.normalizePhone(patch.phone);
    if (patch.avatarUrl !== undefined) update.avatarUrl = patch.avatarUrl;
    if (patch.profile !== undefined) {
      // Merge rather than replace: the profile also holds things the client never sees (e.g. the
      // email-verified flag), which a partial update must not wipe.
      const existing = await prisma.user.findUnique({ where: { id: actorUserId }, select: { profile: true } });
      const { onboarded, ...rest } = patch.profile ?? {};
      update.profile = { ...(existing?.profile ?? {}), ...rest, ...(onboarded ? { onboardedAt: new Date().toISOString() } : {}) };
    }
    const user = await prisma.user.update({ where: { id: actorUserId }, data: update });
    return { user: await this.userDto(user) };
  }


  // Account deletion (required by Google Play). The account is anonymised rather than erased: orders, payments,
  // tickets and wallet history that other people (providers, bus operators, the platform's books) still rely on are
  // kept, but they no longer point to a name, email, phone or sign-in. Sign-in stops working straight away.
  async deleteMe({ actorUserId, password, confirm }) {
    const user = await prisma.user.findUnique({ where: { id: actorUserId } });
    if (!user) throw new AppError({ message: "User not found", statusCode: 404, code: "USER_NOT_FOUND" });
    if (user.role !== "user" && user.role !== "provider") {
      throw new AppError({
        message: "Driver, bus operator and admin accounts are removed by our team. Please contact support to delete this account.",
        statusCode: 403,
        code: "DELETE_VIA_SUPPORT"
      });
    }
    if (String(confirm ?? "").trim().toUpperCase() !== "DELETE") {
      throw new AppError({ message: "Type DELETE to confirm.", statusCode: 400, code: "CONFIRMATION_REQUIRED" });
    }
    if (user.authProvider === "password" && user.passwordHash) {
      const ok = password ? await this.verifyPassword({ plain: password, hash: user.passwordHash }) : false;
      if (!ok) throw new AppError({ message: "Your password is not correct.", statusCode: 400, code: "INVALID_PASSWORD" });
    }

    const blocked = (message, code) => new AppError({ message, statusCode: 409, code });
    const now = new Date();
    const provider = user.role === "provider" ? await prisma.provider.findUnique({ where: { userId: user.id }, include: { wallets: true } }) : null;

    const openRide = await prisma.rideTrip.count({ where: { riderId: user.id, status: { in: ["searching", "matched", "arrived", "in_progress"] } } });
    if (openRide) throw blocked("You have a ride in progress. Finish or cancel it first.", "DELETE_BLOCKED_RIDE");
    const tickets = await prisma.busBooking.count({ where: { userId: user.id, status: "confirmed", trip: { departureAt: { gt: now } } } });
    if (tickets) throw blocked("You have bus tickets for upcoming trips. Cancel them or travel first.", "DELETE_BLOCKED_TICKETS");
    const openOrders = await prisma.order.count({ where: { userId: user.id, status: { in: ["pending", "confirmed", "shipped"] } } });
    if (openOrders) throw blocked("You have orders that are not delivered yet. Wait until they are completed or cancel them.", "DELETE_BLOCKED_ORDERS");
    const openBookings = await prisma.serviceBooking.count({ where: { userId: user.id, status: { in: ["pending", "confirmed"] } } });
    if (openBookings) throw blocked("You have service bookings that are still open. Cancel them or wait until they are done.", "DELETE_BLOCKED_BOOKINGS");

    if (provider) {
      const balance = Number(provider.wallets?.balance ?? 0);
      if (balance > 0) throw blocked("Withdraw your wallet balance before deleting the account.", "DELETE_BLOCKED_BALANCE");
      const pendingPayouts = await prisma.withdrawalRequest.count({ where: { providerId: provider.id, status: { in: ["requested", "approved"] } } });
      if (pendingPayouts) throw blocked("You have a withdrawal that is still being processed.", "DELETE_BLOCKED_PAYOUT");
      const incomingOrders = await prisma.order.count({ where: { providerId: provider.id, status: { in: ["pending", "confirmed", "shipped"] } } });
      if (incomingOrders) throw blocked("You have customer orders that are not completed yet.", "DELETE_BLOCKED_CUSTOMER_ORDERS");
      const incomingBookings = await prisma.serviceBooking.count({ where: { providerId: provider.id, status: { in: ["pending", "confirmed"] } } });
      if (incomingBookings) throw blocked("You have customer bookings that are still open.", "DELETE_BLOCKED_CUSTOMER_BOOKINGS");
    }

    // The provider's listings: remove them, or (when an old order still points at one) blank and hide them.
    if (provider) {
      const listings = await prisma.serviceProduct.findMany({ where: { providerId: provider.id }, select: { id: true } });
      for (const listing of listings) {
        try {
          await prisma.serviceProduct.delete({ where: { id: listing.id } });
        } catch {
          await prisma.serviceProduct.update({
            where: { id: listing.id },
            data: { status: "suspended", name: "Removed item", description: "", media: {}, customFields: {}, featured: false, sku: null }
          });
        }
      }
    }

    const gone = "Deleted user";
    await prisma.$transaction(async (tx) => {
      if (provider) {
        await tx.mediaAsset.deleteMany({ where: { providerId: provider.id } });
        await tx.promotion.deleteMany({ where: { providerId: provider.id } });
        await tx.favorite.deleteMany({ where: { providerId: provider.id } });
        await tx.provider.update({
          where: { id: provider.id },
          data: {
            businessName: "Deleted business", description: "", contact: {}, media: {}, customFields: {}, location: {}, availability: {}, verification: {},
            lat: null, lng: null, geohash5: null, geohash6: null, district: null, publicSlug: null,
            isApproved: false, moderationStatus: "suspended", onlinePaymentsEnabled: false
          }
        });
      }
      await tx.mediaAsset.deleteMany({ where: { ownerId: user.id } });
      await tx.favorite.deleteMany({ where: { userId: user.id } });
      await tx.contactUnlock.deleteMany({ where: { userId: user.id } });
      await tx.interestEvent.deleteMany({ where: { userId: user.id } });
      await tx.searchEvent.deleteMany({ where: { userId: user.id } });
      await tx.profileVisit.updateMany({ where: { userId: user.id }, data: { userId: null, userAgent: null } });
      await tx.contactEvent.updateMany({ where: { userId: user.id }, data: { userId: null } });
      await tx.inquiry.updateMany({ where: { userId: user.id }, data: { name: gone, email: null, phone: null } });
      await tx.order.updateMany({ where: { userId: user.id }, data: { customer: { name: gone } } });
      await tx.serviceBooking.updateMany({ where: { userId: user.id }, data: { customer: { name: gone } } });
      await tx.busBooking.updateMany({ where: { userId: user.id }, data: { passengerName: gone, passengerPhone: "", passengerEmail: null, payPhone: null } });
      await tx.rideTrip.updateMany({ where: { riderId: user.id }, data: { pickupAddress: "", dropoffAddress: "" } });
      await tx.user.update({
        where: { id: user.id },
        data: {
          name: gone, email: null, phone: null, passwordHash: "", googleSub: null, authProvider: "deleted", avatarUrl: null,
          profile: { deletedAt: now.toISOString() }, isActive: false
        }
      });
      await tx.auditLog.create({ data: { actorId: user.id, action: "account.deleted", entity: "user", entityId: user.id, metadata: { role: user.role } } });
    });
    forgetUserActive(user.id);
    return { deleted: true };
  }

  async ensureSuperAdminRole() {
    const superAdmin = SYSTEM_ROLES.find((r) => r.key === "super_admin");
    return prisma.adminRole.upsert({ where: { key: superAdmin.key }, create: superAdmin, update: {} });
  }

  // Admin-only fields (roleId/roleName/permissions) let the admin_ui restrict its own nav and
  // views to what this admin can actually do - "*" (Super Admin) means every permission.
  async busOperatorSummary(user) {
    if (user.role !== "bus_operator") return null;
    const operator = await prisma.busOperator.findUnique({ where: { userId: user.id } });
    return operator
      ? { id: operator.id, userId: operator.userId, slug: operator.slug, companyName: operator.companyName, onboardingStatus: operator.onboardingStatus, status: operator.status }
      : null;
  }

  async userDto(user) {
    const base = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      authProvider: user.authProvider,
      avatarUrl: user.avatarUrl,
      profile: user.profile ?? {},
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
    if (user.role !== "admin") return base;

    const adminRole = user.adminRoleId ? await prisma.adminRole.findUnique({ where: { id: user.adminRoleId } }) : null;
    return {
      ...base,
      roleId: adminRole?.id ?? null,
      roleName: adminRole?.name ?? null,
      permissions: Array.isArray(adminRole?.permissions) ? adminRole.permissions : []
    };
  }
}
