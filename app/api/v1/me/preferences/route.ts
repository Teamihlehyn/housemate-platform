import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { preferencesDto, setSurveyOptIn } from "@/lib/surveyConsent";

const SELECT = { surveyOptIn: true, surveyOptInAt: true, surveyOptInVersion: true, unsubscribedAt: true } as const;

// GET /api/v1/me/preferences → {survey_opt_in, survey_opt_in_at, survey_opt_in_version, unsubscribed_at}
export const GET = handler(async (_req: NextRequest, { rid }) => {
  const user = await requireUser();
  const u = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: SELECT });
  return ok(preferencesDto(u), rid);
});

// PATCH /api/v1/me/preferences {survey_opt_in: boolean, source?: "settings" | "onboarding"}
// Opt-in is never assumed: only an explicit true opts in. Same response shape as GET.
export const PATCH = handler(async (req: NextRequest, { rid }) => {
  const user = await requireUser();
  const body = await req.json().catch(() => ({}));
  if (typeof body.survey_opt_in !== "boolean") {
    return fail("VALIDATION", "Choose whether you want survey emails.", 422, rid, {
      field_errors: { survey_opt_in: "Must be true or false." },
    });
  }
  const via = body.source === "onboarding" ? "onboarding" : "settings";
  const u = await prisma.$transaction(async (tx) => {
    await setSurveyOptIn(tx, user.id, body.survey_opt_in, via, rid);
    return tx.user.findUniqueOrThrow({ where: { id: user.id }, select: SELECT });
  });
  return ok(preferencesDto(u), rid);
});
