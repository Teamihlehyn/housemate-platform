import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireAccount } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { writeAudit, writeOutbox } from "@/lib/audit";
import { CITIES, GENDER_IDS, OWN_GENDER_OPTIONS, QUESTIONNAIRE } from "@/lib/constants";
import { testToday, addMonths } from "@/lib/dates";
import { assertAnswersEditable, isNameLocked } from "@/lib/applicationService";
import { preferenceRow } from "@/lib/matchRules";
import { areaLabels, areasChip, budgetChip, datesChip } from "@/lib/searchChips";
import { requireUser } from "@/lib/guard";
import { recordApplicationEvent } from "@/lib/funnelServer";
import { budgetError, isDateInput, monthsError } from "@/lib/searchInput";

// GET /api/v1/me/search — what the Discover chips show and the edit sheet edits (ENG-59): areas
// (within the city, which is locked once approved), budget and move-in window, with labels.
export const GET = handler(async (_req: NextRequest, { rid }) => {
  const user = await requireUser();
  const s = await prisma.search.findUnique({ where: { userId: user.id }, include: { areas: true } });
  if (!s) return fail("NOT_FOUND", "No search found.", 404, rid);
  const cityId = s.cityId;
  const areas = areaLabels(cityId, s.areas.map((a) => a.areaId));
  const options = cityId && cityId in CITIES ? CITIES[cityId as keyof typeof CITIES].areas.map((a) => ({ id: a.id, label: a.label })) : [];
  const budget =
    s.rentMinMinor != null && s.rentMaxMinor != null && s.currency && s.rentPeriod
      ? { min_minor: Number(s.rentMinMinor), max_minor: Number(s.rentMaxMinor), period: s.rentPeriod, currency: s.currency }
      : null;
  return ok(
    {
      city: cityId,
      city_locked: await isNameLocked(user.id),
      areas,
      any_area: s.anyArea, // ENG-69
      area_options: options,
      budget,
      move_in: { mode: s.moveMode, earliest: s.earliestDate, latest: s.latestDate },
      chips: {
        areas: areasChip(areas, s.anyArea ? { cityId } : undefined),
        budget: budget ? budgetChip(budget.min_minor, budget.max_minor, budget.currency, budget.period) : null,
        dates: datesChip(s.moveMode, s.earliestDate, s.latestDate),
      },
    },
    rid
  );
});

// Audit hygiene: the field names PATCH accepts; anything else a client sends isn't logged.
const SEARCH_FIELDS = [
  "cityId", "rentPeriod", "gender", "genderPreference", "locationDetail", "rentMinMinor", "rentMaxMinor",
  "moveMode", "earliestDate", "latestDate", "preferredDate", "stayMinMonths", "stayMaxMonths", "anyArea", "areaIds", "preferences",
];

