import { NextRequest, NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireSurveyAdmin } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { surveyRef, unsubscribeToken, unsubscribeUrl } from "@/lib/emailLinks";
import { SURVEY_ELIGIBLE, cityLabel, csvCell, furthestStages } from "@/lib/survey";
import { firstName } from "@/lib/emails/render";

// GET /api/v1/staff/survey/export.csv (ENG-30; beta and admin only, 404 otherwise)
// Members who opted in to survey emails and haven't unsubscribed, for the founder's own mail
// merge. Columns: email, first_name, city, created_date, verified, stage, consent_date,
// consent_version, survey_ref, unsubscribe_url. Cells are guarded against formula injection.
// Audited with the row count only.
export const GET = handler(async (_req: NextRequest, { rid }) => {
  const staff = await requireSurveyAdmin();
  const users = await prisma.user.findMany({
    where: SURVEY_ELIGIBLE,
    orderBy: { createdAt: "asc" },
    select: {
      id: true, email: true, displayName: true, createdAt: true, surveyOptInAt: true, surveyOptInVersion: true,
      search: { select: { cityId: true } },
      checks: { where: { category: "identity", status: "verified" }, select: { id: true } },
    },
  });
  const stages = await furthestStages(users.map((u) => u.id));
  const header = ["email", "first_name", "city", "created_date", "verified", "stage", "consent_date", "consent_version", "survey_ref", "unsubscribe_url"];
  const lines = [header.join(",")];
  for (const u of users) {
    const token = unsubscribeToken(u.id);
    lines.push([
      u.email,
      firstName(u.displayName),
      cityLabel(u.search?.cityId),
      u.createdAt.toISOString().slice(0, 10),
      u.checks.length ? "yes" : "no",
      stages.get(u.id),
      u.surveyOptInAt?.toISOString().slice(0, 10) ?? "",
      u.surveyOptInVersion ?? "",
      surveyRef(u.id) ?? "",
      token ? unsubscribeUrl(token) : "",
    ].map(csvCell).join(","));
  }
  await prisma.$transaction((tx) =>
    writeAudit(tx, {
      eventType: "staff.export_survey_optins",
      actorType: "staff",
      actorId: staff.id,
      resourceType: "export",
      resourceId: "survey_optins",
      action: "export",
      safeAfter: { rows: users.length },
    }, rid)
  );
  return new NextResponse(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="peabudy-survey-optins-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
      "X-Request-ID": rid,
    },
  });
});
