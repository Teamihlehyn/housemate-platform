import { NextRequest } from "next/server";
import { isStaffAccount } from "@/lib/staff";
import { handler, ok, fail } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { credibilityDto } from "@/lib/credibility";
import { QUESTIONNAIRE } from "@/lib/constants";
import { IS_BETA, VERIFIED_ONLY_BROWSING } from "@/lib/env";
import { canSeeEachOther, identityVerified } from "@/lib/verification";

// GET /api/v1/users/[id] — public profile DTO only. Blocked/inaccessible → generic 404.
// In beta, both the viewer and the target must be identity-checked (ENG-02).
export const GET = handler(async (_req: NextRequest, { rid, params }) => {
  const viewer = await requireUser();
  const id = params.id;
  const notFound = () => fail("NOT_FOUND", "This profile is no longer available.", 404, rid);

  if (VERIFIED_ONLY_BROWSING) {
    const [viewerVerified, targetVerified] = await Promise.all([identityVerified(viewer.id), identityVerified(id)]);
    if (!canSeeEachOther({ verifiedOnly: true, viewerVerified, targetVerified })) return notFound();
  }

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
    isStaffAccount(target) ||
    target.profile?.publicationStatus !== "published" ||
    (target.sandboxWorldId ?? null) !== (viewer.sandboxWorldId ?? null)
  ) {
    return notFound();
  }

  // Beta: completed checks with month only, no score (ENG-04). Never evidence.
  const credibility = await credibilityDto(prisma, id, { beta: IS_BETA, verifiedOnly: true });
  const s = target.search!;

  return ok(
    {
      id: target.id,
      displayName: target.displayName,
      isSample: target.isDemoBot,
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
      credibility,
    },
    rid
  );
});
