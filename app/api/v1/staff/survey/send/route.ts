import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireSurveyAdmin } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { lockKey } from "@/lib/rateLimit";
import { emailConfigured, sendEmail } from "@/lib/email";
import { surveyEmail } from "@/lib/emails";
import { firstName } from "@/lib/emails/render";
import { emailLinkSecret, surveyRef, unsubscribeApiUrl, unsubscribeToken, unsubscribeUrl } from "@/lib/emailLinks";
import { SURVEY_ELIGIBLE, validCampaign, validSurveyUrl, withRef } from "@/lib/survey";

const THROTTLE_MS = 600; // Resend's default limit is 2 requests a second
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// POST /api/v1/staff/survey/send {campaign, survey_url?, dry_run?, limit?}   (beta and admin only; 404 otherwise)
// Emails the survey to members who opted in and haven't unsubscribed (lib/survey.ts).
// - campaign: a slug such as "survey-1" or "survey-1-reminder". Each person gets a campaign
//   at most once: a send is claimed (audited) before it goes out, so a double click or a
//   second staff member can't email anyone twice.
// - survey_url: https link (default NEXT_PUBLIC_SURVEY_URL); a pseudonymous ?ref= is added.
// - dry_run: true → {dry_run, eligible, already_sent, would_send}; nothing is sent.
// - limit: people per call, 1–50 (default 25), sent one at a time with throttling. Call
//   again until remaining is 0.
// Every email carries List-Unsubscribe (+ one-click). Audit: survey.sent per person, with
// no address; outcome "failed" when Resend refused it (a later call retries those).
export const POST = handler(async (req: NextRequest, { rid }) => {
  const staff = await requireSurveyAdmin();
  const body = await req.json().catch(() => ({}));
  if (!validCampaign(body.campaign)) {
    return fail("VALIDATION", "Name the campaign with 3–40 lower-case letters, digits or hyphens, like survey-1.", 422, rid, {
      field_errors: { campaign: "Use something like survey-1." },
    });
  }
  const campaign: string = body.campaign;
  const surveyUrl = body.survey_url ?? process.env.NEXT_PUBLIC_SURVEY_URL;
  if (!validSurveyUrl(surveyUrl)) {
    return fail("VALIDATION", "Give the survey's https link.", 422, rid, { field_errors: { survey_url: "Must be an https link." } });
  }
  const limit = Math.min(50, Math.max(1, Number.isInteger(body.limit) ? body.limit : 25));

  const sentIds = (
    await prisma.auditEvent.findMany({
      where: { eventType: "survey.sent", resourceId: campaign, outcome: "allowed" },
      select: { subjectId: true },
    })
  ).map((a) => a.subjectId!).filter(Boolean);
  const where = { ...SURVEY_ELIGIBLE, id: { notIn: sentIds } };
  const eligible = await prisma.user.count({ where: SURVEY_ELIGIBLE });
  const pending = await prisma.user.count({ where });

  if (body.dry_run === true) {
    return ok({ dry_run: true, campaign, eligible, already_sent: eligible - pending, would_send: pending }, rid);
  }
  if (!emailConfigured()) return fail("EMAIL_NOT_CONFIGURED", "Email isn't set up here, so nothing was sent.", 503, rid);
  if (!emailLinkSecret()) {
    return fail("EMAIL_NOT_CONFIGURED", "EMAIL_LINK_SECRET isn't set, so unsubscribe links can't be made. Nothing was sent.", 503, rid);
  }

  const batch = await prisma.user.findMany({
    where,
    select: { id: true, email: true, displayName: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let sent = 0, failed = 0, skipped = 0;
  for (const [i, u] of batch.entries()) {
    // Claim first: one audit row per person per campaign, under a lock.
    const claim = await prisma.$transaction(async (tx) => {
      await lockKey(tx, `survey:${campaign}:${u.id}`);
      const done = await tx.auditEvent.findFirst({
        where: { eventType: "survey.sent", resourceId: campaign, subjectId: u.id, outcome: "allowed" },
        select: { id: true },
      });
      const still = await tx.user.findFirst({ where: { ...SURVEY_ELIGIBLE, id: u.id }, select: { id: true } });
      if (done || !still) return null;
      return writeAudit(tx, {
        eventType: "survey.sent",
        actorType: "staff",
        actorId: staff.id,
        subjectId: u.id,
        resourceType: "survey",
        resourceId: campaign,
        action: "send",
      }, rid);
    });
    if (!claim) { skipped++; continue; }
    const token = unsubscribeToken(u.id)!;
    const msg = surveyEmail({
      first_name: firstName(u.displayName),
      survey_url: withRef(surveyUrl, surveyRef(u.id)),
      unsubscribe_url: unsubscribeUrl(token),
    });
    try {
      if (i > 0) await sleep(THROTTLE_MS);
      await sendEmail({
        to: u.email,
        ...msg,
        what: "the survey",
        headers: {
          "List-Unsubscribe": `<${unsubscribeApiUrl(token)}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      sent++;
    } catch {
      failed++;
      await prisma.auditEvent.update({ where: { id: claim.id }, data: { outcome: "failed", reasonCode: "send_failed" } });
    }
  }
  const remaining = await prisma.user.count({
    where: {
      ...SURVEY_ELIGIBLE,
      id: {
        notIn: (
          await prisma.auditEvent.findMany({
            where: { eventType: "survey.sent", resourceId: campaign, outcome: "allowed" },
            select: { subjectId: true },
          })
        ).map((a) => a.subjectId!),
      },
    },
  });
  return ok({ dry_run: false, campaign, sent, failed, skipped, remaining }, rid);
});
