import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/session";
import { CONSENT_REQUIRED, DEMO_MODE } from "@/lib/env";
import { createPersonaAccount } from "@/lib/sandbox";

// POST /api/v1/auth/demo-persona {persona, accept_privacy}
// Creates a fresh, private copy of a persona (with its own sample housemates) and
// signs the tester in. Each click gets its own account, so testers never collide.
export const POST = handler(async (req: NextRequest, { rid }) => {
  if (!DEMO_MODE) return fail("NOT_FOUND", "Not available.", 404, rid);
  const { persona, accept_privacy } = await req.json().catch(() => ({}));

  if (CONSENT_REQUIRED && !accept_privacy)
    return fail("CONSENT_REQUIRED", "Please accept the privacy notice to continue.", 422, rid, {
      field_errors: { accept_privacy: "Required." },
    });

  // Light abuse guard: cap persona creation site-wide per minute.
  const lastMinute = await prisma.user.count({
    where: { email: { startsWith: "demo-" }, createdAt: { gt: new Date(Date.now() - 60_000) } },
  });
  if (lastMinute >= 30)
    return fail("RATE_LIMITED", "Lots of people are trying this right now. Please try again in a minute.", 429, rid, {
      retry_after: 60,
    });

  const created = await createPersonaAccount(String(persona ?? ""), { consent: !!accept_privacy, rid });
  if (!created) return fail("VALIDATION", "Unknown persona.", 422, rid);

  await createSession(created.userId);
  return ok({ next: created.next }, rid);
});
