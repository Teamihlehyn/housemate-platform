import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { buildHouseholdView, myProposals } from "@/lib/household";

// GET /api/v1/households/current — your household: the active (or completed) one if any, else
// your newest pending proposal; plus `proposals`, all your own pending proposals, sent and
// received (D-R2). Never anything about other people's proposals.
export const GET = handler(async (_req: NextRequest, { rid }) => {
  const user = await requireUser();
  const formed = await prisma.membership.findFirst({
    where: { userId: user.id, state: "active", household: { state: { in: ["active", "completed"] } } },
    orderBy: { joinedAt: "desc" },
  });
  const proposals = await myProposals(user.id);
  const id = formed?.householdId ?? proposals[0]?.id ?? null;
  return ok({ household: id ? await buildHouseholdView(id, user.id) : null, proposals }, rid);
});
