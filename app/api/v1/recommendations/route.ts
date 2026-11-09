import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { getRecommendations } from "@/lib/matching";
import { prisma } from "@/lib/db";
import { topUpWorld } from "@/lib/sandbox";
import { VERIFIED_ONLY_BROWSING } from "@/lib/env";
import { ALGORITHM_VERSION } from "@/lib/constants";
import { identityVerified } from "@/lib/verification";

// GET /api/v1/recommendations — deterministic ranked candidates for the viewer.
export const GET = handler(async (_req: NextRequest, { rid }) => {
  const user = await requireUser();
  const full = await prisma.user.findUnique({
    where: { id: user.id },
    include: { profile: true, search: true },
  });
  if (full?.profile?.publicationStatus !== "published") {
    return fail("NOT_PUBLISHED", "Publish your profile to see matches.", 403, rid);
  }
  // Beta: nobody is shown until the team has checked this person's identity (ENG-02).
  // Matching doesn't run at all, so nothing about anyone else is loaded.
  if (VERIFIED_ONLY_BROWSING && !(await identityVerified(user.id))) {
    return ok(
      { candidates: [], exclusions: { narrowFilters: [], excludedCount: 0 }, gate: "identity_pending" },
      rid,
      { algorithm_version: ALGORITHM_VERSION }
    );
  }
  let result = await getRecommendations(user.id);
  // A tester's private world adapts if their edits (dates, areas…) leave too few matches.
  if (full?.sandboxWorldId === user.id && (await topUpWorld(user.id, result.candidates.length))) {
    result = await getRecommendations(user.id);
  }
  return ok(
    { candidates: result.candidates, exclusions: result.exclusions, gate: null },
    rid,
    { algorithm_version: result.algorithmVersion }
  );
});
