import { NextRequest } from "next/server";
import { handler, ok, fail, ApiError } from "@/lib/api";
import { requireStaff } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { writeAudit, writeOutbox, notify } from "@/lib/audit";
import { isCityOpen } from "@/lib/env";
import { RUBRIC } from "@/lib/constants";
import { createInvite, inviteUrl } from "@/lib/invites";
import { lockKey } from "@/lib/rateLimit";
import { snapshotScore } from "@/lib/credibility";
import { firstName } from "@/lib/emails/render";
import { CALL_LINK_LATER, approvedEmail, callBookedEmail, declinedEmail } from "@/lib/emails";
import {
  ACTION_RESULT,
  DAY_MS,
  DECLINE_REASONS,
  REAPPLY_DAYS,
  StaffAction,
  callTimeLabel,
  canStaffAct,
  dateLabel,
  isStaffAction,
  missingMessage,
} from "@/lib/applications";
import { EmailStatus, missingFor, sendApplicationEmail } from "@/lib/applicationService";
import { applicationDetail, requireActingRole, staffApplication } from "@/lib/staffApplications";

// GET /api/v1/staff/applications/[id] — the review view (any staff role). Audited.
export const GET = handler(async (_req: NextRequest, { rid, params }) => {
  const staff = await requireStaff();
  const detail = await applicationDetail(params.id, staff);
  await prisma.$transaction((tx) =>
    writeAudit(tx, {
      eventType: "staff.application_viewed",
      actorType: "staff",
      actorId: staff.id,
      subjectId: null,
      resourceType: "application",
      resourceId: params.id,
      action: "view",
    }, rid)
  );
  return ok({ application: detail }, rid);
});

