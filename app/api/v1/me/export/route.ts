import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { computeScore } from "@/lib/credibility";

// GET /api/v1/me/export — the user's own data (data-portability). Own records only.
export const GET = handler(async (_req: NextRequest, { rid }) => {
  const user = await requireUser();
  const full = await prisma.user.findUnique({
    where: { id: user.id },
    include: { profile: true, search: { include: { areas: true, preferences: true } }, checks: true },
  });
  const score = await computeScore(prisma, user.id);

  const data = {
    exportedAt: new Date().toISOString(),
    account: {
      id: full!.id,
      email: full!.email,
      displayName: full!.displayName,
      phone: full!.phone,
      accountStatus: full!.accountStatus,
      locale: full!.locale,
      createdAt: full!.createdAt,
      privacyConsentAt: full!.privacyConsentAt,
      privacyConsentVersion: full!.privacyConsentVersion,
    },
    profile: full!.profile,
    search: full!.search
      ? {
          ...full!.search,
          areas: full!.search.areas.map((a) => a.areaId),
          preferences: full!.search.preferences.map((p) => ({
            dimension: p.dimension,
            ownAnswer: p.ownAnswer,
            acceptedValues: JSON.parse(p.acceptedValues),
          })),
        }
      : null,
    verification: full!.checks.map((c) => ({ category: c.category, status: c.status, points: c.points })),
    credibility: score,
  };

  return ok({ export: data }, rid);
});
