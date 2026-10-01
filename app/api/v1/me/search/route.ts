import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { writeAudit, writeOutbox } from "@/lib/audit";
import { CITIES, QUESTIONNAIRE } from "@/lib/constants";
import { testToday, addMonths } from "@/lib/dates";

// PATCH /api/v1/me/search — partial onboarding updates. Stores a search version on change.
export const PATCH = handler(async (req: NextRequest, { rid }) => {
  const user = await requireUser();
  const body = await req.json().catch(() => ({}));
  const search = await prisma.search.findUnique({ where: { userId: user.id } });
  if (!search) return fail("NOT_FOUND", "No search found.", 404, rid);

  const fe: Record<string, string> = {};
  const data: Record<string, unknown> = {};

  if (body.cityId !== undefined) {
    if (!(body.cityId in CITIES)) {
      fe.cityId = "This prototype supports London and Lagos.";
    } else {
      data.cityId = body.cityId;
      data.currency = CITIES[body.cityId as keyof typeof CITIES].currency;
      if (body.rentPeriod === undefined && !search.rentPeriod)
        data.rentPeriod = CITIES[body.cityId as keyof typeof CITIES].defaultPeriod;
    }
  }
  if (body.rentPeriod !== undefined) {
    if (!["month", "year"].includes(body.rentPeriod)) fe.rentPeriod = "Choose month or year.";
    else data.rentPeriod = body.rentPeriod;
  }

  if (body.locationDetail !== undefined) {
    const loc = String(body.locationDetail).trim();
    if (loc.length > 200) fe.locationDetail = "Keep this under 200 characters.";
    else data.locationDetail = loc.length ? loc : null;
  }

  const rentMin = body.rentMinMinor ?? search.rentMinMinor;
  const rentMax = body.rentMaxMinor ?? search.rentMaxMinor;
  if (body.rentMinMinor !== undefined) {
    if (typeof body.rentMinMinor !== "number" || body.rentMinMinor < 100)
      fe.rentMinMinor = "Enter a valid minimum budget.";
    else data.rentMinMinor = body.rentMinMinor;
  }
  if (body.rentMaxMinor !== undefined) {
    if (typeof body.rentMaxMinor !== "number" || body.rentMaxMinor < 100)
      fe.rentMaxMinor = "Enter a valid maximum budget.";
    else data.rentMaxMinor = body.rentMaxMinor;
  }
  if (rentMin != null && rentMax != null && rentMax < rentMin) {
    fe.rentMaxMinor = "Maximum budget must be at least minimum budget.";
  }

  if (body.moveMode !== undefined) {
    if (!["exact", "range", "undecided"].includes(body.moveMode)) fe.moveMode = "Invalid move mode.";
    else data.moveMode = body.moveMode;
  }

  const mode = (data.moveMode ?? search.moveMode) as string | null;
  if (mode && mode !== "undecided") {
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
    if (body.stayMinMonths < 1 || body.stayMinMonths > 24) fe.stayMinMonths = "1–24 months.";
    else data.stayMinMonths = body.stayMinMonths;
  }
  if (body.stayMaxMonths !== undefined) {
    if (body.stayMaxMonths < 1 || body.stayMaxMonths > 36) fe.stayMaxMonths = "1–36 months.";
    else data.stayMaxMonths = body.stayMaxMonths;
  }
  const sMin = (data.stayMinMonths ?? search.stayMinMonths) as number | null;
  const sMax = (data.stayMaxMonths ?? search.stayMaxMonths) as number | null;
  if (sMin != null && sMax != null && sMax < sMin) fe.stayMaxMonths = "Maximum stay must be ≥ minimum.";

  if (Object.keys(fe).length > 0) {
    return fail("VALIDATION", "Please fix the highlighted fields.", 422, rid, { field_errors: fe });
  }

  // Areas
  let areaIds: string[] | undefined;
  if (body.areaIds !== undefined) {
    const city = (data.cityId ?? search.cityId) as string | null;
    const valid = city ? CITIES[city as keyof typeof CITIES].areas.map((a) => a.id) : [];
    areaIds = (body.areaIds as string[]).filter((a) => valid.includes(a)).slice(0, 5);
    if (areaIds.length === 0)
      return fail("VALIDATION", "Choose at least one area.", 422, rid, {
        field_errors: { areaIds: "Choose at least one area." },
      });
  }

  // Preferences
  const prefs = body.preferences as
    | { dimension: string; ownAnswer: string; acceptedValues: string[] }[]
    | undefined;

  const versionChanging =
    Object.keys(data).length > 0 || areaIds !== undefined || prefs !== undefined;

  const result = await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) {
      data.version = search.version + 1;
      await tx.search.update({ where: { userId: user.id }, data });
    }
    if (areaIds !== undefined) {
      await tx.searchArea.deleteMany({ where: { searchId: search.id } });
      await tx.searchArea.createMany({
        data: areaIds.map((a) => ({ searchId: search.id, areaId: a })),
      });
    }
    if (prefs !== undefined) {
      for (const p of prefs) {
        if (!QUESTIONNAIRE.find((q) => q.id === p.dimension)) continue;
        const accepted = Array.isArray(p.acceptedValues) && p.acceptedValues.length > 0
          ? p.acceptedValues
          : [p.ownAnswer];
        await tx.preferenceAnswer.upsert({
          where: { searchId_dimension: { searchId: search.id, dimension: p.dimension } },
          create: {
            searchId: search.id,
            dimension: p.dimension,
            ownAnswer: p.ownAnswer,
            acceptedValues: JSON.stringify(accepted),
          },
          update: { ownAnswer: p.ownAnswer, acceptedValues: JSON.stringify(accepted) },
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
        safeAfter: { changed: Object.keys(body) },
        versionBefore: search.version,
        versionAfter: fresh!.version,
      }, rid);
      await writeOutbox(tx, "search_updated", { userId: user.id, searchVersion: fresh!.version });
    }
    return { version: (await tx.search.findUnique({ where: { userId: user.id } }))!.version };
  });

  return ok({ version: result.version }, rid);
});
