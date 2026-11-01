// User-testing sandboxes.
//
// Every tester gets a private "world": their own account plus sample housemates
// (isDemoBot) generated to match their search. Users only ever see others in the
// same world, so concurrent testers never collide, and the sample housemates
// respond automatically (lib/demoBots.ts) so every research task can be done solo.

import { Prisma } from "@prisma/client";
import { randomBytes } from "crypto";
import { prisma } from "./db";
import { CITIES, CityId, QUESTIONNAIRE, RUBRIC } from "./constants";
import { addDays, testToday } from "./dates";
import { monthlyEquivalentMinor } from "./money";
import { writeAudit } from "./audit";
import { PERSONAS, PersonaTemplate } from "./personas";

type Tx = Prisma.TransactionClient;
const NAMES: Record<CityId, string[]> = {
  london: ["Maya Patel", "Jonah Reid", "Chloe Bennett", "Kwame Mensah", "Lucia Romero", "Theo Walsh", "Aisha Khan", "Sam Okafor", "Nina Novak", "Rory Doyle"],
  lagos: ["Tolu Adewale", "Ifeoma Obi", "Kemi Lawal", "Emeka Nnaji", "Bisi Ogunleye", "Musa Ibrahim", "Funke Ajayi", "Dayo Coker", "Ngozi Eze", "Seun Bakare"],
};

const BIOS: Record<CityId, string[]> = {
  london: [
    "Product designer who works from home two days a week. Tidy, considerate about noise, and I like to keep bills simple and fair.",
    "Grad teaching assistant. Friendly and clean, enjoy the occasional guest but keep weeknights calm. Always pay on time — happy to put it in writing.",
    "Nurse on rotating shifts, so I'm quiet and respectful of sleep. Looking for someone reliable who wants a written agreement on rent and notice.",
    "Software engineer, cooks a lot, keeps the kitchen spotless. Non-smoker, no pets. Prefer splitting bills equally and giving a month's notice.",
    "Charity worker, warm and organised. Moved twice because flatmates left suddenly, so I'd love clear notice terms this time.",
    "Data analyst, gym most mornings. Tidy, quiet weekdays, sociable weekends. Happy to agree rent split and house rules before we sign.",
  ],
  lagos: [
    "Software developer. Clean, quiet on weekdays, sociable at weekends. Looking to split a two-bed and agree the caution fee and notice up front.",
    "Accountant, calm and neat. I prefer everything documented — rent split, service charge and what happens if someone moves out.",
    "Doctor on rotation. Tidy and considerate, need quiet weeknights. Reliable with payments and happy to agree terms in writing.",
    "Marketing lead. Sociable but respectful, tidy during the week. Had a flatmate leave owing rent before, so clear terms matter to me.",
    "Teacher, warm and organised. Non-smoker, no pets, balanced household. Happy to split the agency fee and caution deposit fairly.",
    "Civil engineer. Easy-going and tidy. Want a housemate who pays on time and gives proper notice — and I'll do the same.",
  ],
};

function rand(n = 4) {
  return randomBytes(n).toString("hex");
}
function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}
function roundUnit(minor: number, currency: string) {
  const unit = currency === "NGN" ? 1_000_000 : 1_000; // ₦10,000 / £10 steps
  return Math.max(unit, Math.round(minor / unit) * unit);
}

async function grantDemoChecks(tx: Tx, userId: string, withReference: boolean) {
  const checks = [
    { category: "identity", points: RUBRIC.identity },
    { category: "email", points: RUBRIC.email },
    { category: "phone", points: RUBRIC.phone },
    ...(withReference ? [{ category: "reference", points: RUBRIC.reference }] : []),
  ];
  for (const c of checks) {
    await tx.verificationCheck.create({ data: { userId, category: c.category, status: "verified", points: c.points } });
  }
  await tx.scoreSnapshot.create({
    data: { userId, score: checks.reduce((s, c) => s + c.points, 0), componentJson: JSON.stringify(checks) },
  });
}

