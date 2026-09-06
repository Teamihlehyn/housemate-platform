import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { buildHouseholdView } from "@/lib/household";

// GET /api/v1/households/current — the user's active or proposed household, or null.
export const GET = handler(async (_req: NextRequest, { rid }) => {
  const user = await requireUser();
  const membership = await prisma.membership.findFirst({
    where: {
      userId: user.id,
      state: "active",
      household: { state: { in: ["proposed", "active", "completed"] } },
    },
    orderBy: { joinedAt: "desc" },
  });
  if (!membership) return ok({ household: null }, rid);
  const view = await buildHouseholdView(membership.householdId, user.id);
  return ok({ household: view }, rid);
});