// PATCH /api/v1/me/search — partial onboarding updates. Stores a search version on change.
export const PATCH = handler(async (req: NextRequest, { rid }) => {
  const user = await requireAccount();
  const raw = await req.json().catch(() => ({}));
  // HM-55: malformed input is a 422, never a 500.
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return fail("VALIDATION", "Send the changes as a JSON object.", 422, rid);
  const body = raw as Record<string, any>;
  const DEFERRED_KEYS = ["preferences", "stayMinMonths", "stayMaxMonths"];
  const deferredOnly = !!body && typeof body === "object" && Object.keys(body).length > 0 && Object.keys(body).every((k) => DEFERRED_KEYS.includes(k));
  await assertAnswersEditable(user, { deferredOnly });
  const search = await prisma.search.findUnique({ where: { userId: user.id } });
  if (!search) return fail("NOT_FOUND", "No search found.", 404, rid);

  const fe: Record<string, string> = {};
  const data: Record<string, unknown> = {};

  // City lock (R5, ENG-46): after approval the city was part of what staff checked, so it
  // can't change here. Areas within the same city stay editable.
  if (body.cityId !== undefined && search.cityId && body.cityId !== search.cityId && (await isNameLocked(user.id))) {
    return fail("VALIDATION", "Your city is fixed once you're approved. Email hello@peabudy.com if you're moving city.", 422, rid, {
      field_errors: { cityId: "Your city is fixed once you're approved." },
    });
  }
  if (body.cityId !== undefined) {
    if (!(body.cityId in CITIES)) {
      fe.cityId = "This prototype supports London and Lagos.";
    } else {
      data.cityId = body.cityId;
      data.currency = CITIES[body.cityId as keyof typeof CITIES].currency;
      // ENG-69: a different city resets "anywhere" (and the old city's areas below).
      if (search.cityId && body.cityId !== search.cityId) data.anyArea = false;
      if (body.rentPeriod === undefined && !search.rentPeriod)
        data.rentPeriod = CITIES[body.cityId as keyof typeof CITIES].defaultPeriod;
    }
  }
  if (body.rentPeriod !== undefined) {
    if (!["month", "year"].includes(body.rentPeriod)) fe.rentPeriod = "Choose month or year.";
    else data.rentPeriod = body.rentPeriod;
  }

  if (body.gender !== undefined) {
    if (body.gender !== null && !OWN_GENDER_OPTIONS.some((g) => g.id === body.gender)) fe.gender = "Choose an option.";
    else data.gender = body.gender;
  }
  if (body.genderPreference !== undefined) {
    const pref = Array.isArray(body.genderPreference)
      ? [...new Set((body.genderPreference as string[]).filter((g) => GENDER_IDS.includes(g)))]
      : [];
    if (pref.length === 0) fe.genderPreference = "Choose at least one.";
    else data.genderPreference = JSON.stringify(GENDER_IDS.filter((g) => pref.includes(g)));
  }

  if (body.locationDetail !== undefined) {
    const loc = String(body.locationDetail).trim();
    if (loc.length > 200) fe.locationDetail = "Keep this under 200 characters.";
    else data.locationDetail = loc.length ? loc : null;
  }

  // HM-55: whole minor units only, capped per currency (the columns are BigInt).
  const currency = (data.currency ?? search.currency) as string | null;
  if (body.rentMinMinor !== undefined) {
    const e = budgetError(body.rentMinMinor, currency, "min");
    if (e) fe.rentMinMinor = e;
    else data.rentMinMinor = body.rentMinMinor;
  }
  if (body.rentMaxMinor !== undefined) {
    const e = budgetError(body.rentMaxMinor, currency, "max");
    if (e) fe.rentMaxMinor = e;
    else data.rentMaxMinor = body.rentMaxMinor;
  }
  const rentMin = fe.rentMinMinor ? null : body.rentMinMinor ?? (search.rentMinMinor == null ? null : Number(search.rentMinMinor));
  const rentMax = fe.rentMaxMinor ? null : body.rentMaxMinor ?? (search.rentMaxMinor == null ? null : Number(search.rentMaxMinor));
  if (rentMin != null && rentMax != null && rentMax < rentMin) {
    fe.rentMaxMinor = "Maximum budget must be at least minimum budget.";
  }

  if (body.moveMode !== undefined) {
    if (!["exact", "range", "undecided"].includes(body.moveMode)) fe.moveMode = "Invalid move mode.";
    else data.moveMode = body.moveMode;
  }

  for (const k of ["earliestDate", "latestDate", "preferredDate"] as const) {
    if (body[k] !== undefined && !isDateInput(body[k])) fe[k] = "Choose a date.";
  }

  const mode = (data.moveMode ?? search.moveMode) as string | null;
  if (Object.keys(fe).length > 0) {
    // stop before the date logic reads malformed values
  } else if (mode && mode !== "undecided") {
    const today = testToday();
    const maxDate = addMonths(today, 18);
    let earliest = body.earliestDate ?? search.earliestDate;
    let latest = body.latestDate ?? search.latestDate;
    const preferred = body.preferredDate ?? search.preferredDate;

    if (mode === "exact") {
      const d = body.earliestDate ?? body.preferredDate ?? earliest;
      earliest = d;
      latest = d;
      data.preferredDate = d;
    } else {
      if (body.preferredDate !== undefined) data.preferredDate = body.preferredDate;
    }

    if (body.earliestDate !== undefined || mode === "exact") data.earliestDate = earliest;
    if (body.latestDate !== undefined || mode === "exact") data.latestDate = latest;

    if (earliest && earliest < today) fe.earliestDate = "Earliest date cannot be in the past.";
    if (latest && latest > maxDate) fe.latestDate = "Latest date must be within 18 months.";
    if (earliest && latest && latest < earliest)
      fe.latestDate = "Choose your latest acceptable move-in date after the earliest.";
    if (mode === "range" && preferred && earliest && latest && (preferred < earliest || preferred > latest))
      fe.preferredDate = "Preferred date must lie within your range.";
  } else if (mode === "undecided") {
    data.earliestDate = null;
    data.latestDate = null;
    data.preferredDate = null;
  }

  if (body.stayMinMonths !== undefined) {
    const e = monthsError(body.stayMinMonths, 24);
    if (e) fe.stayMinMonths = e;
    else data.stayMinMonths = body.stayMinMonths;
  }
  if (body.stayMaxMonths !== undefined) {
    const e = monthsError(body.stayMaxMonths, 36);
    if (e) fe.stayMaxMonths = e;
    else data.stayMaxMonths = body.stayMaxMonths;
  }
  const sMin = (data.stayMinMonths ?? search.stayMinMonths) as number | null;
  const sMax = (data.stayMaxMonths ?? search.stayMaxMonths) as number | null;
  if (sMin != null && sMax != null && sMax < sMin) fe.stayMaxMonths = "Maximum stay must be ≥ minimum.";

  if (Object.keys(fe).length > 0) {
    return fail("VALIDATION", "Please fix the highlighted fields.", 422, rid, { field_errors: fe });
  }

  // Areas. ENG-69: "Anywhere in {city}" (anyArea: true) is exclusive with specific areas:
  // choosing it clears them, choosing areas clears it.
  let areaIds: string[] | undefined;
  if (body.anyArea !== undefined && typeof body.anyArea !== "boolean") {
    return fail("VALIDATION", "Please fix the highlighted fields.", 422, rid, { field_errors: { anyArea: "Must be true or false." } });
  }
  if (body.areaIds !== undefined && (!Array.isArray(body.areaIds) || !body.areaIds.every((a: unknown) => typeof a === "string"))) {
    return fail("VALIDATION", "Please fix the highlighted fields.", 422, rid, { field_errors: { areaIds: "Send a list of areas." } });
  }
  const wantsAreas = Array.isArray(body.areaIds) && body.areaIds.length > 0;
  // Turning "Anywhere" off needs the areas that replace it, in the same request.
  if (body.anyArea === false && !wantsAreas) {
    return fail("VALIDATION", "To turn off “Anywhere”, choose at least one area.", 422, rid, {
      field_errors: { areaIds: "To turn off “Anywhere”, choose at least one area." },
    });
  }
  if (body.anyArea === true && wantsAreas) {
    return fail("VALIDATION", "Choose “Anywhere” or specific areas, not both.", 422, rid, {
      field_errors: { areaIds: "Choose “Anywhere” or specific areas, not both." },
    });
  }
  if (body.anyArea === true) {
    if (!(data.cityId ?? search.cityId)) {
      return fail("VALIDATION", "Choose a city first.", 422, rid, { field_errors: { cityId: "Choose a city first." } });
    }
    data.anyArea = true;
    areaIds = [];
  } else if (body.areaIds !== undefined) {
    const city = (data.cityId ?? search.cityId) as string | null;
    const valid = city ? CITIES[city as keyof typeof CITIES].areas.map((a) => a.id) : [];
    areaIds = (body.areaIds as string[]).filter((a) => valid.includes(a)).slice(0, 5);
    if (areaIds.length === 0)
      return fail("VALIDATION", "Choose at least one area, or “Anywhere”.", 422, rid, {
        field_errors: { areaIds: "Choose at least one area, or “Anywhere”." },
      });
    data.anyArea = false;
  } else if (data.cityId && search.cityId && data.cityId !== search.cityId) {
    areaIds = []; // the old city's areas don't apply in the new one
  }

  // Preferences
  // Living habits (D-R4, ENG-56): {dimension, ownAnswer?, dealBreakers?, noDealBreakers?} or the
  // legacy {dimension, ownAnswer, acceptedValues}. Nothing is pre-selected here.
  let prefs: { dimension: string; ownAnswer: string | null; acceptedValues: string[]; state: string }[] | undefined;
  if (body.preferences !== undefined) {
    if (!Array.isArray(body.preferences)) {
      return fail("VALIDATION", "Please fix the highlighted fields.", 422, rid, { field_errors: { preferences: "Send a list of answers." } });
    }
    prefs = [];
    for (const item of body.preferences) {
      const r = preferenceRow(item ?? {});
      if (!r.ok) {
        const dim = typeof item?.dimension === "string" ? item.dimension : "preferences";
        return fail("VALIDATION", r.error, 422, rid, { field_errors: { [`preferences.${dim}`]: r.error } });
      }
      prefs.push(r.row);
    }
  }

  const versionChanging =
    Object.keys(data).length > 0 || areaIds !== undefined || prefs !== undefined;

  const result = await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) {
      data.version = search.version + 1;
      await tx.search.update({ where: { userId: user.id }, data });
    }
    if (areaIds !== undefined) {
      await tx.searchArea.deleteMany({ where: { searchId: search.id } });
      if (areaIds.length) await tx.searchArea.createMany({
        data: areaIds.map((a) => ({ searchId: search.id, areaId: a })),
      });
    }
    if (prefs !== undefined) {
      for (const p of prefs) {
        await tx.preferenceAnswer.upsert({
          where: { searchId_dimension: { searchId: search.id, dimension: p.dimension } },
          create: { searchId: search.id, dimension: p.dimension, ownAnswer: p.ownAnswer, acceptedValues: JSON.stringify(p.acceptedValues), state: p.state },
          update: { ownAnswer: p.ownAnswer, acceptedValues: JSON.stringify(p.acceptedValues), state: p.state },
        });
      }
    }

    if (versionChanging) {
      const fresh = await tx.search.findUnique({
        where: { userId: user.id },
        include: { areas: true, preferences: true },
      });
      await tx.searchVersion.create({
        data: {
          searchId: search.id,
          versionNo: fresh!.version,
          snapshot: JSON.stringify({
            cityId: fresh!.cityId,
            areas: fresh!.areas.map((a) => a.areaId),
            anyArea: fresh!.anyArea,
            rentMinMinor: fresh!.rentMinMinor,
            rentMaxMinor: fresh!.rentMaxMinor,
            rentPeriod: fresh!.rentPeriod,
            moveMode: fresh!.moveMode,
            earliestDate: fresh!.earliestDate,
            latestDate: fresh!.latestDate,
            stayMinMonths: fresh!.stayMinMonths,
            stayMaxMonths: fresh!.stayMaxMonths,
          }),
        },
      });
      await writeAudit(tx, {
        eventType: "search.updated",
        actorId: user.id,
        subjectId: user.id,
        resourceType: "search",
        resourceId: search.id,
        action: "patch",
        safeAfter: { changed: Object.keys(body).filter((k) => SEARCH_FIELDS.includes(k)) },
        versionBefore: search.version,
        versionAfter: fresh!.version,
      }, rid);
      await writeOutbox(tx, "search_updated", { userId: user.id, searchVersion: fresh!.version });
    }
    // HM-36: an applicant's edit changes what staff would approve, so it moves the
    // application's version too (a stale approval then gets 409).
    if (user.accountStatus === "applicant" && !deferredOnly) {
      await tx.application.updateMany({ where: { userId: user.id }, data: { version: { increment: 1 } } });
    }
    return { version: (await tx.search.findUnique({ where: { userId: user.id } }))!.version };
  });

  // Funnel (ENG-58): "better first matches" answers, anonymous.
  if (deferredOnly) {
    const app = await prisma.application.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (app) {
      for (const p of prefs ?? []) if (p.ownAnswer) await recordApplicationEvent(app.id, "prefs.deferred_answered", { step: `h:${p.dimension}` });
      if (body.stayMinMonths !== undefined) await recordApplicationEvent(app.id, "prefs.deferred_answered", { step: "stay" });
    }
  }
  return ok({ version: result.version }, rid);
});
