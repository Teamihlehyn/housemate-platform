import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { prisma } from "@/lib/db";
import { sendLoginCode } from "@/lib/email";

// POST /api/v1/auth/request-code {email} → 202 generic.
// Prototype: code is delivered to the demo "sink" (returned in body + logged), never a real inbox.
export const POST = handler(async (req: NextRequest, { rid }) => {
  const { email } = await req.json().catch(() => ({}));
  if (!email || typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email.trim())) {
    return fail("VALIDATION", "Enter a valid email address.", 422, rid, {
      field_errors: { email: "Enter a valid email address." },
    });
  }
  const clean = email.trim().toLowerCase();

  // Rate limit: max 5 requests/hour per email.
  const recent = await prisma.authCode.count({
    where: { email: clean, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= 5) {
    return fail("RATE_LIMITED", "Too many code requests. Try again later.", 429, rid, {
      retry_after: 3600,
    });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await prisma.authCode.create({
    data: { email: clean, code, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
  });

  // Demo envs return a sink code; beta sends a real email.
  const { sink, sinkCode } = await sendLoginCode(clean, code);

  return ok({ status: "sent", sink_code: sink ? sinkCode : undefined }, rid);
});
