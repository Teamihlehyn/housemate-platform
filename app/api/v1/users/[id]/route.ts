import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { computeScore } from "@/lib/credibility";
import { QUESTIONNAIRE } from "@/lib/constants";

// GET /api/v1/users/[id] — public profile DTO only. Blocked/inaccessible → generic 404.
export const GET = handler(async (_req: NextRequest, { rid, params }) => {
  const viewer = await requireUser();
  const id = params.id;

  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: viewer.id, blockedId: id },
        { blockerId: id, blockedId: viewer.id },
      ],
    },
  });

  const target = await prisma.user.findUnique({
    where: { id },
    include: { profile: true, search: { include: { areas: true, preferences: true } } },
  });

  if (
    block ||
    !target ||
    target.accountStatus !== "active" ||
    target.profile?.publicationStatus !== "published"
  ) {
    return fail("NOT_FOUND", "This profile is no longer available.", 404, rid);
  }

  const score = await computeScore(prisma, id);
  const s = target.search!;

  return ok(
    {
      id: target.id,
      displayName: target.displayName,
      avatarInitials: target.profile!.avatarInitials,
      bio: target.profile!.bio,
      journey: target.profile!.journey,
      cityId: s.cityId,
      areas: s.areas.map((a) => a.areaId),
      currency: s.currency,
      rentMinMinor: s.rentMinMinor,
      rentMaxMinor: s.rentMaxMinor,
      rentPeriod: s.rentPeriod,
      moveMode: s.moveMode,
      earliestDate: s.earliestDate,
      latestDate: s.latestDate,
      stayMinMonths: s.stayMinMonths,
      stayMaxMonths: s.stayMaxMonths,
      habits: QUESTIONNAIRE.map((q) => {
        const pref = s.preferences.find((p) => p.dimension === q.id);
        return { dimension: q.id, ownAnswer: pref?.ownAnswer ?? null };
      }),
      credibility: score,
    },
    rid
  );
});
