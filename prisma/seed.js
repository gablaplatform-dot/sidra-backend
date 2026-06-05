import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { PrismaClient, Prisma } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();

const toDecimal = (value) => {
  if (value === null || value === undefined) return new Prisma.Decimal("0.00");
  if (value instanceof Prisma.Decimal) return value;
  const str = typeof value === "number" ? value.toFixed(2) : String(value).trim();
  if (!str || Number.isNaN(Number(str))) return new Prisma.Decimal("0.00");
  return new Prisma.Decimal(str);
};

const main = async () => {
  const settings = await prisma.adminSettings.findFirst({ orderBy: { createdAt: "desc" } });
  if (!settings) {
    await prisma.adminSettings.create({
      data: {
        enableSubscription: true,
        enableContactFee: true,
        enableWallet: true,
        enableEcommerce: true,
        subscriptionFee: toDecimal(process.env.SEED_SUBSCRIPTION_FEE ?? "0.00"),
        contactFee: toDecimal(process.env.SEED_CONTACT_FEE ?? "0.00"),
        transactionFeePercent: Number(process.env.SEED_TRANSACTION_FEE_PERCENT ?? 0) || 0,
        minimumWithdrawalAmount: toDecimal(process.env.SEED_MIN_WITHDRAWAL_AMOUNT ?? "0.00")
      }
    });
  }

  const existingAdmin = await prisma.user.findFirst({ where: { role: "admin" }, select: { id: true } });
  if (existingAdmin) return;

  const email = String(process.env.SEED_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = String(process.env.SEED_ADMIN_PASSWORD ?? "");
  const name = String(process.env.SEED_ADMIN_NAME ?? "Admin").trim();
  const phone = String(process.env.SEED_ADMIN_PHONE ?? "").trim() || null;

  if (!email || !password) return;

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      name,
      email,
      phone,
      passwordHash,
      role: "admin",
      isActive: true,
      adminPermissions: ["*"]
    }
  });
};

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    await prisma.$disconnect();
    throw e;
  });

