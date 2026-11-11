import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { ApiError } from "./api";

type Db = Prisma.TransactionClient | typeof prisma;

// Is there a block between these two people, in either direction?
export async function isBlocked(a: string, b: string, db: Db = prisma): Promise<boolean> {
  const block = await db.block.findFirst({
    where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
    select: { id: true },
  });
  return !!block;
}

// Every cross-user action re-checks blocks (security review HM-02). 404, not 403, so a
// block stays silent: the other person can't tell it from a member who left.
export async function assertNotBlocked(a: string, b: string, db: Db = prisma): Promise<void> {
  if (await isBlocked(a, b, db)) throw new ApiError("NOT_FOUND", "This user is not available.", 404);
}

// Intro states that can still lead somewhere. Accepted intros stay accepted (their
// conversation is closed and every later step checks the block).
export const OPEN_INTRO_STATES = ["pending"];
