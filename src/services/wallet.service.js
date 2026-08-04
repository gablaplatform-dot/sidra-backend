import { AppError } from "../utils/AppError.js";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/db.js";

const toDecimal128 = (value) => {
  if (value instanceof Prisma.Decimal) return value;
  const str = typeof value === "number" ? value.toFixed(2) : String(value ?? "").trim();
  if (!str || Number.isNaN(Number(str))) {
    throw new AppError({ message: "Invalid amount", statusCode: 400, code: "INVALID_AMOUNT" });
  }
  return new Prisma.Decimal(str);
};

const decimalToString = (decimal128) => (decimal128 ? decimal128.toString() : "0");

// Prisma's findUnique/upsert require a defined value for a unique `where` field — `null` isn't
// accepted even though the column allows it (multiple NULLs can't be treated as "the same row"
// by a unique index). The platform wallet (providerId = null) has to go through findFirst/
// updateMany instead; a normal provider wallet can use the unique-key path either way.
export class WalletService {
  async findWallet({ providerId, session }) {
    const tx = session ?? prisma;
    if (providerId === null || providerId === undefined) {
      return tx.wallet.findFirst({ where: { providerId: null } });
    }
    return tx.wallet.findUnique({ where: { providerId } });
  }

  async ensureWallet({ providerId, session }) {
    const tx = session ?? prisma;
    const normalizedProviderId = providerId ?? null;

    if (normalizedProviderId === null) {
      const existing = await tx.wallet.findFirst({ where: { providerId: null } });
      if (existing) return existing;
      return tx.wallet.create({ data: { providerId: null, balance: toDecimal128("0") } });
    }

    return tx.wallet.upsert({
      where: { providerId: normalizedProviderId },
      update: {},
      create: { providerId: normalizedProviderId, balance: toDecimal128("0") }
    });
  }

  async creditBalance({ providerId, amountDec, session }) {
    const wallet = await this.ensureWallet({ providerId, session });
    const tx = session ?? prisma;
    return tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: amountDec } }
    });
  }

  async debitBalance({ providerId, amountDec, session }) {
    const tx = session ?? prisma;
    const normalizedProviderId = providerId ?? null;
    const updated = await tx.wallet.updateMany({
      where: { providerId: normalizedProviderId, balance: { gte: amountDec } },
      data: { balance: { decrement: amountDec } }
    });
    if (!updated.count) return null;
    return this.findWallet({ providerId: normalizedProviderId, session });
  }

  async createWalletForProvider({ providerId }) {
    if (!providerId) {
      throw new AppError({ message: "Invalid providerId", statusCode: 400, code: "INVALID_PROVIDER_ID" });
    }

    const provider = await prisma.provider.findUnique({ where: { id: providerId } });
    if (!provider) {
      throw new AppError({ message: "Provider not found", statusCode: 404, code: "PROVIDER_NOT_FOUND" });
    }

    const existing = await prisma.wallet.findUnique({ where: { providerId } });
    if (existing) {
      return { id: existing.id, providerId: existing.providerId, balance: decimalToString(existing.balance) };
    }

    const created = await prisma.wallet.create({ data: { providerId, balance: toDecimal128("0") } });
    return { id: created.id, providerId: created.providerId, balance: decimalToString(created.balance) };
  }

  async getBalance({ providerId }) {
    const wallet = await this.ensureWallet({ providerId: providerId ?? null });

    return {
      providerId: wallet.providerId,
      balance: decimalToString(wallet.balance),
      updatedAt: wallet.updatedAt
    };
  }

  creditWallet() {
    throw new AppError({ message: "Not implemented", statusCode: 501, code: "NOT_IMPLEMENTED" });
  }

  debitWallet() {
    throw new AppError({ message: "Not implemented", statusCode: 501, code: "NOT_IMPLEMENTED" });
  }
}
