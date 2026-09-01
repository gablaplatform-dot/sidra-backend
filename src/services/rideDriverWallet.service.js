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

// Deliberately separate from WalletService (marketplace, providerId-scoped) rather than a shared
// generic wallet - driver payouts are their own ledger, and every RideDriverWallet always has a
// real, non-null rideDriverId (there's no "platform wallet" special case here), so this is
// simpler than WalletService's null-handling.
export class RideDriverWalletService {
  async ensureWallet({ rideDriverId, session }) {
    const tx = session ?? prisma;
    return tx.rideDriverWallet.upsert({
      where: { rideDriverId },
      update: {},
      create: { rideDriverId, balance: toDecimal128("0") }
    });
  }

  async creditBalance({ rideDriverId, amountDec, session }) {
    const wallet = await this.ensureWallet({ rideDriverId, session });
    const tx = session ?? prisma;
    return tx.rideDriverWallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: amountDec } }
    });
  }

  async debitBalance({ rideDriverId, amountDec, session }) {
    const tx = session ?? prisma;
    const updated = await tx.rideDriverWallet.updateMany({
      where: { rideDriverId, balance: { gte: amountDec } },
      data: { balance: { decrement: amountDec } }
    });
    if (!updated.count) return null;
    return tx.rideDriverWallet.findUnique({ where: { rideDriverId } });
  }

  async getBalance({ rideDriverId }) {
    const wallet = await this.ensureWallet({ rideDriverId });
    return { rideDriverId: wallet.rideDriverId, balance: decimalToString(wallet.balance), updatedAt: wallet.updatedAt };
  }
}
