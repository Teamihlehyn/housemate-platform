import { prisma } from "./db";
import { productAccountWhere } from "./staff";
import { ALGORITHM_VERSION, QUESTIONNAIRE, answerLabel, CITIES, Dimension, gendersCompatible, parseGenderPreference } from "./constants";
import { monthlyEquivalentMinor } from "./money";
import { dateOverlap } from "./dates";
import { computeScore } from "./credibility";
import { IS_BETA, testApprovalsAllowed } from "./env";
import { HabitAnswer, areaMatch, habitCompatible, stayRange } from "./matchRules";

export interface Candidate {
  userId: string;
  displayName: string;
  avatarInitials: string | null;
  cityId: string;
  areas: string[];
  anyArea?: boolean; // ENG-69: "Anywhere in {city}"
  rentMinMonthly: number;
  rentMaxMonthly: number;
  currency: string;
  rentPeriod: string;
  rentMinMinor: number;
  rentMaxMinor: number;
  moveMode: string;
  earliestDate: string | null;
  latestDate: string | null;
  bio: string | null;
  score?: number; // credibility score; omitted in beta, which shows no numbers (ENG-04)
  idChecked?: boolean; // beta: true for team-checked people; false only for test accounts (ENG-67)
  testAccount?: boolean; // ENG-67: approved without the ID call (test environments only)
  rank: number;
  reasons: string[];
  discussTopics: string[];
}

interface Loaded {
  userId: string;
  displayName: string;
  avatarInitials: string | null;
  bio: string | null;
  cityId: string;
  currency: string;
  rentPeriod: string;
  rentMinMinor: number;
  rentMaxMinor: number;
  rentMinMonthly: number;
  rentMaxMonthly: number;
  moveMode: string;
  earliestDate: string | null;
  latestDate: string | null;
  stayMin: number;
  stayMax: number;
  areas: string[];
  anyArea: boolean;
  prefs: Record<string, HabitAnswer>;
  gender: string | null;
  genderAccepts: string[];
  isTest: boolean;
}

async function loadMatchable(userId: string): Promise<Loaded | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      search: { include: { areas: true, preferences: true } },
    },
  });
  if (!user || !user.search || !user.profile) return null;
  const s = user.search;
  if (
    s.cityId == null ||
    s.rentMinMinor == null ||
    s.rentMaxMinor == null ||
    s.rentPeriod == null ||
    s.currency == null
  )
    return null;

  const prefs: Loaded["prefs"] = {};
  for (const p of s.preferences) {
    let accepted: string[] = [];
    try {
      accepted = JSON.parse(p.acceptedValues);
    } catch {
      accepted = [];
    }
    prefs[p.dimension] = { own: p.ownAnswer, accepted, state: (p.state as HabitAnswer["state"]) ?? "some" };
  }
  // Stay not answered yet = open (ENG-57): nobody is dropped for skipping it.
  const stay = stayRange(s.stayMinMonths, s.stayMaxMonths);

  return {
    userId: user.id,
    displayName: user.displayName,
    avatarInitials: user.profile.avatarInitials,
    bio: user.profile.bio,
    cityId: s.cityId,
    currency: s.currency,
    rentPeriod: s.rentPeriod,
    rentMinMinor: Number(s.rentMinMinor),
    rentMaxMinor: Number(s.rentMaxMinor),
    rentMinMonthly: monthlyEquivalentMinor(s.rentMinMinor, s.rentPeriod),
    rentMaxMonthly: monthlyEquivalentMinor(s.rentMaxMinor, s.rentPeriod),
    moveMode: s.moveMode ?? "undecided",
    earliestDate: s.earliestDate,
    latestDate: s.latestDate,
    stayMin: stay.min,
    stayMax: stay.max,
    areas: s.areas.map((a) => a.areaId),
    anyArea: s.anyArea,
    prefs,
    gender: s.gender,
    genderAccepts: parseGenderPreference(s.genderPreference),
    isTest: user.isTestAccount,
  };
}

interface ExclusionSummary {
  narrowFilters: string[];
  excludedCount: number;
}

