import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export const connectDb = async () => {
  await prisma.$connect();
  // WAL lets readers and writers proceed concurrently instead of blocking on SQLite's default
  // rollback-journal lock; busy_timeout makes a writer that does collide retry for a bit instead
  // of failing immediately with SQLITE_BUSY (ride matching and payment webhooks can write at the
  // same time as regular request traffic).
  // Both PRAGMAs return the value they set, which $executeRaw rejects ("not allowed in SQLite")
  // since it expects a row count, not rows — $queryRaw is the one that accepts a result set.
  await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 5000;");
  return prisma;
};

export const disconnectDb = async () => {
  await prisma.$disconnect();
};
