import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

// POST /api/v1/feedback {message, rating?, page, tester_id?, source?}
// In-app research feedback. Works signed in or out (e.g. from the sign-in page).
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
    if (recent >= 10) return fail("RATE_LIMITED", "Thanks — that's plenty for now!", 429, rid, { retry_after: 60 });
  }

  const user = await getCurrentUser();
  await prisma.testerFeedback.create({
    data: {
      userId: user?.id ?? null,
      testerId,
      source: body.source ? String(body.source).slice(0, 64) : null,
      page: String(body.page ?? "/").slice(0, 300),
      rating,
      message,
    },
  });
  return ok({ status: "received" }, rid);
});
