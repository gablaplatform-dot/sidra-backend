import { AppError } from "../utils/AppError.js";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/db.js";

const toDecimalOrNull = (value) => {
  if (value === null || value === undefined) return null;
  if (value instanceof Prisma.Decimal) return value;
  const str = typeof value === "number" ? value.toFixed(2) : String(value).trim();
  if (!str || Number.isNaN(Number(str))) {
    throw new AppError({ message: "Invalid amount", statusCode: 400, code: "INVALID_AMOUNT" });
  }
  return new Prisma.Decimal(str);
};

const toBoolOrNull = (value) => {
  if (value === null || value === undefined) return null;
  return Boolean(value);
};

const toNumberOrNull = (value) => {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new AppError({ message: "Invalid number", statusCode: 400, code: "INVALID_NUMBER" });
  }
  return n;
};

const decimalToStringOrNull = (v) => (v ? v.toString() : null);

export class AdminSettingsService {
  async getGlobal() {
    const doc = await prisma.adminSettings.findFirst({ orderBy: { createdAt: "desc" } });
    if (doc) return this.toGlobalDto(doc);
    const created = await prisma.adminSettings.create({ data: {} });
    return this.toGlobalDto(created);
  }

  async updateGlobal(patch) {
    const update = {};
    if (patch.enableSubscription !== undefined) update.enableSubscription = Boolean(patch.enableSubscription);
    if (patch.enableContactFee !== undefined) update.enableContactFee = Boolean(patch.enableContactFee);
    if (patch.enableWallet !== undefined) update.enableWallet = Boolean(patch.enableWallet);
    if (patch.enableEcommerce !== undefined) update.enableEcommerce = Boolean(patch.enableEcommerce);
    if (patch.subscriptionFee !== undefined) update.subscriptionFee = toDecimalOrNull(patch.subscriptionFee) ?? undefined;
    if (patch.contactFee !== undefined) update.contactFee = toDecimalOrNull(patch.contactFee) ?? undefined;
    if (patch.minimumWithdrawalAmount !== undefined) {
      update.minimumWithdrawalAmount = toDecimalOrNull(patch.minimumWithdrawalAmount) ?? undefined;
    }
    if (patch.transactionFeePercent !== undefined) {
      const n = Number(patch.transactionFeePercent);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        throw new AppError({ message: "Invalid transactionFeePercent", statusCode: 400, code: "INVALID_FEE_PERCENT" });
      }
      update.transactionFeePercent = n;
    }
    if (patch.platformName !== undefined) update.platformName = String(patch.platformName ?? "").trim() || "Sidra";
    if (patch.supportEmail !== undefined) update.supportEmail = String(patch.supportEmail ?? "").trim() || null;
    if (patch.supportPhone !== undefined) update.supportPhone = String(patch.supportPhone ?? "").trim() || null;
    if (patch.featureFlags !== undefined) update.featureFlags = patch.featureFlags ?? {};