interface SearchShape {
  cityId: CityId;
  currency: string;
  rentMinMinor: number;
  rentMaxMinor: number;
  rentPeriod: string;
  earliestDate: string;
  latestDate: string;
  stayMinMonths: number;
  stayMaxMonths: number;
  areas: string[];
  prefs: Record<string, { own: string; accepted: string[] }>;
}

async function loadSearchShape(tx: Tx, userId: string): Promise<SearchShape | null> {
  const s = await tx.search.findUnique({ where: { userId }, include: { areas: true, preferences: true } });
  if (
    !s || !s.cityId || !s.currency || s.rentMinMinor == null || s.rentMaxMinor == null || !s.rentPeriod ||
    !s.earliestDate || !s.latestDate || s.stayMinMonths == null || s.stayMaxMonths == null
  ) return null;
  const prefs: SearchShape["prefs"] = {};
  for (const p of s.preferences) prefs[p.dimension] = { own: p.ownAnswer, accepted: JSON.parse(p.acceptedValues) };
  return {
    cityId: s.cityId as CityId,
    currency: s.currency,
    rentMinMinor: s.rentMinMinor,
    rentMaxMinor: s.rentMaxMinor,
    rentPeriod: s.rentPeriod,
    earliestDate: s.earliestDate,
    latestDate: s.latestDate,
    stayMinMonths: s.stayMinMonths,
    stayMaxMonths: s.stayMaxMonths,
    areas: s.areas.map((a) => a.areaId),
    prefs,
  };
}

// Create `count` sample housemates in the owner's world, built to match their search:
// overlapping dates, a shared area, an overlapping budget and habits they accept.
export async function generateCounterparts(tx: Tx, ownerId: string, count = 6): Promise<string[]> {
  const t = await loadSearchShape(tx, ownerId);
  if (!t) return [];
  const existing = await tx.user.count({ where: { sandboxWorldId: ownerId, isDemoBot: true } });
  const cityAreas = CITIES[t.cityId].areas.map((a) => a.id);
  const names = NAMES[t.cityId];
  const bios = BIOS[t.cityId];
  const offset = Math.floor(Math.random() * names.length);
  const today = testToday();
  const ids: string[] = [];

  for (let k = 0; k < count; k++) {
    const i = existing + k;
    const name = names[(offset + i) % names.length];
    const areas = [...new Set([t.areas[i % t.areas.length], cityAreas[(i + 2) % cityAreas.length]])];

    // Budget band that always overlaps the owner's band.
    const rentMin = roundUnit(t.rentMinMinor * (0.8 + 0.05 * (i % 3)), t.currency);
    const rentMax = Math.max(rentMin, roundUnit(t.rentMaxMinor * (1 + 0.05 * (i % 3)), t.currency));

    // Move-in window that always overlaps the owner's window.
    let earliest = addDays(t.earliestDate, -4 * (i % 3));
    if (earliest < today) earliest = today;
    const latest = addDays(t.latestDate, 6 * (i % 4));

    // Habits the owner accepts; vary some so ranking and "discuss" topics differ.
    const prefsCreate = QUESTIONNAIRE.map((q, d) => {
      const tp = t.prefs[q.id];
      const accepted = tp?.accepted?.length ? tp.accepted : q.values.map((v) => v.id);
      const base = tp && accepted.includes(tp.own) ? tp.own : accepted[0];
      const alt = accepted.find((v) => v !== base);
      const own = (i + d) % 3 === 0 && alt ? alt : base;
      return { dimension: q.id, ownAnswer: own, acceptedValues: JSON.stringify(q.values.map((v) => v.id)) };
    });

    const user = await tx.user.create({
      data: {
        email: `sample-${rand()}@sandbox.housemate.test`,
        emailVerified: true,
        phone: "+447700900000",
        phoneVerified: true,
        displayName: name,
        adultEligible: true,
        isDemoBot: true,
        sandboxWorldId: ownerId,
        profile: {
          create: {
            journey: i % 5 === 4 ? "candidate_home" : "find_together",
            bio: bios[i % bios.length],
            avatarInitials: initials(name),
            publicationStatus: "published",
            publishedAt: new Date(),
          },
        },
        search: {
          create: {
            status: "active",
            cityId: t.cityId,
            currency: t.currency,
            rentMinMinor: rentMin,
            rentMaxMinor: rentMax,
            rentPeriod: t.rentPeriod,
            moveMode: "range",
            earliestDate: earliest,
            latestDate: latest,
            preferredDate: earliest,
            stayMinMonths: Math.max(1, t.stayMinMonths - (i % 2)),
            stayMaxMonths: Math.min(36, t.stayMaxMonths + 3 * (i % 3)),
            areas: { create: areas.map((a) => ({ areaId: a })) },
            preferences: { create: prefsCreate },
          },
        },
      },
    });
    await grantDemoChecks(tx, user.id, i % 2 === 0);
    ids.push(user.id);
  }
  return ids;
}

