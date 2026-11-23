import { PrismaClient } from "@prisma/client";

// HM-55: Search budgets are BigInt columns. Anything that serialises a Prisma row (API
// responses, snapshots, exports) gets a plain number; budgets are capped far below 2^53, so
// this is exact. Code doing maths should still convert explicitly (minorNum in lib/money.ts).
const bigintProto = BigInt.prototype as unknown as { toJSON?: () => number };
if (!bigintProto.toJSON) bigintProto.toJSON = function (this: bigint) { return Number(this); };

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
