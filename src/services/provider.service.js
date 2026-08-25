import crypto from "crypto";
import jwt from "jsonwebtoken";

import { AppError } from "../utils/AppError.js";
import { prisma } from "../config/db.js";
import { PaymentService } from "./payment.service.js";
import { env } from "../config/env.js";
import { verifyGoogleIdToken } from "../utils/googleAuth.js";

const uniqueError = (e, field) => e?.code === "P2002" && Array.isArray(e?.meta?.target) && e.meta.target.includes(field);
const safeSlug = (value) =>
  String(value ?? "provider")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "provider";
const tokenHash = (token) => crypto.createHash("sha256").update(token).digest("hex");
const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

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

  redactLocation(location) {
    return {
      address: null,
      city: location?.city ?? null,
      region: location?.region ?? null,
      country: location?.country ?? null,
      geo: null
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
    const safeBusinessName = escapeHtml(businessName);
    const safeLink = escapeHtml(link);
    const assetBase = String(env.emailAssetBaseUrl || "").replace(/\/$/, "");
    const heroUrl = escapeHtml(`${assetBase}/gabla-provider-welcome.png`);
    const subject = `You're invited to bring ${businessName} to Gabla`;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: env.resendFromEmail,
        to,
        subject,
        text: `Welcome to Gabla. You have been invited to complete the provider profile for ${businessName}. Complete your registration within 7 days: ${link}`,
        html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#F2F5F9;font-family:Arial,Helvetica,sans-serif;color:#0F172A;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Complete your Gabla provider profile and get ready to be discovered.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F2F5F9;">
      <tr>
        <td align="center" style="padding:28px 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;">
            <tr><td style="height:8px;background:#FACC15;font-size:0;line-height:0;">&nbsp;</td></tr>
            <tr>
              <td align="center" style="padding:30px 32px 8px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="center" valign="middle" style="width:42px;height:42px;background:#FACC15;border-radius:8px;color:#0B2046;font-size:25px;font-weight:800;">G</td>
                    <td style="padding-left:12px;color:#0B2046;font-size:25px;font-weight:800;letter-spacing:0;">Gabla</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 32px 0;">
                <img src="${heroUrl}" width="360" alt="Welcome to Gabla" style="display:block;width:100%;max-width:360px;height:auto;border:0;">
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:4px 40px 12px;">
                <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:#E8F7F4;color:#087F70;font-size:12px;font-weight:700;text-transform:uppercase;">Provider invitation</div>
                <h1 style="margin:18px 0 10px;color:#0B2046;font-size:30px;line-height:1.2;font-weight:800;letter-spacing:0;">Your Gabla profile is waiting</h1>
                <p style="margin:0;color:#526174;font-size:16px;line-height:1.65;">You have been invited to complete the service provider profile for <strong style="color:#0F172A;">${safeBusinessName}</strong>. Add your business details so customers can discover and contact you on Gabla.</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:16px 40px 30px;">
                <a href="${safeLink}" style="display:inline-block;background:#0B2046;color:#FFFFFF;text-decoration:none;font-size:16px;font-weight:700;line-height:1;padding:16px 26px;border-radius:7px;">Complete registration&nbsp;&nbsp;&rarr;</a>
                <p style="margin:14px 0 0;color:#8491A3;font-size:12px;line-height:1.5;">This secure invitation expires in 7 days.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px;"><div style="height:1px;background:#E2E8F0;font-size:0;">&nbsp;</div></td>
            </tr>
            <tr>
              <td style="padding:28px 40px 30px;">
                <h2 style="margin:0 0 20px;color:#0F172A;font-size:19px;line-height:1.3;text-align:center;">What happens next?</h2>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td valign="top" style="width:42px;padding-bottom:18px;"><div style="width:34px;height:34px;border-radius:7px;background:#FFF4B8;color:#0B2046;text-align:center;line-height:34px;font-weight:800;">1</div></td>
                    <td valign="top" style="padding:1px 0 18px 12px;"><strong style="display:block;color:#0F172A;font-size:14px;">Create your password</strong><span style="display:block;margin-top:4px;color:#64748B;font-size:13px;line-height:1.5;">Secure your provider account and confirm your contact details.</span></td>
                  </tr>
                  <tr>
                    <td valign="top" style="width:42px;padding-bottom:18px;"><div style="width:34px;height:34px;border-radius:7px;background:#DFF5F1;color:#087F70;text-align:center;line-height:34px;font-weight:800;">2</div></td>
                    <td valign="top" style="padding:1px 0 18px 12px;"><strong style="display:block;color:#0F172A;font-size:14px;">Complete your business profile</strong><span style="display:block;margin-top:4px;color:#64748B;font-size:13px;line-height:1.5;">Add your location, services, photos and the details customers need.</span></td>
                  </tr>
                  <tr>
                    <td valign="top" style="width:42px;"><div style="width:34px;height:34px;border-radius:7px;background:#E6EEF9;color:#0B2046;text-align:center;line-height:34px;font-weight:800;">3</div></td>
                    <td valign="top" style="padding:1px 0 0 12px;"><strong style="display:block;color:#0F172A;font-size:14px;">Get reviewed and go live</strong><span style="display:block;margin-top:4px;color:#64748B;font-size:13px;line-height:1.5;">Gabla reviews your profile before it appears to customers.</span></td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 32px;background:#0B2046;">
                <p style="margin:0;color:#FFFFFF;font-size:15px;font-weight:700;">Gabla</p>
                <p style="margin:7px 0 0;color:#AFC0D9;font-size:12px;line-height:1.6;">Helping people discover trusted services across Uganda.</p>
                <p style="margin:12px 0 0;color:#8298B7;font-size:11px;line-height:1.5;">If you were not expecting this invitation, you can safely ignore this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
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
    await prisma.provider.update({ where: { id: provider.id }, data: { onboardingStatus: "invitation_sent", invitationSentAt: now } });
    return { onboardingToken: token, invitationId: invitation.id, delivery: emailDelivery };
  }

  async sendLinkGoogleEmail({ to, businessName, token }) {
    if (!env.resendApiKey || !env.resendFromEmail) {
      return { sent: false, deliveryStatus: "not_configured" };
    }
    const link = this.onboardingUrl(token);
    const safeBusinessName = escapeHtml(businessName);
    const safeLink = escapeHtml(link);
    const subject = `Reconnect Google sign-in for ${businessName}`;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: env.resendFromEmail,
        to,
        subject,
        text: `Sign in with Google to reconnect your Gabla provider profile for ${businessName} and see your dashboard, wallet, and orders again: ${link}`,
        html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#F2F5F9;font-family:Arial,Helvetica,sans-serif;color:#0F172A;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F2F5F9;">
      <tr>
        <td align="center" style="padding:28px 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;">
            <tr><td style="height:8px;background:#FACC15;font-size:0;line-height:0;">&nbsp;</td></tr>
            <tr>
              <td align="center" style="padding:30px 32px 8px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="center" valign="middle" style="width:42px;height:42px;background:#FACC15;border-radius:8px;color:#0B2046;font-size:25px;font-weight:800;">G</td>
                    <td style="padding-left:12px;color:#0B2046;font-size:25px;font-weight:800;">Gabla</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:20px 40px 8px;">
                <h1 style="margin:0 0 10px;color:#0B2046;font-size:24px;line-height:1.3;font-weight:800;">Reconnect your Google sign-in</h1>
                <p style="margin:0;color:#526174;font-size:15px;line-height:1.65;">Sign in with Google to reconnect your provider profile for <strong style="color:#0F172A;">${safeBusinessName}</strong> and get back to your dashboard, wallet, and orders.</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:20px 40px 34px;">
                <a href="${safeLink}" style="display:inline-block;background:#0B2046;color:#FFFFFF;text-decoration:none;font-size:16px;font-weight:700;line-height:1;padding:16px 26px;border-radius:7px;">Continue with Google&nbsp;&nbsp;&rarr;</a>
                <p style="margin:14px 0 0;color:#8491A3;font-size:12px;line-height:1.5;">This secure link expires in 7 days. If you didn't request this, you can safely ignore this email.</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:20px 32px;background:#0B2046;">
                <p style="margin:0;color:#FFFFFF;font-size:14px;font-weight:700;">Gabla</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
      })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { sent: false, deliveryStatus: "failed", providerResponse: body };
    return { sent: true, deliveryStatus: "sent", providerResponse: body };
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
    const token = this.signOnboardingToken({ userId: user.id, providerId: provider.id });
    const delivery = await this.sendLinkGoogleEmail({ to: user.email, businessName: provider.businessName, token });
    return { onboardingToken: token, delivery };
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
          const token = this.signOnboardingToken({ userId: user.id, providerId: provider.id });
          await this.sendLinkGoogleEmail({ to: user.email, businessName: provider.businessName, token });
        }
      }
    }
    return { requested: true };
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
    const provider = await prisma.provider.findUnique({ where: { id: String(payload.providerId) } });
    if (!provider) {
      throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    }

    // Providers now authenticate with Google, so a typed password is no longer collected here.
    // A random one still backs the account in case password login is ever needed later.
    const passwordHash = await this.hashPassword(password || crypto.randomBytes(32).toString("hex"));
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
    data.isApproved = true;
    data.moderationStatus = "approved";

    if (Object.keys(data).length) {
      await prisma.provider.update({ where: { id: provider.id }, data });
    }
    await prisma.providerInvitation.updateMany({
      where: { providerId: provider.id, tokenHash: tokenHash(token), status: "sent" },
      data: { status: "accepted", acceptedAt: new Date() }
    });

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

    const accessToken = jwt.sign(
      { sub: updatedUser.id, role: updatedUser.role },
      env.jwtSecret,
      { issuer: env.jwtIssuer, expiresIn: env.jwtAccessTtlSeconds }
    );

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
    if (updates.location !== undefined) data.location = updates.location ?? {};
    if (updates.contact !== undefined) data.contact = updates.contact ?? {};
    if (updates.media !== undefined) data.media = updates.media ?? {};
    if (updates.customFields !== undefined) data.customFields = updates.customFields ?? {};
    if (updates.onlinePaymentsEnabled !== undefined) data.onlinePaymentsEnabled = Boolean(updates.onlinePaymentsEnabled);

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
}
