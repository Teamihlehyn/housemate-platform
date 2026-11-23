import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireAccount } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { lockKey, recentCount } from "@/lib/rateLimit";
import { ApiError } from "@/lib/api";
import { JOURNEYS } from "@/lib/constants";
import { assertAnswersEditable, isNameLocked } from "@/lib/applicationService";

const PROFILE_FIELDS = ["journey", "bio", "displayName"];
const BIO_EDITS_PER_DAY = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

// PATCH /api/v1/me/profile — journey, bio, display name, avatar initials.
export const PATCH = handler(async (req: NextRequest, { rid }) => {
  const user = await requireAccount();
  const raw = await req.json().catch(() => ({}));
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return fail("VALIDATION", "Send the changes as a JSON object.", 422, rid);
  const body = raw as Record<string, any>;
  // ENG-68: bio and journey are "complete later" answers: allowed at any open stage, and they
  // don't move the application version (staff don't approve them).
  const deferredOnly = !!body && typeof body === "object" && Object.keys(body).length > 0 && Object.keys(body).every((k) => ["bio", "journey"].includes(k));
  await assertAnswersEditable(user, { deferredOnly });
  const fe: Record<string, string> = {};
  const profileData: Record<string, unknown> = {};
  const userData: Record<string, unknown> = {};

  if (body.journey !== undefined) {
    if (!JOURNEYS.find((j) => j.id === body.journey)) fe.journey = "Choose a journey.";
    else profileData.journey = body.journey;
  }
  if (body.bio !== undefined) {
    // ENG-68: optional, any length up to 600; an empty bio clears it.
    const bio = String(body.bio ?? "").trim();
    if (bio.length > 600) fe.bio = "Keep it under 600 characters.";
    else profileData.bio = bio.length ? bio : null;
  }
  if (body.displayName !== undefined) {
    const dn = String(body.displayName).trim();
    if (dn.length < 2 || dn.length > 40) fe.displayName = "Display name must be 2–40 characters.";
    else if (dn !== user.displayName && (await isNameLocked(user.id))) {
      return fail(
        "STATE_CONFLICT",
        "Your name was checked with your ID, so it can't be changed here. Email hello@peabudy.com if it's wrong.",
        409,
        rid,
        { field_errors: { displayName: "Locked after your ID check." } }
      );
    } else {
      userData.displayName = dn;
      profileData.avatarInitials = dn.split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase();
    }
  }

  if (Object.keys(fe).length > 0)
    return fail("VALIDATION", "Please fix the highlighted fields.", 422, rid, { field_errors: fe });

  await prisma.$transaction(async (tx) => {
    // HM-54: a bio change is stamped and audited (length only, never the text), and capped
    // at BIO_EDITS_PER_DAY a day so a bio can't be flipped back and forth after review.
    let bioChanged = false;
    if ("bio" in profileData) {
      const cur = await tx.profile.findUnique({ where: { userId: user.id }, select: { bio: true } });
      bioChanged = (cur?.bio ?? null) !== profileData.bio;
      if (bioChanged) {
        await lockKey(tx, `bio:${user.id}`);
        if ((await recentCount(tx, "profile.bio_changed", user.id, DAY_MS)) >= BIO_EDITS_PER_DAY)
          throw new ApiError("RATE_LIMITED", "You've changed your bio a lot today. Try again tomorrow.", 429, undefined, 3600);
        profileData.bioUpdatedAt = new Date();
      }
    }
    if (Object.keys(userData).length > 0)
      await tx.user.update({ where: { id: user.id }, data: userData });
    if (Object.keys(profileData).length > 0) {
      const prof = await tx.profile.findUnique({ where: { userId: user.id } });
      await tx.profile.update({
        where: { userId: user.id },
        data: { ...profileData, version: (prof?.version ?? 1) + 1 },
      });
    }
    await writeAudit(tx, {
      eventType: "profile.updated",
      actorId: user.id,
      subjectId: user.id,
      resourceType: "profile",
      resourceId: user.id,
      action: "patch",
      // Audit hygiene: only known field names, never arbitrary client keys.
      safeAfter: { changed: Object.keys(body).filter((k) => PROFILE_FIELDS.includes(k)) },
    }, rid);
    if (bioChanged) {
      await writeAudit(tx, {
        eventType: "profile.bio_changed",
        actorId: user.id,
        subjectId: user.id,
        resourceType: "profile",
        resourceId: user.id,
        action: "patch",
        safeAfter: { length: typeof profileData.bio === "string" ? profileData.bio.length : 0 },
      }, rid);
    }
    // HM-36: an applicant's edit changes what staff would approve, so it moves the
    // application's version too (a stale approval then gets 409).
    if (user.accountStatus === "applicant" && !deferredOnly) {
      await tx.application.updateMany({ where: { userId: user.id }, data: { version: { increment: 1 } } });
    }
  });

  return ok({ status: "saved" }, rid);
});
