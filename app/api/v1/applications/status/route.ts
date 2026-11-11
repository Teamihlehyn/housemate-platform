import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireAccount } from "@/lib/guard";
import { hashStatusToken, plausibleStatusToken } from "@/lib/applications";
import { applicationStatusFor } from "@/lib/applicationService";

// GET /api/v1/applications/status            — with the application (or member) session
// GET /api/v1/applications/status?t=<token>  — signed out, from the E1 magic link (read-only)
// The token only reads the status object: no name, email or answers. Unknown → 404.
export const GET = handler(async (req: NextRequest, { rid }) => {
  const t = req.nextUrl.searchParams.get("t");
  if (t !== null) {
    if (!plausibleStatusToken(t)) return fail("NOT_FOUND", "This link isn't valid any more.", 404, rid);
    const app = await prisma.application.findUnique({ where: { statusTokenHash: hashStatusToken(t) }, select: { userId: true } });
    const status = app ? await applicationStatusFor(app.userId, true) : null;
    if (!status) return fail("NOT_FOUND", "This link isn't valid any more.", 404, rid);
    return ok({ application: status }, rid);
  }
  const user = await requireAccount();
  const status = await applicationStatusFor(user.id);
  if (!status) return fail("NOT_FOUND", "Not found.", 404, rid);
  return ok({ application: status }, rid);
});
