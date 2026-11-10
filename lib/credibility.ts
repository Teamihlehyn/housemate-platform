import { Prisma } from "@prisma/client";
import { RUBRIC } from "./constants";
import type { CheckStatus } from "./checks";

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

// ---- Completed-checks list (ENG-04) ----
// Beta shows which checks are done, never a number. Months only (YYYY-MM, UTC), never the
// full timestamp, and nothing about the evidence itself.

export interface CheckSummary {
  category: "identity" | "email" | "phone";
  status: CheckStatus;
  checkedMonth: string | null; // "2026-11" when verified, else null
}

// Reference and additional evidence have no flow yet, so they're never listed.
const LISTED = ["identity", "email", "phone"] as const;

export function toCheckList(
  rows: { category: string; status: string; checkedAt: Date }[],
  opts: { verifiedOnly: boolean }
): CheckSummary[] {
  const list: CheckSummary[] = LISTED.map((category) => {
    const row = rows.find((r) => r.category === category);
    const status: CheckStatus =
      row?.status === "verified" ? "verified"
      : row?.status === "manual_review" ? "pending"
      : row?.status === "failed" ? "failed"
      : "not_provided";
    return { category, status, checkedMonth: status === "verified" ? row!.checkedAt.toISOString().slice(0, 7) : null };
  });
  return opts.verifiedOnly ? list.filter((c) => c.status === "verified") : list;
}

export type CredibilityDto = { checks: CheckSummary[] } | (ScoreBreakdown & { checks: CheckSummary[] });

// The credibility block for a DTO. Beta: the checks list only, no score or points.
// Elsewhere: the score breakdown as before, plus the same list.
// verifiedOnly: for another member's profile, list only completed checks.
export async function credibilityDto(
  db: Tx,
  userId: string,
  opts: { beta: boolean; verifiedOnly: boolean }
): Promise<CredibilityDto> {
  const rows = await db.verificationCheck.findMany({
    where: { userId },
    select: { category: true, status: true, checkedAt: true },
  });
  const checks = toCheckList(rows, { verifiedOnly: opts.verifiedOnly });
  if (opts.beta) return { checks };
  return { ...(await computeScore(db, userId)), checks };
}
