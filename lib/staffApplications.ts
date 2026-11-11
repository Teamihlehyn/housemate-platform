import { prisma } from "./db";
import { ApiError } from "./api";
import { CITIES, QUESTIONNAIRE } from "./constants";
import { isCityOpen } from "./env";
import { monthlyEquivalentMinor } from "./money";
import { inviteState } from "./invites";
import { DAY_MS, canStaffRoleAct, missingFields, waitingLabel } from "./applications";
import { completenessInput } from "./applicationService";

// Staff views of applications (ENG-42). Gender and housemate preference are never in these
// DTOs: they come only from the audited reveal route.

const OPEN_FOR_CLUSTER = ["submitted", "in_review", "call_booked", "approved"];

function areaLabel(cityId: string | null, areaId: string): string {
  const city = cityId && cityId in CITIES ? CITIES[cityId as keyof typeof CITIES] : null;
  return city?.areas.find((a) => a.id === areaId)?.label ?? areaId;
}

// Load an application staff may see: not their own (HM-10). Unknown or own → 404.
export async function staffApplication(id: string, staffId: string) {
  const app = await prisma.application.findUnique({ where: { id } });
  if (!app || app.userId === staffId) throw new ApiError("NOT_FOUND", "This application doesn't exist.", 404);
  return app;
}

// Actions are for verifiers and admins. Everyone else gets 404, as if the action didn't exist.
export function requireActingRole(role: string) {
  if (!canStaffRoleAct(role)) throw new ApiError("NOT_FOUND", "Not found.", 404);
}

// D20 cluster hint: how many other people share at least one area with each applicant, split
// into active (published) members and other open applications (submitted, in review, call
// booked or approved but not yet activated). area_matches = members + applicants.
async function clusterCounts(apps: { userId: string; cityId: string | null; areas: string[] }[]) {
  const cities = [...new Set(apps.map((a) => a.cityId).filter(Boolean))] as string[];
  type Counts = { members: number; applicants: number };
  if (!cities.length) return new Map<string, Counts>();
  const others = await prisma.search.findMany({
    where: {
      cityId: { in: cities },
      user: {
        OR: [
          { accountStatus: "active", profile: { publicationStatus: "published" } },
          { accountStatus: "applicant" },
        ],
      },
    },
    select: { userId: true, cityId: true, areas: { select: { areaId: true } }, user: { select: { accountStatus: true } } },
  });
  const openApps = new Set(
    (await prisma.application.findMany({
      where: { status: { in: OPEN_FOR_CLUSTER }, userId: { in: others.map((o) => o.userId) } },
      select: { userId: true },
    })).map((a) => a.userId)
  );
  const counted = others.filter((o) => o.user.accountStatus === "active" || openApps.has(o.userId));
  const out = new Map<string, Counts>();
  for (const a of apps) {
    const mine = new Set(a.areas);
    const near = counted.filter((o) => o.userId !== a.userId && o.cityId === a.cityId && o.areas.some((x) => mine.has(x.areaId)));
    const members = near.filter((o) => o.user.accountStatus === "active").length;
    out.set(a.userId, { members, applicants: near.length - members });
  }
  return out;
}

export async function listApplications(opts: { status: string; city: string | null; area: string | null; staffId: string }) {
  const where: Record<string, unknown> = { userId: { not: opts.staffId } };
  if (opts.status === "declined") {
    where.status = "declined";
    where.reviewedAt = { gt: new Date(Date.now() - 30 * DAY_MS) };
  } else if (opts.status !== "all") where.status = opts.status;
  const apps = await prisma.application.findMany({ where, orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }], take: 300 });
  const users = await prisma.user.findMany({
    where: { id: { in: apps.map((a) => a.userId) } },
    select: { id: true, displayName: true, search: { select: { cityId: true, areas: { select: { areaId: true } } } } },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  let rows = apps.map((a) => {
    const u = byId.get(a.userId);
    return { app: a, name: u?.displayName ?? "", cityId: u?.search?.cityId ?? null, areas: u?.search?.areas.map((x) => x.areaId) ?? [] };
  });
  if (opts.city) rows = rows.filter((r) => r.cityId === opts.city);
  if (opts.area) rows = rows.filter((r) => r.areas.includes(opts.area!));
  const clusters = await clusterCounts(rows.map((r) => ({ userId: r.app.userId, cityId: r.cityId, areas: r.areas })));
  const now = Date.now();
  const applications = rows.map(({ app, name, cityId, areas }) => {
    const since = app.submittedAt ?? app.createdAt;
    const hours = Math.max(0, Math.floor((now - since.getTime()) / 3_600_000));
    const waiting = ["submitted", "in_review", "call_booked"].includes(app.status);
    return {
      id: app.id,
      version: app.version,
      display_name: name || "(no name yet)",
      city: cityId,
      city_open: cityId ? isCityOpen(cityId) : true,
      areas: areas.map((id) => ({ id, label: areaLabel(cityId, id) })),
      status: app.status,
      submitted_at: app.submittedAt,
      call_at: app.callAt,
      waiting_hours: waiting ? hours : null,
      waiting_label: waiting ? waitingLabel(hours) : null,
      cluster: (() => {
        const c = clusters.get(app.userId) ?? { members: 0, applicants: 0 };
        return { area_matches: c.members + c.applicants, members: c.members, applicants: c.applicants };
      })(),
    };
  });
  const grouped = await prisma.application.groupBy({ by: ["status"], where: { userId: { not: opts.staffId } }, _count: true });
  const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count]));
  return { applications, counts };
}

