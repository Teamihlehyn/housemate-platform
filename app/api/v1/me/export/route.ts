import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { computeScore } from "@/lib/credibility";

// GET /api/v1/me/export — the user's own data (data-portability). Own records only.
export const GET = handler(async (_req: NextRequest, { rid }) => {
  const user = await requireUser();
  const full = await prisma.user.findUnique({
    where: { id: user.id },
    include: { profile: true, search: { include: { areas: true, preferences: true } }, checks: true },
  });
  const score = await computeScore(prisma, user.id);
  const feedback = await prisma.testerFeedback.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, page: true, rating: true, message: true },
  });
  // HM-30: what we hold from before the account existed, and the survey emails sent.
  const [accessRequests, invites, surveySends] = await Promise.all([
    prisma.accessRequest.findMany({
      where: { email: user.email },
      select: { name: true, email: true, city: true, area: true, moveInMonth: true, howHeard: true, note: true, status: true, consentVersion: true, createdAt: true, reviewedAt: true },
    }),
    prisma.invite.findMany({
      where: { OR: [{ email: user.email }, { usedByUserId: user.id }] },
      select: { email: true, createdAt: true, expiresAt: true, usedAt: true, revokedAt: true },
    }),
    prisma.auditEvent.findMany({
      where: { eventType: "survey.sent", subjectId: user.id },
      select: { resourceId: true, outcome: true, occurredAt: true },
    }),
  ]);

  const data = {
    exportedAt: new Date().toISOString(),
    account: {
      id: full!.id,
      email: full!.email,
      displayName: full!.displayName,
      phone: full!.phone,
      accountStatus: full!.accountStatus,
      locale: full!.locale,
      createdAt: full!.createdAt,
      privacyConsentAt: full!.privacyConsentAt,
      privacyConsentVersion: full!.privacyConsentVersion,
      surveyOptIn: full!.surveyOptIn,
      surveyOptInAt: full!.surveyOptInAt,
      surveyOptInVersion: full!.surveyOptInVersion,
      unsubscribedAt: full!.unsubscribedAt,
    },
    profile: full!.profile,
    search: full!.search
      ? {
          ...full!.search,
          areas: full!.search.areas.map((a) => a.areaId),
          preferences: full!.search.preferences.map((p) => ({
            dimension: p.dimension,
            ownAnswer: p.ownAnswer,
            acceptedValues: JSON.parse(p.acceptedValues),
          })),
        }
      : null,
    verification: full!.checks.map((c) => ({ category: c.category, status: c.status, points: c.points })),
    credibility: score,
    feedback,
    accessRequests,
    invites,
    surveyEmails: surveySends.map((s) => ({ campaign: s.resourceId, outcome: s.outcome, sentAt: s.occurredAt })),
  };

  return ok({ export: data }, rid);
});