// POST /api/v1/staff/applications/[id] {action, expected_version, …}   (ENG-42)
//   start_review | call_booked {call_at, send_email?, call_link?}
//   | approve {id_check_confirmed, id_check_method, own_account?, relationship_note?}
//   | decline {reason} | waitlist | resend_activation
// Verifiers and admins only (moderators: 404). Never on one's own application (404).
// Approve, in one transaction: identity verified (and nothing else: no phone check, F-08),
// adultEligible, approved, an activation invite. Not published until activation (R4).
export const POST = handler(async (req: NextRequest, { rid, params }) => {
  const staff = await requireStaff();
  requireActingRole(staff.role);
  const existing = await staffApplication(params.id, staff.id);
  const body = await req.json().catch(() => ({}));
  const action = body?.action;
  if (!isStaffAction(action)) {
    return fail("VALIDATION", "Unknown action.", 422, rid, { field_errors: { action: "Unknown action." } });
  }
  if (body.expected_version !== undefined && body.expected_version !== existing.version) {
    return fail("VERSION_CONFLICT", "Someone else has just updated this application. Reload it and try again.", 409, rid);
  }

  // Validate the extra fields first.
  const fe: Record<string, string> = {};
  let callAt: Date | null = null;
  if (action === "call_booked") {
    callAt = typeof body.call_at === "string" ? new Date(body.call_at) : null;
    if (!callAt || isNaN(callAt.getTime())) fe.call_at = "Enter the call's date and time.";
    else if (callAt.getTime() < Date.now() - 5 * 60 * 1000) fe.call_at = "Choose a time in the future.";
    // Optional video link for E4. Only https, not stored (it lives in the email only).
    if (body.call_link != null && body.call_link !== "") {
      const link = String(body.call_link).trim();
      if (link.length > 300 || !/^https:\/\/[^\s<>"']+$/.test(link)) fe.call_link = "Paste the full video link, starting with https://.";
    }
  }
  if (action === "approve") {
    if (body.id_check_confirmed !== true) fe.id_check_confirmed = "Confirm you saw a photo ID matching this person, and they're 18 or over.";
    if (body.id_check_method !== "video") fe.id_check_method = "Choose how you checked their ID.";
    // The self-approval ban checks account IDs, so it can't catch a member account the
    // reviewer also owns (ENG-46). The reviewer declares it instead, with a note; audited.
    const note = typeof body.relationship_note === "string" ? body.relationship_note.trim() : "";
    if (note.length > 300) fe.relationship_note = "Keep the note under 300 characters.";
    if (body.own_account === true && note.length < 5) {
      fe.relationship_note = "Say whose account this is and why you're approving it, e.g. \"My own test account for the Lagos launch\".";
    }
  }
  if (action === "decline" && !(DECLINE_REASONS as readonly string[]).includes(body.reason)) {
    fe.reason = "Choose a reason.";
  }
  if (Object.keys(fe).length) return fail("VALIDATION", "Check the highlighted fields.", 422, rid, { field_errors: fe });

  if (!canStaffAct(action, existing.status)) {
    return fail("STATE_CONFLICT", `This application is ${existing.status.replace("_", " ")}, so you can't do that now.`, 409, rid);
  }
  const subject = await prisma.user.findUniqueOrThrow({ where: { id: existing.userId } });
  if (subject.accountStatus !== "applicant") {
    return fail("STATE_CONFLICT", "This person isn't an applicant any more.", 409, rid);
  }
  if (action === "approve") {
    const { missing, undecided } = await missingFor(prisma, existing.userId);
    if (missing.length) {
      return fail("INCOMPLETE", missingMessage(missing, "approve"), 422, rid, {
        field_errors: Object.fromEntries(missing.map((k) => [k, "Missing."])),
      });
    }
    if (undecided) return fail("INCOMPLETE", "Their move-in dates are undecided.", 422, rid);
    const city = (await prisma.search.findUnique({ where: { userId: existing.userId }, select: { cityId: true } }))?.cityId;
    if (city && !isCityOpen(city)) {
      return fail("STATE_CONFLICT", "This city isn't open yet. Waitlist the application instead.", 409, rid);
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    await lockKey(tx, `application:${existing.id}`);
    const app = await tx.application.findUniqueOrThrow({ where: { id: existing.id } });
    if (app.version !== existing.version) {
      throw new ApiError("VERSION_CONFLICT", "Someone else has just updated this application. Reload it and try again.", 409);
    }
    const now = new Date();
    const next = ACTION_RESULT[action as StaffAction];
    const data: Record<string, unknown> = { status: next, version: app.version + 1 };
    let invite: { id: string; code: string; expiresAt: Date } | null = null;

    if (action === "start_review") Object.assign(data, { reviewedBy: staff.id });
    if (action === "call_booked") Object.assign(data, { callAt, reviewedBy: staff.id });
    if (action === "waitlist") Object.assign(data, { reviewedBy: staff.id, reviewedAt: now });
    if (action === "decline" || action === "approve" || action === "resend_activation") {
      // Any earlier unused activation code stops working.
      await tx.invite.updateMany({ where: { applicationId: app.id, usedAt: null, revokedAt: null }, data: { revokedAt: now } });
    }
    if (action === "decline") {
      Object.assign(data, {
        reviewedBy: staff.id,
        reviewedAt: now,
        declineReason: body.reason,
        reapplyAfter: new Date(now.getTime() + REAPPLY_DAYS * DAY_MS),
        activationInviteId: null,
      });
      // Declining after an approval withdraws that approval's identity claim too.
      if (app.status === "approved") {
        await tx.verificationCheck.deleteMany({ where: { userId: app.userId, category: "identity" } });
        await tx.user.update({ where: { id: app.userId }, data: { adultEligible: false } });
      }
    }
    if (action === "approve") {
      await tx.verificationCheck.upsert({
        where: { userId_category: { userId: app.userId, category: "identity" } },
        create: { userId: app.userId, category: "identity", status: "verified", points: RUBRIC.identity, checkedAt: now },
        update: { status: "verified", points: RUBRIC.identity, checkedAt: now },
      });
      await tx.user.update({ where: { id: app.userId }, data: { adultEligible: true } });
      await snapshotScore(tx, app.userId);
      Object.assign(data, { reviewedBy: staff.id, reviewedAt: now, idCheckMethod: "video", idCheckAt: now, declineReason: null, reapplyAfter: null });
    }
    if (action === "approve" || action === "resend_activation") {
      invite = await createInvite(tx, { email: subject.email, applicationId: app.id, createdBy: staff.id });
      data.activationInviteId = invite.id;
    }
    await tx.application.update({ where: { id: app.id }, data });

    const eventType =
      action === "resend_activation" ? "application.activation_resent"
      : action === "start_review" ? "application.review_started"
      : `application.${next}`;
    await writeAudit(tx, {
      eventType,
      actorType: "staff",
      actorId: staff.id,
      subjectId: app.userId,
      resourceType: "application",
      resourceId: app.id,
      action,
      reasonCode: action === "decline" ? body.reason : action === "approve" ? (body.own_account === true ? "own_account_declared" : "id_check_video") : null,
      safeBefore: { status: app.status },
      safeAfter:
        action === "approve" && (body.own_account === true || (typeof body.relationship_note === "string" && body.relationship_note.trim()))
          ? { status: next, own_account: body.own_account === true, relationship_note: String(body.relationship_note ?? "").trim().slice(0, 300) }
          : { status: next },
      versionBefore: app.version,
      versionAfter: app.version + 1,
    }, rid);
    await writeOutbox(tx, `application_${action}`, { applicationId: app.id, status: next });
    if (action === "approve") {
      await notify(tx, app.userId, "check_result", "Identity checked", "Your application is approved. Check your email to activate your account.");
    }
    return { invite };
  });

  // Emails go after the commit; staff see whether they were sent.
  let email_status: EmailStatus = "not_requested";
  const first = firstName(subject.displayName);
  if (result.invite) {
    email_status = await sendApplicationEmail(
      {
        to: subject.email,
        userId: subject.id,
        actorId: staff.id,
        emailId: "E2",
        built: approvedEmail({
          first_name: first,
          activation_url: inviteUrl(result.invite.code),
          code: result.invite.code,
          expires_on: dateLabel(result.invite.expiresAt),
        }),
      },
      rid
    );
  } else if (action === "decline") {
    email_status = await sendApplicationEmail(
      {
        to: subject.email,
        userId: subject.id,
        actorId: staff.id,
        emailId: "E3",
        built: declinedEmail({ first_name: first, reapply_on: dateLabel(new Date(Date.now() + REAPPLY_DAYS * DAY_MS)) }),
      },
      rid
    );
  } else if (action === "call_booked" && body.send_email === true && callAt) {
    const city = (await prisma.search.findUnique({ where: { userId: subject.id }, select: { cityId: true } }))?.cityId ?? null;
    email_status = await sendApplicationEmail(
      { to: subject.email, userId: subject.id, actorId: staff.id, emailId: "E4", built: callBookedEmail({ first_name: first, call_time: callTimeLabel(callAt, city), call_link: body.call_link ? String(body.call_link).trim() : CALL_LINK_LATER }) },
      rid
    );
  }

  return ok(
    {
      application: await applicationDetail(existing.id, staff),
      ...(result.invite
        ? { activation_url: inviteUrl(result.invite.code), activation_code: result.invite.code, expires_at: result.invite.expiresAt }
        : {}),
      email_status,
    },
    rid
  );
});
