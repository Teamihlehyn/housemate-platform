import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { getRecommendations } from "@/lib/matching";
import { prisma } from "@/lib/db";
import { topUpWorld } from "@/lib/sandbox";
import { VERIFIED_ONLY_BROWSING } from "@/lib/env";
import { ALGORITHM_VERSION } from "@/lib/constants";
import { passesIdentityGate } from "@/lib/verification";
import { threadStates } from "@/lib/reads";
import { recordFirstDiscover } from "@/lib/funnelServer";

// Discover cards show what's waiting from each person (ENG-51): unread messages in your thread,
// or an introduction they sent you. Your own state only; never whether they read anything.
async function withActivity<T extends { userId: string }>(userId: string, candidates: T[]) {
  const ids = candidates.map((c) => c.userId);
  if (!ids.length) return candidates.map((c) => ({ ...c, activity: null }));
  const [convos, intros] = await Promise.all([
    prisma.conversation.findMany({
      where: { OR: [{ userAId: userId, userBId: { in: ids } }, { userBId: userId, userAId: { in: ids } }] },
      select: { id: true, createdAt: true, userAId: true, userBId: true },
    }),
    prisma.introduction.findMany({
      where: { state: "pending", senderId: { in: ids }, OR: [{ lowUserId: userId }, { highUserId: userId }] },
      select: { id: true, senderId: true },
    }),
  ]);
  const states = await threadStates(userId, convos);
  const byPeer = new Map(convos.map((c) => [c.userAId === userId ? c.userBId : c.userAId, c.id]));
  const introBy = new Map(intros.map((i) => [i.senderId, i.id]));
  return candidates.map((c) => {
    const convoId = byPeer.get(c.userId);
    const unread = convoId ? states.get(convoId)?.unread ?? 0 : 0;
    const activity =
      convoId && unread > 0
        ? { kind: "new_message" as const, href: `/messages/${convoId}`, count: unread }
        : introBy.has(c.userId)
          ? { kind: "introduced" as const, href: `/messages?intro=${introBy.get(c.userId)}` }
          : null;
    return { ...c, activity };
  });
}

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
  if (VERIFIED_ONLY_BROWSING && !(await passesIdentityGate(user.id))) {
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
  const candidates = await withActivity(user.id, result.candidates);
  await recordFirstDiscover(user.id, candidates.length);
  return ok(
    { candidates, exclusions: result.exclusions, gate: null },
    rid,
    { algorithm_version: result.algorithmVersion }
  );
});
