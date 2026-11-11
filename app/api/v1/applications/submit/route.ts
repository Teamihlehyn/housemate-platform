import { NextRequest, after } from "next/server";
import { handler, ok, fail, ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireAccount } from "@/lib/guard";
import { writeAudit, writeOutbox } from "@/lib/audit";
import { isCityOpen } from "@/lib/env";
import { setSurveyOptIn } from "@/lib/surveyConsent";
import { firstName } from "@/lib/emails/render";
import { applicationReceivedEmail, applicationWaitlistedEmail } from "@/lib/emails";
import { MISSING_LABELS, cityName, missingMessage, newStatusToken, submitStatus } from "@/lib/applications";
import { applicationStatusFor, missingFor, sendApplicationEmail, statusUrl } from "@/lib/applicationService";
import { lockKey } from "@/lib/rateLimit";

// POST /api/v1/applications/submit {survey_opt_in?: boolean}   — /join step 4 (ENG-40)
// Checks completeness with the publish rules, then draft → submitted (or waitlisted when the
// city isn't open yet, F4). Doesn't publish anything. Sends E1 (E5 wording when waitlisted).
export const POST = handler(async (req: NextRequest, { rid }) => {
  const user = await requireAccount();
  const body = await req.json().catch(() => ({}));
  const app = await prisma.application.findUnique({ where: { userId: user.id } });
  if (!app) return fail("NOT_FOUND", "Not found.", 404, rid);
  if (app.status !== "draft") {
    return fail("STATE_CONFLICT", "This application has already been sent.", 409, rid);
  }
  const { user: full, missing, undecided } = await missingFor(prisma, user.id);
  if (missing.length) {
    return fail("INCOMPLETE", missingMessage(missing), 422, rid, {
      field_errors: Object.fromEntries(missing.map((k) => [k, `Add ${MISSING_LABELS[k]}.`])),
    });
  }
  if (undecided) {
    return fail("UNDECIDED_DATES", "Choose exact or ranged move-in dates before you submit.", 422, rid, {
      field_errors: { moveMode: "Choose exact or ranged dates." },
    });
  }
  const city = full.search!.cityId!;
  const status = submitStatus(isCityOpen(city));
  const { token, hash } = newStatusToken();

  await prisma.$transaction(async (tx) => {
    await lockKey(tx, `application:${app.id}`);
    const moved = await tx.application.updateMany({
      where: { id: app.id, status: "draft" },
      data: { status, submittedAt: new Date(), statusTokenHash: hash, version: { increment: 1 } },
    });
    if (moved.count !== 1) throw new ApiError("STATE_CONFLICT", "This application has already been sent.", 409);
    if (body.survey_opt_in === true) await setSurveyOptIn(tx, user.id, true, "onboarding", rid);
    await writeAudit(tx, {
      eventType: "application.submitted",
      actorId: user.id,
      subjectId: user.id,
      resourceType: "application",
      resourceId: app.id,
      action: "submit",
      safeBefore: { status: "draft" },
      safeAfter: { status, city },
      versionBefore: app.version,
      versionAfter: app.version + 1,
    }, rid);
    await writeOutbox(tx, "application_submitted", { applicationId: app.id, status, city });
  });

  const values = { first_name: firstName(full.displayName), status_url: statusUrl(token) };
  after(() =>
    sendApplicationEmail(
      status === "waitlisted"
        ? { to: full.email, userId: user.id, emailId: "E5", built: applicationWaitlistedEmail({ ...values, city_name: cityName(city) }) }
        : { to: full.email, userId: user.id, emailId: "E1", built: applicationReceivedEmail(values) },
      rid
    )
  );
  return ok({ application: await applicationStatusFor(user.id) }, rid);
});
