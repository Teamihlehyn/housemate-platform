import { createHmac } from "crypto";
import { prisma } from "./db";
import { emailHashSecret } from "./auth";
import { FLOW_VERSION, FunnelEventName, countBucket, daysBucket } from "./funnelEvents";

// Server side of the step funnel (ENG-58). The funnel id for anything after /join step 2 is a
// keyed hash of the application id: stable, but not the id itself and not reversible.
export function funnelIdForApplication(applicationId: string): string | null {
  const secret = emailHashSecret();
  if (!secret) return null;
  return "a-" + createHmac("sha256", secret).update("funnel:" + applicationId).digest("hex").slice(0, 24);
}

export async function recordFunnel(e: {
  funnelId: string | null;
  event: FunnelEventName;
  step?: string | null;
  stepIndex?: number | null;
  city?: string | null;
  source?: string | null;
  msBucket?: string | null;
  countBucket?: string | null;
  daysBucket?: string | null;
  flowVersion?: string;
}): Promise<void> {
  if (!e.funnelId) return;
  try {
    await prisma.funnelEvent.create({
      data: {
        funnelId: e.funnelId,
        event: e.event,
        step: e.step ?? null,
        stepIndex: e.stepIndex ?? null,
        flowVersion: e.flowVersion ?? FLOW_VERSION,
        city: e.city ?? null,
        source: e.source ?? null,
        msBucket: e.msBucket ?? null,
        countBucket: e.countBucket ?? null,
        daysBucket: e.daysBucket ?? null,
      },
    });
  } catch (err) {
    // Analytics never breaks the product.
    console.error("Funnel event not recorded", (err as Error)?.message ?? "unknown");
  }
}

// Lifecycle events, keyed by application.
export async function recordApplicationEvent(
  applicationId: string,
  event: "join.submitted" | "join.email_confirmed" | "application.call_booked" | "application.approved" | "application.activated" | "prefs.deferred_answered",
  extra: { city?: string | null; submittedAt?: Date | null; step?: string | null } = {}
) {
  const days = extra.submittedAt ? (Date.now() - extra.submittedAt.getTime()) / 86_400_000 : null;
  await recordFunnel({
    funnelId: funnelIdForApplication(applicationId),
    event: event as FunnelEventName,
    city: extra.city ?? null,
    step: extra.step ?? null,
    daysBucket: days == null ? null : daysBucket(days),
  });
}

// The first time a user who came through an application sees Discover.
export async function recordFirstDiscover(userId: string, resultCount: number) {
  const app = await prisma.application.findUnique({ where: { userId }, select: { id: true } });
  if (!app) return;
  const funnelId = funnelIdForApplication(app.id);
  if (!funnelId) return;
  if (await prisma.funnelEvent.findFirst({ where: { funnelId, event: "discover.first_viewed" }, select: { id: true } })) return;
  await recordFunnel({ funnelId, event: "discover.first_viewed", countBucket: countBucket(resultCount) });
}