// The full review view: the profile as members would see it, plus the private matching
// fields needed to sanity-check it (city, areas, dates, budget, habits). The email is shown
// to book the call. Gender and preference stay hidden.
export async function applicationDetail(appId: string, viewer: { id: string; role: string }) {
  const app = await staffApplication(appId, viewer.id);
  const { user, input } = await completenessInput(prisma, app.userId);
  const search = await prisma.search.findUnique({ where: { userId: app.userId }, include: { areas: true, preferences: true } });
  const [reviewer, invite] = await Promise.all([
    app.reviewedBy ? prisma.user.findUnique({ where: { id: app.reviewedBy }, select: { displayName: true } }) : null,
    app.activationInviteId ? prisma.invite.findUnique({ where: { id: app.activationInviteId } }) : null,
  ]);
  const cityId = search?.cityId ?? null;
  const period = search?.rentPeriod ?? "month";
  return {
    id: app.id,
    version: app.version,
    status: app.status,
    submitted_at: app.submittedAt,
    waiting_hours: ["submitted", "in_review", "call_booked"].includes(app.status)
      ? Math.max(0, Math.floor((Date.now() - (app.submittedAt ?? app.createdAt).getTime()) / 3_600_000))
      : null,
    call_at: app.callAt,
    reviewed_at: app.reviewedAt,
    reviewed_by: app.reviewedBy ? reviewer?.displayName ?? "Staff" : null,
    id_check_method: app.idCheckMethod,
    own_account: app.ownAccount,
    relationship_note: app.relationshipNote,
    id_check_at: app.idCheckAt,
    decline_reason: app.declineReason,
    reapply_after: app.reapplyAfter,
    account_status: user.accountStatus,
    email: user.email,
    display_name: user.displayName,
    journey: user.profile?.journey ?? null,
    bio: user.profile?.bio ?? null,
    city: cityId,
    city_open: cityId ? isCityOpen(cityId) : true,
    areas: (search?.areas ?? []).map((a) => ({ id: a.areaId, label: areaLabel(cityId, a.areaId) })),
    budget:
      search?.rentMinMinor != null && search?.rentMaxMinor != null
        ? {
            currency: search.currency,
            period,
            min_minor: search.rentMinMinor,
            max_minor: search.rentMaxMinor,
            monthly_min_minor: monthlyEquivalentMinor(search.rentMinMinor, period),
            monthly_max_minor: monthlyEquivalentMinor(search.rentMaxMinor, period),
          }
        : null,
    move_in: search
      ? { mode: search.moveMode, earliest: search.earliestDate, latest: search.latestDate, preferred: search.preferredDate }
      : null,
    stay: search ? { min_months: search.stayMinMonths, max_months: search.stayMaxMonths } : null,
    habits: (search?.preferences ?? []).map((p) => {
      const q = QUESTIONNAIRE.find((x) => x.id === p.dimension);
      const label = (v: string) => q?.values.find((x) => x.id === v)?.label ?? v;
      let accepted: string[] = [];
      try {
        accepted = JSON.parse(p.acceptedValues);
      } catch {
        accepted = [];
      }
      // Dealbreakers: the values this person won't live with (everything not accepted).
      const ruledOut = (q?.values ?? []).filter((v) => !accepted.includes(v.id)).map((v) => v.label);
      return { dimension: p.dimension, label: q?.label ?? p.dimension, own: label(p.ownAnswer), accepted: accepted.map(label), ruled_out: ruledOut };
    }),
    missing: missingFields(input),
    private_hidden: true,
    activation: invite ? { state: inviteState(invite), expires_at: invite.expiresAt } : null,
    can_act: canStaffRoleAct(viewer.role),
  };
}