// Give an existing account its own private world (research email sign-ups).
export async function ensureSandboxWorld(tx: Tx, userId: string) {
  const u = await tx.user.findUnique({ where: { id: userId } });
  if (!u || u.sandboxWorldId) return;
  await tx.user.update({ where: { id: userId }, data: { sandboxWorldId: userId } });
  await generateCounterparts(tx, userId, 6);
}

// Top up a world whose owner has too few matches (e.g. after editing dates).
export async function topUpWorld(ownerId: string, currentMatches: number): Promise<boolean> {
  if (currentMatches >= 3) return false;
  const bots = await prisma.user.count({ where: { sandboxWorldId: ownerId, isDemoBot: true } });
  if (bots >= 18) return false;
  await prisma.$transaction((tx) => generateCounterparts(tx, ownerId, 4), { timeout: 20000 });
  return true;
}

// Create a fresh, private tester account from a persona, with its own world.
export async function createPersonaAccount(
  personaKey: string,
  opts: { consent: boolean; rid?: string }
): Promise<{ userId: string; next: string } | null> {
  const p = PERSONAS.find((x) => x.key === personaKey);
  if (!p) return null;
  const city = CITIES[p.city];
  const earliest = addDays(testToday(), p.startInDays);
  const latest = addDays(earliest, p.windowDays);

  return prisma.$transaction(
    async (tx) => {
      const user = await tx.user.create({
        data: {
          email: `demo-${p.key}-${rand()}@sandbox.housemate.test`,
          emailVerified: true,
          phone: "+447700900000",
          phoneVerified: true,
          displayName: p.name,
          adultEligible: true,
          privacyConsentAt: opts.consent ? new Date() : null,
          privacyConsentVersion: opts.consent ? "privacy-v1" : null,
          profile: {
            create: {
              journey: p.journey,
              bio: p.bio,
              avatarInitials: initials(p.name),
              publicationStatus: "published",
              publishedAt: new Date(),
            },
          },
          search: {
            create: {
              status: "active",
              cityId: p.city,
              currency: city.currency,
              rentMinMinor: p.rentMinMinor,
              rentMaxMinor: p.rentMaxMinor,
              rentPeriod: p.period,
              moveMode: "range",
              earliestDate: earliest,
              latestDate: latest,
              preferredDate: earliest,
              stayMinMonths: p.stayMin,
              stayMaxMonths: p.stayMax,
              areas: { create: p.areas.map((a) => ({ areaId: a })) },
              preferences: {
                create: QUESTIONNAIRE.map((q) => ({
                  dimension: q.id,
                  ownAnswer: p.habits[q.id],
                  acceptedValues: JSON.stringify(q.values.map((v) => v.id)),
                })),
              },
            },
          },
        },
      });
      await tx.user.update({ where: { id: user.id }, data: { sandboxWorldId: user.id } });
      await grantDemoChecks(tx, user.id, false);
      const bots = await generateCounterparts(tx, user.id, 6);

      let next = "/discover";
      if (p.inProgress && bots[0]) {
        await seedHouseholdInProgress(tx, user.id, bots[0], p);
        next = "/household";
      }

      await writeAudit(tx, {
        eventType: "research.persona_started",
        actorType: "service",
        actorId: user.id,
        subjectId: user.id,
        resourceType: "user",
        resourceId: user.id,
        action: "create_persona",
        safeAfter: { persona: p.key },
      }, opts.rid);
      return { userId: user.id, next };
    },
    { timeout: 20000 }
  );
}

