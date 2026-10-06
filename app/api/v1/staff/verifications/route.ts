import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { requireStaff } from "@/lib/guard";
import { prisma } from "@/lib/db";

// GET /api/v1/staff/verifications — identity cases awaiting manual (out-of-band) review.
export const GET = handler(async (_req: NextRequest, { rid }) => {
  await requireStaff();
  const checks = await prisma.verificationCheck.findMany({
    where: { category: "identity", status: "manual_review" },
    orderBy: { checkedAt: "asc" },
  });
  const userIds = checks.map((c) => c.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    include: { profile: true, search: true },
  });
  const map = new Map(users.map((u) => [u.id, u]));

  return ok(
    {
      cases: checks.map((c) => {
        const u = map.get(c.userId);
        return {
          userId: c.userId,
          displayName: u?.displayName ?? "—",
          // Staff need contact to arrange the live check during the pilot.
          email: u?.email ?? null,
          phone: u?.phone ?? null,
          city: u?.search?.cityId ?? null,
          submittedAt: c.checkedAt,
        };
      }),
    },
    rid
  );
});
