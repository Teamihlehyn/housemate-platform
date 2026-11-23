"use client";

// The profile answers behind /join, /onboarding and the /profile editors, with one save per
// screen. Same data contract as before: PATCH /me/profile and PATCH /me/search (the server
// accepts partial updates and validates again). Nothing here decides matching.

import { useCallback, useState } from "react";
import { api, ApiClientError } from "@/lib/client";
import { CITIES, GENDER_IDS, QUESTIONNAIRE, CityId, Dimension } from "@/lib/constants";
import { afterEarliestChange, latestMin as latestMinOf, rangeError } from "@/lib/dateRange";
import { trackFunnel } from "@/lib/funnel";
import type { SaveState } from "./fields";

// One habit (D-R4, ENG-56). `own` is "" until the person answers (nothing pre-selected).
// `accepted` = every answer minus their deal-breakers. `state`: "unanswered" (not asked yet),
// "none" (said they have no deal-breakers) or "some" (chose deal-breakers).
export type HabitState = "unanswered" | "none" | "some";
export type Prefs = Record<string, { own: string; accepted: string[]; state: HabitState }>;

export type ScreenId =
  | "name" | "journey" | "city" | "areas" | "where" | "location" | "budget" | "dates" | "stay"
  | "gender" | "genderPref" | "livingWith" | "money" | `h:${Dimension}` | "bio" | "review";

export const HABIT_IDS = QUESTIONNAIRE.map((q) => `h:${q.id}` as ScreenId);

// The application (D-R5, ENG-57): name, city + areas, budget, dates, gender + preference, bio.
// APPLICATION_SCREENS is the target (combined "where" and "livingWith" screens, once StepBody
// renders them). SCREENS is what /join runs today: the same questions, with city/areas and
// gender/preference still on separate screens. Journey, stay and the six habits are no longer
// part of the application; "location" isn't collected any more.
// ENG-68: five steps — name, where (city + areas), money (budget + dates), living with
// (gender + preference), review. The bio is optional and comes later with the habits.
export const APPLICATION_SCREENS: ScreenId[] = ["name", "where", "money", "livingWith", "review"];
export const SCREENS: ScreenId[] = ["name", "city", "areas", "budget", "dates", "gender", "genderPref", "review"];
// "Better first matches" (D-R5): after submitting, optional, skippable.
export const DEFERRED_SCREENS: ScreenId[] = ["bio", ...HABIT_IDS, "stay", "journey"];

export const SECTIONS: { label: string; screens: ScreenId[] }[] = [
  { label: "About you", screens: ["name", "journey"] },
  { label: "Where", screens: ["city", "areas", "where", "location"] },
  { label: "Money and dates", screens: ["budget", "dates", "money"] },
  { label: "Living together", screens: ["gender", "genderPref", "livingWith"] },
  { label: "Your profile", screens: ["review"] },
  { label: "Better first matches", screens: ["bio", ...HABIT_IDS, "stay", "journey"] },
];

const ALL_VALUES = (dim: string) => QUESTIONNAIRE.find((q) => q.id === dim)?.values.map((v) => v.id) ?? [];

// Which screen owns each server field, so a server error (or INCOMPLETE) takes you there.
export const FIELD_SCREEN: Record<string, ScreenId> = {
  displayName: "name", display_name: "name", name: "name", journey: "journey",
  cityId: "city", city: "city", city_id: "city", areas: "areas", areaIds: "areas", area_ids: "areas",
  locationDetail: "location", rentMinMinor: "budget", rentMaxMinor: "budget", rentPeriod: "budget",
  budget: "budget", rent: "budget",
  moveMode: "dates", earliestDate: "dates", latestDate: "dates", preferredDate: "dates", dates: "dates", move_in: "dates",
  stayMinMonths: "stay", stayMaxMonths: "stay", stay: "stay",
  gender: "gender", genderPreference: "genderPref", gender_preference: "genderPref",
  preferences: "h:cleaning", habits: "h:cleaning", bio: "bio",
  ...Object.fromEntries(QUESTIONNAIRE.map((q) => [q.id, `h:${q.id}` as ScreenId])),
};

