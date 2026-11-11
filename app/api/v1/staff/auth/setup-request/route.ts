import { NextRequest, after } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { validEmail } from "@/lib/accessRequests";
import { listedRole } from "@/lib/staff";
import { siteUrl } from "@/lib/env";
import { padResponse } from "@/lib/codes";
import { sendEmail } from "@/lib/email";
import { staffSetupEmail } from "@/lib/emails";
import { SETUP_LINK_MINUTES, newToken } from "@/lib/staffAuth";
import { keysFor, setupRequestLimited } from "@/lib/staffLimits";

const MESSAGE = "If this address is on the back-office list, we've emailed a link to set your password. It works for 30 minutes.";

// POST /api/v1/staff/auth/setup-request {email}   (ENG-47; "Set up your password" and
// "Forgot password?"). The identical 200 and timing for every address. Only an allowlisted
// address gets an email: a single-use link (32 random bytes, only the hash stored, 30 min);
// asking again invalidates earlier links.
export const POST = handler(async (req: NextRequest, { rid }) => {
  const start = Date.now();
  const body = await req.json().catch(() => ({}));
  const raw = typeof body?.email === "string" ? body.email.trim() : "";
  if (!validEmail(raw)) {
    return fail("VALIDATION", "Enter your work email address.", 422, rid, { field_errors: { email: "Enter your work email address." } });
  }
  const email = raw.toLowerCase();
  const limited = await setupRequestLimited(keysFor(req, email), rid);
  if (limited) {
    await padResponse(start, 600);
    return fail("RATE_LIMITED", "Too many requests. Try again in an hour.", 429, rid, { retry_after: 3600 });
  }
  if (listedRole(email)) {
    const { token, hash } = newToken();
    await prisma.$transaction(async (tx) => {
      await tx.staffSetupToken.updateMany({ where: { email, usedAt: null }, data: { usedAt: new Date() } });
      await tx.staffSetupToken.create({ data: { tokenHash: hash, email, expiresAt: new Date(Date.now() + SETUP_LINK_MINUTES * 60 * 1000) } });
    });
    const url = `${siteUrl()}/staff/setup?token=${encodeURIComponent(token)}`;
    after(async () => {
      try {
        await sendEmail({ to: email, ...staffSetupEmail({ setup_url: url, minutes: SETUP_LINK_MINUTES }), what: "the link" });
        await prisma.$transaction((tx) =>
          writeAudit(tx, { eventType: "email.sent", actorType: "service", resourceType: "email", resourceId: "staff_setup", action: "send" }, rid)
        );
      } catch (e) {
        console.error("Staff set-up email failed", (e as { code?: string })?.code ?? "unknown");
      }
    });
  }
  await padResponse(start, 600);
  return ok({ status: "sent", message: MESSAGE }, rid);
});