export interface MatchResult {
  algorithmVersion: string;
  candidates: Candidate[];
  exclusions: ExclusionSummary;
}

// Deterministic ranking. Hard constraints exclude; eligible candidates are scored 0–60.
export async function getRecommendations(viewerId: string): Promise<MatchResult> {
  const viewer = await loadMatchable(viewerId);
  if (!viewer) {
    return { algorithmVersion: ALGORITHM_VERSION, candidates: [], exclusions: { narrowFilters: [], excludedCount: 0 } };
  }

  // Blocks in either direction.
  const blocks = await prisma.block.findMany({
    where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
  });
  const blockedIds = new Set<string>();
  for (const b of blocks) blockedIds.add(b.blockerId === viewerId ? b.blockedId : b.blockerId);

  // Users already in an active household are unavailable.
  const activeMembers = await prisma.membership.findMany({
    // D-R2: only a formed household takes someone out of Discover; pending proposals don't.
    where: { state: "active", household: { state: "active" } },
    select: { userId: true },
  });
  const housedIds = new Set(activeMembers.map((m) => m.userId));

  // User-testing sandboxes: a world only sees itself; shared users never see sandboxes.
  const viewerUser = await prisma.user.findUnique({ where: { id: viewerId }, select: { sandboxWorldId: true } });

  // Candidate pool: published, active searches in the same city.
  const pool = await prisma.user.findMany({
    where: {
      id: { not: viewerId },
      accountStatus: "active",
      // Staff are back-office only: never candidates (role + allowlist, lib/staff.ts).
      ...productAccountWhere(),
      sandboxWorldId: viewerUser?.sandboxWorldId ?? null,
      profile: { publicationStatus: "published" },
      search: { status: "active", cityId: viewer.cityId },
      // Pilot: only team-verified identities are discoverable.
      // (Where test approvals are allowed, never in production: test accounts too, ENG-67.)
      ...(IS_BETA
        ? testApprovalsAllowed()
          ? { OR: [{ checks: { some: { category: "identity", status: "verified" } } }, { isTestAccount: true }] }
          : { checks: { some: { category: "identity", status: "verified" } } }
        : {}),
    },
    include: { profile: true, search: { include: { areas: true, preferences: true } } },
  });

  let excludedCount = 0;
  const reasonsWhyNarrow = new Set<string>();
  const candidates: Candidate[] = [];

  for (const u of pool) {
    if (blockedIds.has(u.id) || housedIds.has(u.id)) continue;
    const c = await loadMatchable(u.id);
    if (!c) continue;

    // Common areas ("Anywhere in {city}" shares an area with everyone in the city, ENG-69)
    const am = areaMatch(viewer, c);
    const commonAreas = am.common;
    if (!am.ok) {
      excludedCount++;
      reasonsWhyNarrow.add("areas");
      continue;
    }

    // Overlapping rent bands (normalised monthly)
    const rentOverlap =
      Math.max(viewer.rentMinMonthly, c.rentMinMonthly) <=
      Math.min(viewer.rentMaxMonthly, c.rentMaxMonthly);
    if (!rentOverlap) {
      excludedCount++;
      reasonsWhyNarrow.add("budget");
      continue;
    }

    // Overlapping stay-duration bands
    const stayOverlap = Math.max(viewer.stayMin, c.stayMin) <= Math.min(viewer.stayMax, c.stayMax);
    if (!stayOverlap) {
      excludedCount++;
      continue;
    }

    // Two-way living deal-breakers. An unanswered own answer can't satisfy someone with
    // deal-breakers on that question (ENG-56/57, lib/matchRules.ts).
    let dealbreakerFail = false;
    for (const q of QUESTIONNAIRE) {
      if (!habitCompatible(viewer.prefs[q.id], c.prefs[q.id], q.id)) {
        dealbreakerFail = true;
        break;
      }
    }
    if (dealbreakerFail) {
      excludedCount++;
      reasonsWhyNarrow.add("habits");
      continue;
    }

    // Housemate gender preference, checked both ways.
    if (!gendersCompatible({ gender: viewer.gender, accepts: viewer.genderAccepts }, { gender: c.gender, accepts: c.genderAccepts })) {
      excludedCount++;
      reasonsWhyNarrow.add("gender preference");
      continue;
    }

    // Date overlap (undecided is unknown, not a wildcard → excluded from active discovery)
    let overlap: { start: string; end: string; days: number } | null = null;
    if (
      viewer.moveMode !== "undecided" &&
      c.moveMode !== "undecided" &&
      viewer.earliestDate &&
      viewer.latestDate &&
      c.earliestDate &&
      c.latestDate
    ) {
      overlap = dateOverlap(viewer.earliestDate, viewer.latestDate, c.earliestDate, c.latestDate);
    }
    if (!overlap) {
      excludedCount++;
      reasonsWhyNarrow.add("dates");
      continue;
    }

    // ---- Scoring ----
    let habitPoints = 0;
    const identicalHabits: Dimension[] = [];
    for (const q of QUESTIONNAIRE) {
      const v = viewer.prefs[q.id];
      const o = c.prefs[q.id];
      if (v && o && v.own != null && v.own === o.own) {
        habitPoints += 6;
        identicalHabits.push(q.id);
      }
    }
    habitPoints = Math.min(36, habitPoints);
    const areaPoints = am.points;
    const datePoints = Math.min(14, overlap.days);
    const rank = habitPoints + areaPoints + datePoints;

    // Explanations: up to three deterministic reasons
    const reasons: string[] = [];
    reasons.push(
      `Shared move-in window ${overlap.start} → ${overlap.end} (${overlap.days} day${overlap.days === 1 ? "" : "s"})`
    );
    const cityCfg = CITIES[viewer.cityId as keyof typeof CITIES];
    const labelOf = (a: string) => cityCfg.areas.find((x) => x.id === a)?.label ?? a;
    const cityName = viewer.cityId === "lagos" ? "Lagos" : viewer.cityId === "london" ? "London" : "the city";
    if (!am.anywhere) reasons.push(`Both want to live in ${commonAreas.map(labelOf).join(", ")}`);
    else if (c.anyArea) reasons.push(`Open to anywhere in ${cityName}`);
    else reasons.push(`Wants to live in ${c.areas.map(labelOf).join(", ")}`);
    if (identicalHabits.length > 0) {
      const first = identicalHabits[0];
      reasons.push(`Same answer on "${answerLabel(first, viewer.prefs[first].own as string)}"`);
    }

    // Discuss topics: differing but mutually accepted habits
    const discussTopics: string[] = [];
    for (const q of QUESTIONNAIRE) {
      const v = viewer.prefs[q.id];
      const o = c.prefs[q.id];
      if (v && o && v.own != null && o.own != null && v.own !== o.own) {
        discussTopics.push(q.label);
      }
    }

    const sb = IS_BETA ? null : await computeScore(prisma, c.userId);

    candidates.push({
      userId: c.userId,
      displayName: c.displayName,
      avatarInitials: c.avatarInitials,
      cityId: c.cityId,
      areas: c.areas,
      anyArea: c.anyArea,
      rentMinMonthly: c.rentMinMonthly,
      rentMaxMonthly: c.rentMaxMonthly,
      currency: c.currency,
      rentPeriod: c.rentPeriod,
      rentMinMinor: c.rentMinMinor,
      rentMaxMinor: c.rentMaxMinor,
      moveMode: c.moveMode,
      earliestDate: c.earliestDate,
      latestDate: c.latestDate,
      bio: c.bio,
      // A test account (ENG-67) was never ID-checked: say so, never "ID checked".
      ...(sb ? { score: sb.score } : c.isTest ? { idChecked: false, testAccount: true } : { idChecked: true }),
      rank,
      reasons: reasons.slice(0, 3),
      discussTopics: discussTopics.slice(0, 3),
    });
  }

  // Sort by points desc, then stable by userId asc (last_active coarse; omitted for determinism here)
  candidates.sort((a, b) => b.rank - a.rank || a.userId.localeCompare(b.userId));

  return {
    algorithmVersion: ALGORITHM_VERSION,
    candidates,
    exclusions: { narrowFilters: [...reasonsWhyNarrow], excludedCount },
  };
}
