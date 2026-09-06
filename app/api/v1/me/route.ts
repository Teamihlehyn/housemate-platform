import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { computeScore } from "@/lib/credibility";

// GET /api/v1/me — private own account, progress, credibility.
export const GET = handler(async (_req: NextRequest, { rid }) => {
  const user = await requireUser();
  const full = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      profile: true,
      search: { include: { areas: true, preferences: true } },
    },
  });
  const score = await computeScore(prisma, user.id);

  return ok(
    {
      id: full!.id,
      email: full!.email,
      displayName: full!.displayName,
      role: full!.role,
      accountStatus: full!.accountStatus,
      emailVerified: full!.emailVerified,
      phone: full!.phone,
      phoneVerified: full!.phoneVerified,
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
      credibility: score,
    },
    rid
  );
});
