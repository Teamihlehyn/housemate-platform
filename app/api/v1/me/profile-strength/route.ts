import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireAccount } from "@/lib/guard";
import { profileStrengthFor } from "@/lib/applicationService";

// GET /api/v1/me/profile-strength — your own "make your profile stronger" checklist (ENG-68).
// Applicants and users; never anyone else's.
export const GET = handler(async (_req: NextRequest, { rid }) => {
  const user = await requireAccount();
  if (["verifier", "moderator", "admin"].includes(user.role)) return fail("NOT_FOUND", "Not found.", 404, rid);
  const s = await profileStrengthFor(user.id);
  if (!s) return fail("NOT_FOUND", "Not found.", 404, rid);
  return ok(s, rid);
});