// INCOMPLETE (422) lists what's missing in words, e.g. "display name, bio, move-in dates".
const MISSING_SCREEN: [RegExp, ScreenId][] = [
  [/display name|name/i, "name"], [/journey/i, "journey"], [/city/i, "city"], [/area/i, "areas"],
  [/budget|rent/i, "budget"], [/move|date/i, "dates"], [/stay/i, "stay"], [/gender pref|preference/i, "genderPref"],
  [/gender/i, "gender"], [/living|habit|preference/i, "h:cleaning"], [/bio/i, "bio"],
];
/** The first screen named in an INCOMPLETE error (field_errors keys or the plain-words list). */
export function screenForMissing(fieldErrors: Record<string, string> | null | undefined, message?: string): ScreenId | undefined {
  const fe = fieldErrors ?? {};
  for (const k of Object.keys(fe)) if (FIELD_SCREEN[k]) return FIELD_SCREEN[k];
  const words = [...Object.values(fe), message ?? ""].join(", ").split(/[,:]/).map((w) => w.trim()).filter(Boolean);
  for (const w of words) for (const [re, screen] of MISSING_SCREEN) if (re.test(w)) return screen;
  return undefined;
}

export type Draft = ReturnType<typeof useProfileDraft>;

export function useProfileDraft() {
  const [journey, setJourney] = useState("");
  const [city, setCity] = useState<CityId | "">("");
  const [areas, setAreas] = useState<string[]>([]);
  // ENG-69: "Anywhere in {city}" — exclusive with specific areas.
  const [anyArea, setAnyAreaState] = useState(false);
  const [locationDetail, setLocationDetail] = useState("");
  const [rentMin, setRentMin] = useState("");
  const [rentMax, setRentMax] = useState("");
  const [period, setPeriod] = useState<"month" | "year">("month");
  const [moveMode, setMoveMode] = useState<"exact" | "range">("range");
  const [earliest, setEarliest] = useState("");
  const [latest, setLatest] = useState("");
  const [stayMin, setStayMin] = useState("6");
  const [stayMax, setStayMax] = useState("12");
  const [gender, setGender] = useState<string | null>(null);
  const [genderAccepts, setGenderAccepts] = useState<string[]>([...GENDER_IDS]);
  const [prefs, setPrefs] = useState<Prefs>(() => {
    const p: Prefs = {};
    // Nothing pre-selected (D-R4): no own answer, no deal-breakers, not answered.
    for (const q of QUESTIONNAIRE) p[q.id] = { own: "", accepted: q.values.map((v) => v.id), state: "unanswered" };
    return p;
  });
  // Bumped when the "latest" date needs attention, so the screen can move focus to it (ENG-55).
  const [focusLatest, setFocusLatest] = useState(0);
  const [answered, setAnswered] = useState<string[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");

  /** Fill the answers from GET /me (resume a draft, or edit a live profile). */
  const hydrate = useCallback((me: any) => {
    if (!me) return;
    if (me.profile?.journey) setJourney(me.profile.journey);
    if (me.displayName && !String(me.displayName).includes("@")) setDisplayName(me.displayName);
    if (me.profile?.bio) setBio(me.profile.bio);
    const s = me.search;
    if (s) {
      if (s.cityId && s.cityId in CITIES) { setCity(s.cityId); setPeriod(s.rentPeriod ?? CITIES[s.cityId as CityId].defaultPeriod); }
      if (s.areas?.length) setAreas(s.areas);
      if (s.anyArea) setAnyAreaState(true);
      if (s.locationDetail) setLocationDetail(s.locationDetail);
      if (s.rentMinMinor) setRentMin(String(s.rentMinMinor / 100));
      if (s.rentMaxMinor) setRentMax(String(s.rentMaxMinor / 100));
      if (s.moveMode && s.moveMode !== "undecided") setMoveMode(s.moveMode);
      if (s.earliestDate) setEarliest(s.earliestDate);
      if (s.latestDate) setLatest(s.latestDate);
      if (s.stayMinMonths) setStayMin(String(s.stayMinMonths));
      if (s.stayMaxMonths) setStayMax(String(s.stayMaxMonths));
      if (s.gender) setGender(s.gender);
      if (s.genderPreference?.length) setGenderAccepts(s.genderPreference);
      if (s.preferences?.length) {
        setPrefs((prev) => {
          const next = { ...prev };
          for (const p of s.preferences) {
            next[p.dimension] = {
              own: p.ownAnswer ?? "",
              accepted: p.acceptedValues?.length ? p.acceptedValues : ALL_VALUES(p.dimension),
              state: (p.state as HabitState) ?? "some",
            };
          }
          return next;
        });
        setAnswered(
          s.preferences
            .filter((p: { ownAnswer: string | null; state?: string }) => p.ownAnswer || (p.state && p.state !== "unanswered"))
            .map((p: { dimension: string }) => p.dimension)
        );
      }
    }
  }, []);

  function chooseCity(c: CityId) {
    if (city === c) return;
    setCity(c);
    setAreas([]);
    setAnyAreaState(false);
    setPeriod(CITIES[c].defaultPeriod);
  }
  /** "Anywhere in {city}" on clears the chosen areas (ENG-69). */
  function setAnyArea(on: boolean) {
    setAnyAreaState(on);
    if (on) setAreas([]);
  }
  function toggleArea(id: string) {
    setAnyAreaState(false);
    setAreas((a) => (a.includes(id) ? a.filter((x) => x !== id) : a.length < 5 ? [...a, id] : a));
  }
  /** Rule an answer in or out as a deal-breaker (ENG-56). At least one answer stays acceptable. */
  function toggleAccepted(dim: string, val: string) {
    setPrefs((p) => {
      const cur = p[dim];
      const all = ALL_VALUES(dim);
      const has = cur.accepted.includes(val);
      const accepted = has ? cur.accepted.filter((x) => x !== val) : all.filter((v) => cur.accepted.includes(v) || v === val);
      if (!accepted.length) return p;
      const state: HabitState = accepted.length < all.length ? "some" : cur.state === "some" ? "unanswered" : cur.state;
      return { ...p, [dim]: { ...cur, accepted, state } };
    });
  }
  /** Same as toggleAccepted, named for the deal-breaker UI. */
  const toggleDealBreaker = toggleAccepted;
  /** "I have no deal-breakers": clears any chosen ones (mutually exclusive). */
  function setNoDealBreakers(dim: string) {
    setPrefs((p) => ({ ...p, [dim]: { ...p[dim], accepted: ALL_VALUES(dim), state: "none" } }));
    setAnswered((a) => (a.includes(dim) ? a : [...a, dim]));
  }
  /** The UI marks a habit as answered (used with "no deal-breakers"). */
  function markAnswered(dim: string) {
    setPrefs((p) => (p[dim].accepted.length >= ALL_VALUES(dim).length ? { ...p, [dim]: { ...p[dim], state: "none" } } : p));
    setAnswered((a) => (a.includes(dim) ? a : [...a, dim]));
  }
  function setOwn(dim: string, val: string) {
    setPrefs((p) => ({ ...p, [dim]: { ...p[dim], own: val } }));
  }
  /** Earliest move-in date. Moving it past the latest clears the latest and says why (ENG-55). */
  function setEarliestGuarded(v: string) {
    setEarliest(v);
    if (moveMode !== "range") return;
    const r = afterEarliestChange(v, latest);
    if (r.cleared) {
      setLatest("");
      setErrors((e) => ({ ...e, latestDate: r.message as string }));
      setFocusLatest((n) => n + 1);
    }
  }
  function setLatestGuarded(v: string) {
    setLatest(v);
    const msg = rangeError(earliest, v);
    setErrors((e) => {
      const { latestDate: _drop, ...rest } = e;
      return msg ? { ...rest, latestDate: msg } : rest;
    });
  }
  function toggleGenderAccept(id: string) {
    const next = genderAccepts.includes(id) ? genderAccepts.filter((g) => g !== id) : [...genderAccepts, id];
    if (next.length) setGenderAccepts(GENDER_IDS.filter((g) => next.includes(g)));
  }

  /** Client-side check for one screen (the server checks again). Returns field errors. */
  function validate(s: ScreenId): Record<string, string> {
    if (s === "name" && displayName.trim().length < 2) return { displayName: "Tell us what to call you (at least 2 characters)." };
    if (s === "journey" && !journey) return { journey: "Choose what you're looking to do." };
    if (s === "city" && !city) return { city: "Choose a city." };
    if (s === "areas" && areas.length === 0 && !anyArea) return { areas: "Choose at least one area." };
    if (s === "where") {
      if (!city) return { city: "Choose a city." };
      if (areas.length === 0 && !anyArea) return { areas: "Choose at least one area, or anywhere in the city." };
    }
    if (s === "livingWith" && !gender) return { gender: "Choose an option. “Prefer not to say” is fine." };
    if (s === "budget") {
      const fe: Record<string, string> = {};
      if (!(parseFloat(rentMin) > 0)) fe.rentMinMinor = "Enter your lowest budget, for example 500000.";
      if (!(parseFloat(rentMax) > 0)) fe.rentMaxMinor = "Enter your highest budget.";
      else if (parseFloat(rentMax) < parseFloat(rentMin)) fe.rentMaxMinor = "Make this at least as much as your lowest budget.";
      return fe;
    }
    if (s === "dates") {
      const fe: Record<string, string> = {};
      if (!earliest) fe.earliestDate = moveMode === "exact" ? "Choose your move-in date." : "Choose your earliest move-in date.";
      if (moveMode === "range" && !latest) fe.latestDate = "Choose your latest move-in date.";
      const wrongWay = moveMode === "range" ? rangeError(earliest, latest) : null;
      if (wrongWay) fe.latestDate = wrongWay;
      return fe;
    }
    if (s === "stay") {
      const a = parseInt(stayMin), b = parseInt(stayMax);
      if (!(a >= 1)) return { stayMinMonths: "Enter at least 1 month." };
      if (!(b >= 1)) return { stayMaxMonths: "Enter at least 1 month." };
      if (b < a) return { stayMaxMonths: "Make this at least as long as your shortest stay." };
    }
    if (s.startsWith("h:")) {
      // Continue needs a real answer (D-R4); skipping is the flow's own Skip button.
      const p = prefs[s.slice(2)];
      if (!p?.own) return { [s.slice(2)]: "Choose your answer." };
      if (p.state === "unanswered") return { [s.slice(2)]: "Choose your deal-breakers, or “I have no deal-breakers”." };
    }
    if (s === "gender" && !gender) return { gender: "Choose an option. “Prefer not to say” is fine." };
    // ENG-68: the bio is optional; only the length is limited.
    if (s === "bio" && bio.trim().length > 600) return { bio: "Keep it under 600 characters." };
    if (s === "money") return { ...validate("budget"), ...validate("dates") };
    return {};
  }

  /** The PATCH for one screen. Every screen saves on its own, so nothing is lost if the phone drops. */
  function requestFor(s: ScreenId): { path: string; body: Record<string, unknown> } | null {
    switch (s) {
      case "name": return { path: "/me/profile", body: { displayName: displayName.trim() } };
      case "journey": return { path: "/me/profile", body: { journey } };
      case "city": return { path: "/me/search", body: { cityId: city, rentPeriod: period } };
      case "areas": return { path: "/me/search", body: { cityId: city, ...(anyArea ? { anyArea: true } : { areaIds: areas }) } };
      case "where": return { path: "/me/search", body: { cityId: city, rentPeriod: period, ...(anyArea ? { anyArea: true } : { areaIds: areas }) } };
      case "livingWith": return { path: "/me/search", body: { gender, genderPreference: genderAccepts } };
      case "location": return { path: "/me/search", body: { locationDetail } };
      case "money":
        return {
          path: "/me/search",
          body: {
            rentMinMinor: Math.round(parseFloat(rentMin) * 100), rentMaxMinor: Math.round(parseFloat(rentMax) * 100), rentPeriod: period,
            moveMode, earliestDate: earliest, latestDate: moveMode === "exact" ? earliest : latest,
          },
        };
      case "budget":
        return { path: "/me/search", body: { rentMinMinor: Math.round(parseFloat(rentMin) * 100), rentMaxMinor: Math.round(parseFloat(rentMax) * 100), rentPeriod: period } };
      case "dates":
        return { path: "/me/search", body: { moveMode, earliestDate: earliest, latestDate: moveMode === "exact" ? earliest : latest } };
      case "stay": return { path: "/me/search", body: { stayMinMonths: parseInt(stayMin), stayMaxMonths: parseInt(stayMax) } };
      case "gender": return { path: "/me/search", body: { gender } };
      case "genderPref": return { path: "/me/search", body: { genderPreference: genderAccepts } };
      case "bio": return { path: "/me/profile", body: { bio } };
      case "review": return null;
      default: {
        // D-R4: own answer (or null), and deal-breakers or "no deal-breakers"; nothing implied.
        const dim = s.slice(2);
        const p = prefs[dim];
        const dealBreakers = ALL_VALUES(dim).filter((v) => !p.accepted.includes(v));
        const item: Record<string, unknown> = { dimension: dim, ownAnswer: p.own || null };
        if (p.state === "none") item.noDealBreakers = true;
        else if (p.state === "some" && dealBreakers.length) item.dealBreakers = dealBreakers;
        else item.dealBreakers = [];
        return { path: "/me/search", body: { preferences: [item] } };
      }
    }
  }

  /**
   * Validate and save the given screens, in order. Returns true on success. On failure the
   * field errors are set and `topError` explains what to do next.
   */
  async function save(screens: ScreenId[], opts: { quiet?: boolean } = {}): Promise<{ ok: true } | { ok: false; screen?: ScreenId; message?: string }> {
    setErrors({});
    for (const s of screens) {
      const fe = validate(s);
      if (Object.keys(fe).length) {
        if (!opts.quiet) setErrors(fe);
        return { ok: false, screen: s };
      }
    }
    setSaveState("saving");
    try {
      for (const s of screens) {
        const r = requestFor(s);
        if (r) await api(r.path, { method: "PATCH", body: r.body });
        // Funnel (ENG-58): only on /join, only the screen id. Never the answer.
        if (typeof window !== "undefined" && window.location.pathname.startsWith("/join")) {
          trackFunnel("join.step_completed", { step: s, index: Math.max(0, SCREENS.indexOf(s)) });
        }
        if (s.startsWith("h:")) {
          const dim = s.slice(2);
          setAnswered((a) => (a.includes(dim) ? a : [...a, dim]));
        }
      }
      setSaveState("saved");
      return { ok: true };
    } catch (e) {
      setSaveState("error");
      if (e instanceof ApiClientError) {
        const fe = e.fieldErrors ?? {};
        if (!opts.quiet) setErrors(fe);
        const target = Object.keys(fe).map((k) => FIELD_SCREEN[k]).find(Boolean);
        return { ok: false, screen: target, message: e.message };
      }
      return { ok: false, message: "We couldn't save that. Check your connection and try again. Your answers are still here." };
    }
  }

  return {
    // values
    journey, city, areas, anyArea, locationDetail, rentMin, rentMax, period, moveMode, earliest, latest,
    stayMin, stayMax, gender, genderAccepts, prefs, answered, displayName, bio,
    // ENG-55: the "latest" picker's min, and a counter that changes when it needs focus.
    latestMin: latestMinOf(earliest), focusLatest,
    // setters (setEarliest/setLatest guard the range, ENG-55)
    setJourney, setLocationDetail, setRentMin, setRentMax, setPeriod, setMoveMode,
    setEarliest: setEarliestGuarded, setLatest: setLatestGuarded,
    setStayMin, setStayMax, setGender, setDisplayName, setBio,
    chooseCity, toggleArea, setAnyArea, toggleAccepted, toggleDealBreaker, setNoDealBreakers, markAnswered, setOwn, toggleGenderAccept,
    // state
    errors, setErrors, saveState, setSaveState,
    hydrate, validate, save,
  };
}

/** Where to pick up a saved draft: the first question without an answer (from GET /me). */
export function resumeScreen(me: any): ScreenId {
  const p = me?.profile ?? {};
  const s = me?.search ?? {};
  // ENG-68: only the five essentials decide where /join resumes (combined step ids).
  if (!me?.displayName || String(me.displayName).includes("@") || String(me.displayName).trim().length < 2) return "name";
  if (!s.cityId || (!s.areas?.length && !s.anyArea)) return "where";
  if (s.rentMinMinor == null || s.rentMaxMinor == null || !s.earliestDate || !s.moveMode || s.moveMode === "undecided") return "money";
  if (!s.gender) return "livingWith";
  void p;
  return "review";
}
