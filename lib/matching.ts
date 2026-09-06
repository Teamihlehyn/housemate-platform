import { prisma } from "./db";
import { ALGORITHM_VERSION, QUESTIONNAIRE, answerLabel, CITIES, Dimension } from "./constants";
import { monthlyEquivalentMinor } from "./money";
import { dateOverlap } from "./dates";
import { computeScore } from "./credibility";

export interface Candidate {
  userId: string;
  displayName: string;
  avatarInitials: string | null;
  cityId: string;
  areas: string[];
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
  score: number;
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
  prefs: Record<string, { own: string; accepted: string[] }>;
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
    s.currency == null ||
    s.stayMinMonths == null ||
    s.stayMaxMonths == null
  )
    return null;

  const prefs: Loaded["prefs"] = {};
  for (const p of s.preferences) {
    prefs[p.dimension] = { own: p.ownAnswer, accepted: JSON.parse(p.acceptedValues) };
  }

  return {
    userId: user.id,
    displayName: user.displayName,
    avatarInitials: user.profile.avatarInitials,
    bio: user.profile.bio,
    cityId: s.cityId,
    currency: s.currency,
    rentPeriod: s.rentPeriod,
    rentMinMinor: s.rentMinMinor,
    rentMaxMinor: s.rentMaxMinor,
    rentMinMonthly: monthlyEquivalentMinor(s.rentMinMinor, s.rentPeriod),
    rentMaxMonthly: monthlyEquivalentMinor(s.rentMaxMinor, s.rentPeriod),
    moveMode: s.moveMode ?? "undecided",
    earliestDate: s.earliestDate,
    latestDate: s.latestDate,
    stayMin: s.stayMinMonths,
    stayMax: s.stayMaxMonths,
    areas: s.areas.map((a) => a.areaId),
    prefs,
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
    where: { state: "active", household: { state: { in: ["proposed", "active"] } } },
    select: { userId: true },
  });
  const housedIds = new Set(activeMembers.map((m) => m.userId));

  // Candidate pool: published, active searches in the same city.
  const pool = await prisma.user.findMany({
    where: {
      id: { not: viewerId },
      accountStatus: "active",
      role: "member",
      profile: { publicationStatus: "published" },
      search: { status: "active", cityId: viewer.cityId },
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

    // Common areas
    const commonAreas = c.areas.filter((a) => viewer.areas.includes(a));
    if (commonAreas.length === 0) {
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

    // Two-way living dealbreakers
    let dealbreakerFail = false;
    for (const q of QUESTIONNAIRE) {
      const v = viewer.prefs[q.id];
      const o = c.prefs[q.id];
      if (!v || !o) continue;
      if (!o.accepted.includes(v.own) || !v.accepted.includes(o.own)) {
        dealbreakerFail = true;
        break;
      }
    }
    if (dealbreakerFail) {
      excludedCount++;
      reasonsWhyNarrow.add("habits");
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
      if (v && o && v.own === o.own) {
        habitPoints += 6;
        identicalHabits.push(q.id);
      }
    }
    habitPoints = Math.min(36, habitPoints);
    const areaPoints = Math.min(10, commonAreas.length * 2);
    const datePoints = Math.min(14, overlap.days);
    const rank = habitPoints + areaPoints + datePoints;

    // Explanations: up to three deterministic reasons
    const reasons: string[] = [];
    reasons.push(
      `Shared move-in window ${overlap.start} → ${overlap.end} (${overlap.days} day${overlap.days === 1 ? "" : "s"})`
    );
    const areaLabels = commonAreas
      .map((a) => CITIES[viewer.cityId as keyof typeof CITIES].areas.find((x) => x.id === a)?.label ?? a)
      .join(", ");
    reasons.push(`Both want to live in ${areaLabels}`);
    if (identicalHabits.length > 0) {
      const first = identicalHabits[0];
      reasons.push(`Same answer on "${answerLabel(first, viewer.prefs[first].own)}"`);
    }

    // Discuss topics: differing but mutually accepted habits
    const discussTopics: string[] = [];
    for (const q of QUESTIONNAIRE) {
      const v = viewer.prefs[q.id];
      const o = c.prefs[q.id];
      if (v && o && v.own !== o.own) {
        discussTopics.push(q.label);
      }
    }

    const sb = await computeScore(prisma, c.userId);

    candidates.push({
      userId: c.userId,
      displayName: c.displayName,
      avatarInitials: c.avatarInitials,
      cityId: c.cityId,
      areas: c.areas,
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
      score: sb.score,
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

export async function pairKey(a: string, b: string): Promise<[string, string]> {
  return a < b ? [a, b] : [b, a];
}