// A household already formed with a sample housemate, so tasks 4–5 are one click away.
async function seedHouseholdInProgress(tx: Tx, testerId: string, botId: string, p: PersonaTemplate) {
  const [low, high] = testerId < botId ? [testerId, botId] : [botId, testerId];
  const bot = await tx.user.findUnique({ where: { id: botId }, include: { search: true } });
  const intro = await tx.introduction.create({
    data: {
      lowUserId: low,
      highUserId: high,
      senderId: testerId,
      state: "accepted",
      text: "Hi! Our dates and areas line up really well — want to look for a place together?",
      expiresAt: new Date(Date.now() + 7 * 86400000),
    },
  });
  const lines: [string, string][] = [
    [testerId, "Hi! Our dates and areas line up really well — want to look for a place together?"],
    [botId, "Definitely! Before we look at homes, can we agree the rent split, bills and notice period in the household plan? (I'm a sample housemate, so my replies are automatic.)"],
    [testerId, "Good idea — let's set it up."],
  ];
  const convo = await tx.conversation.create({
    data: { introductionId: intro.id, userAId: low, userBId: high, lastSequence: lines.length },
  });
  for (let n = 0; n < lines.length; n++) {
    await tx.message.create({
      data: {
        conversationId: convo.id,
        senderId: lines[n][0],
        clientMessageId: `seed-${convo.id}-${n + 1}`,
        serverSequence: n + 1,
        body: lines[n][1],
      },
    });
  }

  const s = await tx.search.findUnique({ where: { userId: testerId } });
  const testerMonthly = monthlyEquivalentMinor(p.rentMaxMinor, p.period);
  const botMonthly = bot?.search?.rentMaxMinor && bot.search.rentPeriod
    ? monthlyEquivalentMinor(bot.search.rentMaxMinor, bot.search.rentPeriod)
    : testerMonthly;
  const hh = await tx.household.create({
    data: {
      state: "active",
      derivedStage: "planning",
      introductionId: intro.id,
      formedAt: new Date(),
      memberships: { create: [{ userId: testerId }, { userId: botId }] },
    },
  });
  const plan = await tx.householdPlan.create({
    data: {
      householdId: hh.id,
      versionNo: 1,
      earliestDate: s!.earliestDate!,
      latestDate: s!.latestDate!,
      contributions: JSON.stringify({ [testerId]: testerMonthly, [botId]: botMonthly }),
      currency: s!.currency!,
      stayMin: p.stayMin,
      stayMax: p.stayMax,
      noticePeriodWeeks: 4,
      billsSplit: "equal",
    },
  });
  await tx.planAcceptance.createMany({ data: [{ planId: plan.id, userId: testerId }, { planId: plan.id, userId: botId }] });
  await tx.search.updateMany({ where: { userId: { in: [testerId, botId] } }, data: { status: "paused" } });

  // One sample home already shortlisted; the sample housemate likes it.
  const home = await tx.property.findFirst({ where: { cityId: p.city, state: "available" }, orderBy: { rentMinor: "asc" } });
  if (home) {
    await tx.shortlistItem.create({
      data: {
        householdId: hh.id,
        propertyId: home.id,
        title: home.title,
        area: home.areaId,
        votes: { create: { userId: botId, decision: "interested" } },
      },
    });
  }
  await tx.notification.create({
    data: {
      recipientId: testerId,
      eventName: "household_formed",
      title: "You're in a household",
      body: `You and ${bot?.displayName} formed a household. Agree your rent split and notice, then find a home.`,
    },
  });
}