    const existing = await prisma.adminSettings.findFirst({ orderBy: { createdAt: "desc" }, select: { id: true } });
    const updated = existing
      ? await prisma.adminSettings.update({ where: { id: existing.id }, data: update })
      : await prisma.adminSettings.create({ data: update });
    return this.toGlobalDto(updated);
  }

  async setProviderOverrides({ providerId, overrides }) {
    if (!providerId) {
      throw new AppError({ message: "Invalid providerId", statusCode: 400, code: "INVALID_PROVIDER_ID" });
    }

    const provider = await prisma.provider.findUnique({ where: { id: providerId } });
    if (!provider) {
      throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    }

    const current = provider.settingsOverrides ?? {};
    const next = { ...current };

    if (overrides.enableSubscription !== undefined) next.enableSubscription = toBoolOrNull(overrides.enableSubscription);
    if (overrides.enableContactFee !== undefined) next.enableContactFee = toBoolOrNull(overrides.enableContactFee);
    if (overrides.enableWallet !== undefined) next.enableWallet = toBoolOrNull(overrides.enableWallet);
    if (overrides.enableEcommerce !== undefined) next.enableEcommerce = toBoolOrNull(overrides.enableEcommerce);
    if (overrides.subscriptionFee !== undefined) next.subscriptionFee = toDecimalOrNull(overrides.subscriptionFee)?.toString?.() ?? null;
    if (overrides.contactFee !== undefined) next.contactFee = toDecimalOrNull(overrides.contactFee)?.toString?.() ?? null;
    if (overrides.transactionFeePercent !== undefined) {
      const n = toNumberOrNull(overrides.transactionFeePercent);
      if (n !== null && (n < 0 || n > 100)) {
        throw new AppError({ message: "Invalid transactionFeePercent", statusCode: 400, code: "INVALID_FEE_PERCENT" });
      }
      next.transactionFeePercent = n;
    }

    const updated = await prisma.provider.update({ where: { id: providerId }, data: { settingsOverrides: next } });
    return this.toProviderOverridesDto(updated);
  }

  async getProviderSettings({ providerId }) {
    if (!providerId) {
      throw new AppError({ message: "Invalid providerId", statusCode: 400, code: "INVALID_PROVIDER_ID" });
    }

    const [global, provider] = await Promise.all([this.getGlobalRaw(), prisma.provider.findUnique({ where: { id: providerId } })]);
    if (!provider) {
      throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    }

    const overrides = provider.settingsOverrides ?? {};
    const effective = this.computeEffective({ global, provider, overrides });

    return {
      providerId: provider.id,
      global: this.toGlobalDto(global),
      overrides: this.toProviderOverridesDto(provider).overrides,
      effective
    };
  }

  async getGlobalRaw() {
    const doc = await prisma.adminSettings.findFirst({ orderBy: { createdAt: "desc" } });
    if (doc) return doc;
    return prisma.adminSettings.create({ data: {} });
  }

  computeEffective({ global, provider, overrides }) {
    const enableSubscription =
      Boolean(global.enableSubscription) && (overrides.enableSubscription === null || overrides.enableSubscription === undefined
        ? true
        : Boolean(overrides.enableSubscription));

    const enableContactFee =
      Boolean(global.enableContactFee) && (overrides.enableContactFee === null || overrides.enableContactFee === undefined
        ? true
        : Boolean(overrides.enableContactFee));

    const enableEcommerce =
      Boolean(global.enableEcommerce) && (overrides.enableEcommerce === null || overrides.enableEcommerce === undefined
        ? true
        : Boolean(overrides.enableEcommerce));

    const providerWalletEnabled = Boolean(provider.walletEnabled);
    const enableWallet =
      Boolean(global.enableWallet) &&
      (overrides.enableWallet === null || overrides.enableWallet === undefined
        ? providerWalletEnabled
        : Boolean(overrides.enableWallet));

    return {
      enableSubscription,
      enableContactFee,
      enableWallet,
      enableEcommerce,
      subscriptionFee: decimalToStringOrNull(overrides.subscriptionFee) ?? decimalToStringOrNull(global.subscriptionFee) ?? "0.00",
      contactFee: decimalToStringOrNull(overrides.contactFee) ?? decimalToStringOrNull(global.contactFee) ?? "0.00",
      minimumWithdrawalAmount: decimalToStringOrNull(global.minimumWithdrawalAmount) ?? "0.00",
      transactionFeePercent:
        overrides.transactionFeePercent ?? global.transactionFeePercent ?? 0
    };
  }

  toGlobalDto(doc) {
    return {
      id: doc.id,
      enableSubscription: Boolean(doc.enableSubscription),
      enableContactFee: Boolean(doc.enableContactFee),
      enableWallet: Boolean(doc.enableWallet),
      enableEcommerce: Boolean(doc.enableEcommerce),
      subscriptionFee: decimalToStringOrNull(doc.subscriptionFee) ?? "0.00",
      contactFee: decimalToStringOrNull(doc.contactFee) ?? "0.00",
      transactionFeePercent: doc.transactionFeePercent ?? 0,
      minimumWithdrawalAmount: decimalToStringOrNull(doc.minimumWithdrawalAmount) ?? "0.00",
      platformName: doc.platformName ?? "Sidra",
      supportEmail: doc.supportEmail ?? null,
      supportPhone: doc.supportPhone ?? null,
      featureFlags: doc.featureFlags ?? {},
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    };
  }

  toProviderOverridesDto(providerDoc) {
    const o = providerDoc.settingsOverrides ?? {};
    return {
      providerId: providerDoc.id,
      overrides: {
        enableSubscription: o.enableSubscription ?? null,
        enableContactFee: o.enableContactFee ?? null,
        enableWallet: o.enableWallet ?? null,
        enableEcommerce: o.enableEcommerce ?? null,
        subscriptionFee: decimalToStringOrNull(o.subscriptionFee),
        contactFee: decimalToStringOrNull(o.contactFee),
        transactionFeePercent: o.transactionFeePercent ?? null
      },
      updatedAt: providerDoc.updatedAt
    };
  }
}
