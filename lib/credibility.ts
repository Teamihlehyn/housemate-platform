import { Prisma } from "@prisma/client";
import { RUBRIC } from "./constants";

type Tx = Prisma.TransactionClient;

export interface ScoreBreakdown {
  score: number;
  components: { category: string; earned: number; available: number; status: string }[];
}

// Recompute credibility from verified checks (server-authoritative; client cannot award).
export async function computeScore(tx: Tx, userId: string): Promise<ScoreBreakdown> {
  const checks = await tx.verificationCheck.findMany({ where: { userId } });
  const verified = new Set(checks.filter((c) => c.status === "verified").map((c) => c.category));

  const components = [
    { category: "identity", available: RUBRIC.identity },
    { category: "email", available: RUBRIC.email },
    { category: "phone", available: RUBRIC.phone },
    { category: "reference", available: RUBRIC.reference },
    { category: "additional", available: RUBRIC.additional },
  ].map((c) => ({
    ...c,
    earned: verified.has(c.category) ? c.available : 0,
    status: verified.has(c.category) ? "verified" : "not_provided",
  }));

  const score = Math.min(100, components.reduce((s, c) => s + c.earned, 0));
  return { score, components };
}

// Persist a score snapshot (append-only) after a recompute.
export async function snapshotScore(tx: Tx, userId: string): Promise<ScoreBreakdown> {
  const bd = await computeScore(tx, userId);
  await tx.scoreSnapshot.create({
    data: {
      userId,
      score: bd.score,
      componentJson: JSON.stringify(bd.components),
    },
  });
  return bd;
}
