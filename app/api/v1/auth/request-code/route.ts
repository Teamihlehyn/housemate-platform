import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { prisma } from "@/lib/db";
import { sendLoginCode } from "@/lib/email";
import { adminEmails } from "@/lib/guard";
import { IS_BETA, IS_RESEARCH } from "@/lib/env";

// POST /api/v1/auth/request-code {email}
// Where on-screen codes are allowed, the code comes back in `sink_code`; otherwise it is emailed.
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

  // On-screen codes where allowed — but never for staff, whose accounts open the
  // ops console. Those always go to the real inbox.
  const existing = await prisma.user.findUnique({ where: { email: clean }, select: { role: true } });
  const isStaff = adminEmails().includes(clean) || (existing && existing.role !== "member" && (IS_RESEARCH || IS_BETA));
  const { sink, sinkCode } = await sendLoginCode(clean, code, isStaff ? { allowOnScreen: false } : {});

  return ok({ status: "sent", sink_code: sink ? sinkCode : undefined }, rid);
});
