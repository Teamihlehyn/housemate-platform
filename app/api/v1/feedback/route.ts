import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { clientIp, hashIp } from "@/lib/auth";
import { lockKey, recentCount } from "@/lib/rateLimit";

const LIMITED = "Thanks, that's plenty for now. Try again in a few minutes.";

// POST /api/v1/feedback {message, rating?, page, tester_id?, source?}
// In-app feedback. Works signed in or out (e.g. from the sign-in page). Signed in, it is
// stored with the account (staff see who sent it; it is in /me/export and deleted with the
// account). Limits (ENG-31, HM-13): signed out 5 per 10 minutes per IP bucket; signed in
// 20 per hour per member; plus the old 10 a minute per tester ID.
export const POST = handler(async (req: NextRequest, { rid }) => {
  const body = await req.json().catch(() => ({}));
  const message = String(body.message ?? "").trim();
  if (message.length < 3 || message.length > 2000)
    return fail("VALIDATION", "Write a few words (up to 2,000 characters).", 422, rid, {
      field_errors: { message: "Write a few words (up to 2,000 characters)." },
    });
  const rating = body.rating == null ? null : Number(body.rating);
  if (rating != null && !(Number.isInteger(rating) && rating >= 1 && rating <= 5))
    return fail("VALIDATION", "Rating must be 1–5.", 422, rid);

  const testerId = body.tester_id ? String(body.tester_id).slice(0, 64) : null;
  if (testerId) {
    const recent = await prisma.testerFeedback.count({
      where: { testerId, createdAt: { gt: new Date(Date.now() - 60_000) } },
    });
    if (recent >= 10) return fail("RATE_LIMITED", LIMITED, 429, rid, { retry_after: 60 });
  }

  const user = await getCurrentUser();
  const ipHash = user ? null : hashIp(clientIp(req));
  const data = {
    userId: user?.id ?? null,
    testerId,
    source: body.source ? String(body.source).slice(0, 64) : null,
    page: String(body.page ?? "/").slice(0, 300),
    rating,
    message,
  };
  const limited = await prisma.$transaction(async (tx) => {
    if (user) {
      await lockKey(tx, `feedback:user:${user.id}`);
      const n = await tx.testerFeedback.count({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 60 * 60_000) } } });
      if (n >= 20) return true;
    } else if (ipHash) {
      await lockKey(tx, `feedback:ip:${ipHash}`);
      if ((await recentCount(tx, "feedback.received", ipHash, 10 * 60_000)) >= 5) return true;
      // Signed out, the only record of who sent it is this salted IP bucket, for the limit.
      await writeAudit(tx, {
        eventType: "feedback.received",
        actorType: "service",
        resourceType: "ip",
        resourceId: ipHash,
        action: "submit",
      }, rid);
    }
    await tx.testerFeedback.create({ data });
    return false;
  });
  if (limited) return fail("RATE_LIMITED", LIMITED, 429, rid, { retry_after: 600 });
  return ok({ status: "received" }, rid);
});
