import crypto from "crypto";
import jwt from "jsonwebtoken";

import { AppError } from "../utils/AppError.js";
import { prisma } from "../config/db.js";
import { env } from "../config/env.js";
import { sendMail } from "../emails/mailer.js";
import { adminInvite as adminInviteEmail } from "../emails/templates.js";

const tokenHash = (token) => crypto.createHash("sha256").update(token).digest("hex");
const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Email-invite admin account creation, modeled directly on ProviderService's onboarding-invite
// flow (same signed-JWT-token + tokenHash-in-DB shape, same best-effort Resend email pattern).
export class AdminInviteService {
  constructor({ hashPassword, signAccessToken, jwt: jwtConfig }) {
    this.hashPassword = hashPassword;
    this.signAccessToken = signAccessToken;
    this.jwtConfig = jwtConfig;
  }

  normalizeEmail(email) {
    return String(email ?? "").trim().toLowerCase();
  }

  signInviteToken({ email, roleId }) {
    return jwt.sign({ email, roleId, purpose: "admin_invite" }, env.jwtSecret, {
      issuer: env.jwtIssuer,
      expiresIn: "7d"
    });
  }

  verifyInviteToken(token) {
    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret, { issuer: env.jwtIssuer });
    } catch {
      throw new AppError({ message: "Invite link is invalid or has expired", statusCode: 410, code: "INVITE_TOKEN_INVALID" });
    }
    if (payload.purpose !== "admin_invite") {
      throw new AppError({ message: "Invite link is invalid", statusCode: 400, code: "INVITE_TOKEN_INVALID" });
    }
    return payload;
  }

  inviteUrl(token) {
    const base = env.adminInviteBaseUrl || `${env.appBaseUrl.replace(/\/$/, "")}/accept-invite`;
    return `${base.replace(/\/$/, "")}?token=${encodeURIComponent(token)}`;
  }

  async sendInviteEmail({ to, name, roleName, token }) {
    return sendMail({ to, email: adminInviteEmail({ name, roleName, link: this.inviteUrl(token) }) });
  }

  async createInvite({ name, email, roleId, invitedById }) {
    const normalizedEmail = this.normalizeEmail(email);
    const role = await prisma.adminRole.findUnique({ where: { id: roleId } });
    if (!role) throw new AppError({ message: "Role not found", statusCode: 404, code: "ROLE_NOT_FOUND" });

    const existingUser = await prisma.user.findFirst({ where: { email: normalizedEmail }, select: { id: true } });
    if (existingUser) throw new AppError({ message: "Email already in use", statusCode: 409, code: "EMAIL_IN_USE" });

    const pendingInvite = await prisma.adminInvite.findFirst({
      where: { email: normalizedEmail, status: "sent", expiresAt: { gt: new Date() } }
    });
    if (pendingInvite) throw new AppError({ message: "An invite is already pending for this email", statusCode: 409, code: "INVITE_ALREADY_SENT" });

    const token = this.signInviteToken({ email: normalizedEmail, roleId });
    const now = new Date();
    const delivery = await this.sendInviteEmail({ to: normalizedEmail, name, roleName: role.name, token });

    const invite = await prisma.adminInvite.create({
      data: {
        email: normalizedEmail,
        name,
        roleId,
        roleName: role.name,
        tokenHash: tokenHash(token),
        status: "sent",
        invitedById,
        sentAt: now,
        lastSentAt: now,
        expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
        metadata: { deliveryProvider: "resend", ...delivery }
      }
    });

    await prisma.auditLog.create({
      data: { actorId: invitedById ?? null, action: "admin.invite.create", entity: "AdminInvite", entityId: invite.id, metadata: { email: normalizedEmail, roleId } }
    });

    return { ...this.toDto(invite, role), ...(delivery.sent ? {} : { inviteUrl: this.inviteUrl(token) }) };
  }

  async resendInvite({ inviteId, actorId }) {
    const invite = await prisma.adminInvite.findUnique({ where: { id: inviteId }, include: { role: true } });
    if (!invite) throw new AppError({ message: "Invite not found", statusCode: 404, code: "INVITE_NOT_FOUND" });
    if (invite.status !== "sent") throw new AppError({ message: "Only a pending invite can be resent", statusCode: 409, code: "INVITE_NOT_PENDING" });

    const token = this.signInviteToken({ email: invite.email, roleId: invite.roleId });
    const now = new Date();
    const delivery = await this.sendInviteEmail({ to: invite.email, name: invite.name, roleName: invite.role.name, token });

    const updated = await prisma.adminInvite.update({
      where: { id: invite.id },
      data: {
        tokenHash: tokenHash(token),
        resentCount: { increment: 1 },
        lastSentAt: now,
        expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
        metadata: { deliveryProvider: "resend", ...delivery }
      },
      include: { role: true }
    });

    await prisma.auditLog.create({
      data: { actorId: actorId ?? null, action: "admin.invite.resend", entity: "AdminInvite", entityId: invite.id, metadata: { email: invite.email } }
    });

    return { ...this.toDto(updated, updated.role), ...(delivery.sent ? {} : { inviteUrl: this.inviteUrl(token) }) };
  }

  async revokeInvite({ inviteId, actorId }) {
    const invite = await prisma.adminInvite.findUnique({ where: { id: inviteId } });
    if (!invite) throw new AppError({ message: "Invite not found", statusCode: 404, code: "INVITE_NOT_FOUND" });
    const updated = await prisma.adminInvite.update({ where: { id: inviteId }, data: { status: "revoked", revokedAt: new Date() }, include: { role: true } });
    await prisma.auditLog.create({
      data: { actorId: actorId ?? null, action: "admin.invite.revoke", entity: "AdminInvite", entityId: invite.id, metadata: { email: invite.email } }
    });
    return this.toDto(updated, updated.role);
  }

  async listInvites() {
    const invites = await prisma.adminInvite.findMany({ where: { status: { in: ["sent", "revoked"] } }, orderBy: { createdAt: "desc" }, include: { role: true } });
    return { items: invites.map((i) => this.toDto(i, i.role)) };
  }

  async getInviteInfo({ token }) {
    this.verifyInviteToken(token);
    const invite = await prisma.adminInvite.findFirst({ where: { tokenHash: tokenHash(token) }, include: { role: true } });
    if (!invite || invite.status !== "sent") {
      throw new AppError({ message: "Invite link is invalid or has already been used", statusCode: 410, code: "INVITE_NOT_FOUND" });
    }
    if (invite.expiresAt < new Date()) {
      throw new AppError({ message: "Invite link has expired", statusCode: 410, code: "INVITE_EXPIRED" });
    }
    return { name: invite.name, email: invite.email, roleName: invite.role.name, expiresAt: invite.expiresAt };
  }

  async acceptInvite({ token, password }) {
    this.verifyInviteToken(token);
    const invite = await prisma.adminInvite.findFirst({ where: { tokenHash: tokenHash(token) }, include: { role: true } });
    if (!invite || invite.status !== "sent") {
      throw new AppError({ message: "Invite link is invalid or has already been used", statusCode: 410, code: "INVITE_NOT_FOUND" });
    }
    if (invite.expiresAt < new Date()) {
      throw new AppError({ message: "Invite link has expired", statusCode: 410, code: "INVITE_EXPIRED" });
    }

    const existingUser = await prisma.user.findFirst({ where: { email: invite.email }, select: { id: true } });
    if (existingUser) throw new AppError({ message: "This account has already been created", statusCode: 409, code: "EMAIL_IN_USE" });

    const passwordHash = await this.hashPassword(password);
    const { user } = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: invite.name,
          email: invite.email,
          passwordHash,
          role: "admin",
          isActive: true,
          adminRoleId: invite.roleId
        }
      });
      await tx.adminInvite.update({ where: { id: invite.id }, data: { status: "accepted", acceptedAt: new Date() } });
      return { user: created };
    });

    await prisma.auditLog.create({
      data: { actorId: user.id, action: "admin.invite.accept", entity: "User", entityId: user.id, metadata: { email: invite.email, roleId: invite.roleId } }
    });

    const accessToken = this.signAccessToken({
      payload: { sub: user.id, role: "admin", roleId: invite.roleId },
      secret: this.jwtConfig.secret,
      issuer: this.jwtConfig.issuer,
      ttlSeconds: this.jwtConfig.accessTtlSeconds
    });

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        roleId: invite.roleId,
        roleName: invite.role.name,
        permissions: Array.isArray(invite.role.permissions) ? invite.role.permissions : []
      }
    };
  }

  toDto(invite, role) {
    return {
      id: invite.id,
      name: invite.name,
      email: invite.email,
      roleId: invite.roleId,
      roleName: role?.name ?? invite.roleName ?? null,
      status: invite.status,
      resentCount: invite.resentCount,
      sentAt: invite.sentAt,
      lastSentAt: invite.lastSentAt,
      acceptedAt: invite.acceptedAt,
      revokedAt: invite.revokedAt,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt
    };
  }
}
