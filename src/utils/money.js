import { Prisma } from "@prisma/client";

import { AppError } from "./AppError.js";

// Cents-based BigInt arithmetic throughout - avoids floating point error in fee/split math.
// Shared by payment.service.js and ride.service.js so both money-math paths are the exact same
// tested code, not two copies that can quietly drift apart.

export const normalizeMoneyInput = (value) => {
  if (value instanceof Prisma.Decimal) return value.toString();
  if (typeof value === "number") return value.toFixed(2);
  return String(value ?? "").trim();
};

export const parseMoneyToCents = (value) => {
  const s = normalizeMoneyInput(value);
  if (!/^\d+(\.\d{1,2})?$/.test(s)) {
    throw new AppError({ message: "Invalid amount", statusCode: 400, code: "INVALID_AMOUNT" });
  }
  const [w, f = ""] = s.split(".");
  const cents = (f + "00").slice(0, 2);
  return BigInt(w) * 100n + BigInt(cents);
};

export const centsToDecimal = (cents) => {
  const sign = cents < 0n ? "-" : "";
  const abs = cents < 0n ? -cents : cents;
  const whole = abs / 100n;
  const frac = abs % 100n;
  const str = `${sign}${whole.toString()}.${frac.toString().padStart(2, "0")}`;
  return new Prisma.Decimal(str);
};

export const feeFromPercentCents = ({ amountCents, percent }) => {
  const n = Number(percent ?? 0);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new AppError({ message: "Invalid fee percent", statusCode: 400, code: "INVALID_FEE_PERCENT" });
  }
  const basisPoints = BigInt(Math.round(n * 100));
  return (amountCents * basisPoints) / 10000n;
};
