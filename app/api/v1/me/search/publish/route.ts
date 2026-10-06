import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { writeAudit, writeOutbox, notify } from "@/lib/audit";
import { snapshotScore } from "@/lib/credibility";
import { RUBRIC } from "@/lib/constants";
import { IS_BETA } from "@/lib/env";

// POST /api/v1/me/search/publish — server-side completeness + core identity gate.
// Simulated core identity is granted here (demo), producing the 60-point baseline.
export const POST = handler(async (_req: NextRequest, { rid }) => {
  const user = await requireUser();
  const full = await prisma.user.findUnique({
    where: { id: user.id },
    include: { profile: true, search: { include: { areas: true, preferences: true } } },
  });
  const p = full!.profile!;
  const s = full!.search!;

  const missing: string[] = [];
  if (!p.journey) missing.push("journey");
  if (!full!.displayName || full!.displayName.length < 2) missing.push("display name");
  if (!p.bio || p.bio.length < 80) missing.push("bio");
  if (!s.cityId) missing.push("city");
  if (s.areas.length === 0) missing.push("areas");
  if (s.rentMinMinor == null || s.rentMaxMinor == null) missing.push("budget");
  if (!s.moveMode) missing.push("move mode");
  if (s.moveMode !== "undecided" && (!s.earliestDate || !s.latestDate)) missing.push("move-in dates");
  if (s.stayMinMonths == null || s.stayMaxMonths == null) missing.push("stay length");
  if (s.preferences.length < 6) missing.push("living preferences");
  if (!full!.emailVerified) missing.push("verified email");

  if (missing.length > 0) {
    return fail("INCOMPLETE", `Complete these before publishing: ${missing.join(", ")}.`, 422, rid, {
      field_errors: { _: missing.join(", ") },
    });
  }
  if (s.moveMode === "undecided") {
    return fail("UNDECIDED_DATES", "Choose exact or ranged move-in dates before publishing.", 422, rid);
  }

  const result = await prisma.$transaction(async (tx) => {
    // Email control is real (verified via login OTP).
    await tx.verificationCheck.upsert({
      where: { userId_category: { userId: user.id, category: "email" } },
      create: { userId: user.id, category: "email", status: "verified", points: RUBRIC.email },
      update: { status: "verified", points: RUBRIC.email },
    });

    if (IS_BETA) {
      // Pilot: identity (and phone) are confirmed by a human out-of-band, never auto-granted.
      // Create a manual-review request; the user is not discoverable until a verifier approves.
      await tx.verificationCheck.upsert({
        where: { userId_category: { userId: user.id, category: "identity" } },
        create: { userId: user.id, category: "identity", status: "manual_review", points: 0 },
        update: { status: "manual_review", points: 0 },
      });
    } else {
      // Dev/staging demo: simulate core identity so the flow is exercisable.
      await tx.user.update({
        where: { id: user.id },
        data: { adultEligible: true, phoneVerified: true, phone: full!.phone ?? "+447700900000" },
      });
      for (const cat of [
        { category: "identity", points: RUBRIC.identity },
        { category: "phone", points: RUBRIC.phone },
      ]) {
        await tx.verificationCheck.upsert({
          where: { userId_category: { userId: user.id, category: cat.category } },
          create: { userId: user.id, category: cat.category, status: "verified", points: cat.points },
          update: { status: "verified", points: cat.points },
        });
      }
    }

    const bd = await snapshotScore(tx, user.id);

    await tx.profile.update({
      where: { userId: user.id },
      data: { publicationStatus: "published", publishedAt: new Date() },
    });
    await tx.search.update({
      where: { userId: user.id },
      data: { status: "active", version: s.version + 1 },
    });

    await writeAudit(tx, {
      eventType: "profile.published",
      actorId: user.id,
      subjectId: user.id,
      resourceType: "profile",
      resourceId: user.id,
      action: "publish",
      safeAfter: { score: bd.score, pendingIdentity: IS_BETA },
    }, rid);
    await writeOutbox(tx, "profile_published", { userId: user.id, score: bd.score });
    await notify(
      tx,
      user.id,
      "profile_published",
      IS_BETA ? "Profile submitted" : "You're live",
      IS_BETA
        ? "Your profile is saved. Our team will verify your identity before you appear in discovery — we'll email you to arrange a short check."
        : "Your profile is published and discovery is on."
    );
    return bd;
  });

  return ok({ status: "published", pendingIdentity: IS_BETA, credibility: result }, rid);
});
