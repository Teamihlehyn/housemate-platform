import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { writeAudit } from "./audit";
import { emailConfigured, sendEmail } from "./email";
import { IS_BETA, isCityOpen, siteUrl } from "./env";
import { ApiError } from "./api";
import { applicationDto, canEdit, missingFields } from "./applications";
import { findInvite, inviteUsable } from "./invites";

const STAFF_ROLE_NAMES = ["verifier", "moderator", "admin"];

// Database helpers for approval-first sign-up (ENG-40–43). Pure rules are in applications.ts.

type Db = Prisma.TransactionClient | typeof prisma;

export async function completenessInput(db: Db, userId: string) {
  const u = await db.user.findUniqueOrThrow({
    where: { id: userId },
    include: { profile: true, search: { include: { _count: { select: { areas: true, preferences: true } } } } },
  });
  return {
    user: u,
    input: {
      displayName: u.displayName,
      emailVerified: u.emailVerified,
      profile: u.profile ? { journey: u.profile.journey, bio: u.profile.bio } : null,
      search: u.search
        ? {
            cityId: u.search.cityId,
            rentMinMinor: u.search.rentMinMinor,
            rentMaxMinor: u.search.rentMaxMinor,
            moveMode: u.search.moveMode,
            earliestDate: u.search.earliestDate,
            latestDate: u.search.latestDate,
            stayMinMonths: u.search.stayMinMonths,
            stayMaxMonths: u.search.stayMaxMonths,
            areaCount: u.search._count.areas,
            preferenceCount: u.search._count.preferences,
          }
        : null,
    },
  };
}

export async function missingFor(db: Db, userId: string) {
  const { user, input } = await completenessInput(db, userId);
  return { user, missing: missingFields(input), undecided: input.search?.moveMode === "undecided" };
}

// The applicant-facing status object for a user (null when they never applied).
export async function applicationStatusFor(userId: string, readOnly = false) {
  const [app, search, user] = await Promise.all([
    prisma.application.findUnique({ where: { userId } }),
    prisma.search.findUnique({ where: { userId }, select: { cityId: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { accountStatus: true } }),
  ]);
  if (!app) return null;
  const city = search?.cityId ?? null;
  return applicationDto(app, city, {
    readOnly,
    cityOpen: city ? isCityOpen(city) : true,
    applicant: user?.accountStatus === "applicant",
  });
}

export function statusUrl(token: string): string {
  return `${siteUrl()}/join/status?t=${encodeURIComponent(token)}`;
}

export type EmailStatus = "sent" | "not_configured" | "failed" | "not_requested";

// Send one application email and audit `email.sent` (or the failure) without the address.
// Never throws: the state change it follows has already committed.
export async function sendApplicationEmail(
  opts: { to: string; userId: string; emailId: "E1" | "E2" | "E3" | "E4" | "E5"; actorId?: string | null; built: { subject: string; html: string; text: string } },
  rid: string
): Promise<EmailStatus> {
  let status: EmailStatus;
  if (!emailConfigured()) status = "not_configured";
  else {
    try {
      await sendEmail({ to: opts.to, ...opts.built, what: "the email" });
      status = "sent";
    } catch {
      status = "failed";
    }
  }
  await prisma.$transaction((tx) =>
    writeAudit(tx, {
      eventType: "email.sent",
      actorType: opts.actorId ? "staff" : "service",
      actorId: opts.actorId ?? null,
      subjectId: opts.userId,
      resourceType: "email",
      resourceId: opts.emailId,
      action: "send",
      outcome: status === "sent" ? "allowed" : "failed",
      reasonCode: status,
    }, rid)
  );
  return status;
}

// The person an activation code (E2) is for, or null when it can't be used: unknown, expired,
// used, revoked, not an application invite, the application isn't approved, or the account
// has already been activated. Every failure is the same null.
export async function activationTarget(rawCode: unknown) {
  const invite = await findInvite(prisma, rawCode);
  if (!invite || !inviteUsable(invite, null) || !invite.email) return null;
  const row = await prisma.invite.findUnique({ where: { id: invite.id }, select: { applicationId: true } });
  if (!row?.applicationId) return null;
  const app = await prisma.application.findUnique({ where: { id: row.applicationId } });
  if (!app || app.status !== "approved") return null;
  const person = await prisma.user.findUnique({ where: { id: app.userId } });
  if (!person || person.accountStatus !== "applicant" || person.email !== invite.email) return null;
  return { invite, app, person };
}

// Applicants may change their answers only while nobody is reviewing them (draft, submitted).
// Members are unaffected. Throws 409 otherwise.
export async function assertAnswersEditable(user: { id: string; accountStatus: string; role: string }) {
  // Staff accounts are back-office only: they have no product profile to edit.
  if (STAFF_ROLE_NAMES.includes(user.role)) throw new ApiError("NOT_FOUND", "Not found.", 404);
  if (user.accountStatus !== "applicant") return;
  const app = await prisma.application.findUnique({ where: { userId: user.id }, select: { status: true } });
  if (!app || !canEdit(app.status)) {
    throw new ApiError(
      "STATE_CONFLICT",
      "Your application is being reviewed, so your answers are locked. Email hello@peabudy.com if something needs changing.",
      409
    );
  }
}

// The display name (HM-12) and city (R5) are checked on the call, so they're locked once approved: an approved application, or (people from before approval-first) a verified
// identity in beta.
export async function isNameLocked(userId: string): Promise<boolean> {
  const [app, identity] = await Promise.all([
    prisma.application.findUnique({ where: { userId }, select: { status: true } }),
    prisma.verificationCheck.findUnique({ where: { userId_category: { userId, category: "identity" } }, select: { status: true } }),
  ]);
  if (app?.status === "approved") return true;
  return IS_BETA && identity?.status === "verified";
}
