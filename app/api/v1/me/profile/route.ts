import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireAccount } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { JOURNEYS } from "@/lib/constants";
import { assertAnswersEditable, isNameLocked } from "@/lib/applicationService";

// PATCH /api/v1/me/profile — journey, bio, display name, avatar initials.
export const PATCH = handler(async (req: NextRequest, { rid }) => {
  const user = await requireAccount();
  await assertAnswersEditable(user);
  const body = await req.json().catch(() => ({}));
  const fe: Record<string, string> = {};
  const profileData: Record<string, unknown> = {};
  const userData: Record<string, unknown> = {};

  if (body.journey !== undefined) {
    if (!JOURNEYS.find((j) => j.id === body.journey)) fe.journey = "Choose a journey.";
    else profileData.journey = body.journey;
  }
  if (body.bio !== undefined) {
    const bio = String(body.bio).trim();
    if (bio.length < 80 || bio.length > 600) fe.bio = "Bio must be 80–600 characters.";
    else profileData.bio = bio;
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
      safeAfter: { changed: Object.keys(body) },
    }, rid);
  });

  return ok({ status: "saved" }, rid);
});
