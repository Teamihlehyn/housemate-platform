import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { funnelIdForApplication, recordFunnel } from "@/lib/funnelServer";
import { FLOW_VERSION, cleanSource, isClientEvent, isStep, msBucket, plausibleFunnelId } from "@/lib/funnelEvents";

const MAX_PER_FUNNEL_DAY = 400;
const MAX_SITEWIDE_HOUR = 20000;

// POST /api/v1/funnel {event, step?, index?, flow_version?, ms_on_step?, source?, funnel_id?}
// Step funnel (ENG-58). Allow-listed events and steps only; everything else is dropped quietly.
// No personal data: an anonymous id (the browser's random one, or, with an application session,
// a keyed hash of the application id), the screen id and coarse buckets. Always {status:"ok"}.
export const POST = handler(async (req: NextRequest, { rid }) => {
  const body = await req.json().catch(() => ({}));
  const done = () => ok({ status: "ok" }, rid);
  if (!isClientEvent(body?.event)) return done();
  const step = body.step == null ? null : isStep(body.step) ? body.step : undefined;
  if (step === undefined) return done();
  if (body.event.startsWith("join.step_") && !step) return done();

  const user = await getCurrentUser();
  const app = user ? await prisma.application.findUnique({ where: { userId: user.id }, select: { id: true } }) : null;
  const city = user?.search?.cityId ?? null;
  const funnelId = app ? funnelIdForApplication(app.id) : plausibleFunnelId(body.funnel_id) ? `b-${body.funnel_id}` : null;
  if (!funnelId) return done();

  const since = new Date(Date.now() - 86_400_000);
  const [mine, all] = await Promise.all([
    prisma.funnelEvent.count({ where: { funnelId, createdAt: { gt: since } } }),
    prisma.funnelEvent.count({ where: { createdAt: { gt: new Date(Date.now() - 3_600_000) } } }),
  ]);
  if (mine >= MAX_PER_FUNNEL_DAY || all >= MAX_SITEWIDE_HOUR) return done();

  const index = Number.isInteger(body.index) && body.index >= 0 && body.index < 100 ? body.index : null;
  await recordFunnel({
    funnelId,
    event: body.event,
    step,
    stepIndex: index,
    city,
    source: cleanSource(body.source),
    msBucket: msBucket(body.ms_on_step),
    flowVersion: typeof body.flow_version === "string" && /^v[0-9]{1,3}$/.test(body.flow_version) ? body.flow_version : FLOW_VERSION,
  });
  return done();
});
