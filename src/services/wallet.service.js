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

export class WalletService {
  async ensureWallet({ providerId, session }) {
    const tx = session ?? prisma;
    return tx.wallet.upsert({
      where: { providerId },
      update: {},
      create: { providerId, balance: toDecimal128("0") }
    });
  }

  async creditBalance({ providerId, amountDec, session }) {
    await this.ensureWallet({ providerId, session });
    const tx = session ?? prisma;
    return tx.wallet.update({
      where: { providerId },
      data: { balance: { increment: amountDec } }
    });
  }

  async debitBalance({ providerId, amountDec, session }) {
    const tx = session ?? prisma;
    const updated = await tx.wallet.updateMany({
      where: { providerId, balance: { gte: amountDec } },
      data: { balance: { decrement: amountDec } }
    });
    if (!updated.count) return null;
    return tx.wallet.findUnique({ where: { providerId } });
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
    if (!providerId) {
      throw new AppError({ message: "Invalid providerId", statusCode: 400, code: "INVALID_PROVIDER_ID" });
    }

    const wallet = await prisma.wallet.findUnique({ where: { providerId } });
    if (!wallet) {
      throw new AppError({ message: "Wallet not found", statusCode: 404, code: "WALLET_NOT_FOUND" });
    }

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
