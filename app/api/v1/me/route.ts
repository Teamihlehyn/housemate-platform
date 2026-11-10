import { NextRequest } from "next/server";
import { preferencesDto } from "@/lib/surveyConsent";
import { handler, ok } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { credibilityDto } from "@/lib/credibility";
import { IS_BETA } from "@/lib/env";
import { parseGenderPreference } from "@/lib/constants";

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
  // Own checks, including pending/failed ones; no score in beta (ENG-04).
  const credibility = await credibilityDto(prisma, user.id, { beta: IS_BETA, verifiedOnly: false });

  return ok(
    {
      id: full!.id,
      email: full!.email,
      displayName: full!.displayName,
      role: user.role, // effective role (lib/staff.ts), not the stored one
      // Survey email choice (ENG-29); same shape as GET /me/preferences.
      preferences: preferencesDto(full!),
      accountStatus: full!.accountStatus,
      emailVerified: full!.emailVerified,
      phone: full!.phone,
      phoneVerified: full!.phoneVerified,
      profile: full!.profile,
      search: full!.search
        ? {
            ...full!.search,
            areas: full!.search.areas.map((a) => a.areaId),
            genderPreference: parseGenderPreference(full!.search.genderPreference),
            preferences: full!.search.preferences.map((p) => ({
              dimension: p.dimension,
              ownAnswer: p.ownAnswer,
              acceptedValues: JSON.parse(p.acceptedValues),
            })),
          }
        : null,
      credibility,
    },
    rid
  );
});
