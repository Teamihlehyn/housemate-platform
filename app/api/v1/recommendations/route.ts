import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { getRecommendations } from "@/lib/matching";
import { prisma } from "@/lib/db";
import { topUpWorld } from "@/lib/sandbox";

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
  let result = await getRecommendations(user.id);
  // A tester's private world adapts if their edits (dates, areas…) leave too few matches.
  if (full?.sandboxWorldId === user.id && (await topUpWorld(user.id, result.candidates.length))) {
    result = await getRecommendations(user.id);
  }
  return ok(
    { candidates: result.candidates, exclusions: result.exclusions },
    rid,
    { algorithm_version: result.algorithmVersion }
  );
});
