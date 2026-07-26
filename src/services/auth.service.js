import { AppError } from "../utils/AppError.js";
import { prisma } from "../config/db.js";
import { env } from "../config/env.js";

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
      payload: { sub: user.id, role: user.role },
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
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      provider: provider ? { id: provider.id, userId: provider.userId } : null
    };
  }

  async loginWithGoogle({ idToken }) {
    if (!env.googleClientId) {
      throw new AppError({ message: "Google login is not configured", statusCode: 503, code: "GOOGLE_LOGIN_NOT_CONFIGURED" });
    }
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!response.ok) {
      throw new AppError({ message: "Invalid Google token", statusCode: 401, code: "INVALID_GOOGLE_TOKEN" });
    }
    const profile = await response.json();
    if (profile.aud !== env.googleClientId) {
      throw new AppError({ message: "Invalid Google audience", statusCode: 401, code: "INVALID_GOOGLE_AUDIENCE" });
    }
    if (!profile.email) {
      throw new AppError({ message: "Google email is required", statusCode: 400, code: "GOOGLE_EMAIL_REQUIRED" });
    }

    const email = this.normalizeEmail(profile.email);
    const googleSub = String(profile.sub);
    const existing = await prisma.user.findFirst({ where: { OR: [{ googleSub }, { email }] } });
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
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
      payload: { sub: user.id, role: user.role },
      secret: this.jwt.secret,
      issuer: this.jwt.issuer,
      ttlSeconds: this.jwt.accessTtlSeconds
    });

    const provider = user.role === "provider" ? await prisma.provider.findUnique({ where: { userId: user.id } }) : null;

    return {
      accessToken,
      user: this.userDto(user),
      provider: provider ? { id: provider.id, userId: provider.userId } : null
    };
  }

  async getMe({ actorUserId }) {
    const user = await prisma.user.findUnique({ where: { id: actorUserId } });
    if (!user) throw new AppError({ message: "User not found", statusCode: 404, code: "USER_NOT_FOUND" });
    const provider = user.role === "provider" ? await prisma.provider.findUnique({ where: { userId: user.id } }) : null;
    return { user: this.userDto(user), provider: provider ? { id: provider.id, userId: provider.userId } : null };
  }

  async updateMe({ actorUserId, patch }) {
    const update = {};
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.phone !== undefined) update.phone = this.normalizePhone(patch.phone);
    if (patch.profile !== undefined) update.profile = patch.profile ?? {};
    const user = await prisma.user.update({ where: { id: actorUserId }, data: update });
    return { user: this.userDto(user) };
  }

  async bootstrapAdmin({ name, email, phone, password }) {
    const existingAdmin = await prisma.user.findFirst({ where: { role: "admin" }, select: { id: true } });
    if (existingAdmin) {
      throw new AppError({ message: "Admin already exists", statusCode: 409, code: "ADMIN_EXISTS" });
    }

    const normalizedEmail = email ? this.normalizeEmail(email) : null;
    if (!normalizedEmail) {
      throw new AppError({ message: "Email is required", statusCode: 400, code: "EMAIL_REQUIRED" });
    }

    const passwordHash = await this.hashPassword(password);
    const created = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        phone: this.normalizePhone(phone),
        passwordHash,
        role: "admin",
        isActive: true,
        adminPermissions: ["*"]
      }
    });

    const accessToken = this.signAccessToken({
      payload: { sub: created.id, role: "admin" },
      secret: this.jwt.secret,
      issuer: this.jwt.issuer,
      ttlSeconds: this.jwt.accessTtlSeconds
    });

    const obj = created;
    return {
      accessToken,
      user: this.userDto(obj)
    };
  }

  userDto(user) {
    return {
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
  }
}
