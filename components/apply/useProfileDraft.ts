"use client";

// The profile answers behind /join, /onboarding and the /profile editors, with one save per
// screen. Same data contract as before: PATCH /me/profile and PATCH /me/search (the server
// accepts partial updates and validates again). Nothing here decides matching.

import { useCallback, useState } from "react";
import { api, ApiClientError } from "@/lib/client";
import { CITIES, GENDER_IDS, QUESTIONNAIRE, CityId, Dimension } from "@/lib/constants";
import type { SaveState } from "./fields";

export type Prefs = Record<string, { own: string; accepted: string[] }>;

export type ScreenId =
  | "name" | "journey" | "city" | "areas" | "location" | "budget" | "dates" | "stay"
  | "gender" | "genderPref" | `h:${Dimension}` | "bio" | "review";

export const HABIT_IDS = QUESTIONNAIRE.map((q) => `h:${q.id}` as ScreenId);
export const SCREENS: ScreenId[] = [
  "name", "journey", "city", "areas", "location", "budget", "dates", "stay",
  "gender", "genderPref", ...HABIT_IDS, "bio", "review",
];

export const SECTIONS: { label: string; screens: ScreenId[] }[] = [
  { label: "About you", screens: ["name", "journey"] },
  { label: "Where", screens: ["city", "areas", "location"] },
  { label: "Money and dates", screens: ["budget", "dates", "stay"] },
  { label: "Living together", screens: ["gender", "genderPref", ...HABIT_IDS] },
  { label: "Your profile", screens: ["bio", "review"] },
];

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
  [/budget|rent/i, "budget"], [/move|date/i, "dates"], [/stay/i, "stay"], [/gender pref/i, "genderPref"],
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
    for (const q of QUESTIONNAIRE) p[q.id] = { own: q.values[0].id, accepted: q.values.map((v) => v.id) };
    return p;
  });
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
          for (const p of s.preferences) next[p.dimension] = { own: p.ownAnswer, accepted: p.acceptedValues };
          return next;
        });
        setAnswered(s.preferences.map((p: { dimension: string }) => p.dimension));
      }
    }
  }, []);

  function chooseCity(c: CityId) {
    if (city === c) return;
    setCity(c);
    setAreas([]);
    setPeriod(CITIES[c].defaultPeriod);
  }
  function toggleArea(id: string) {
    setAreas((a) => (a.includes(id) ? a.filter((x) => x !== id) : a.length < 5 ? [...a, id] : a));
  }
  function toggleAccepted(dim: string, val: string) {
    setPrefs((p) => {
      const cur = p[dim];
      const has = cur.accepted.includes(val);
      const accepted = has ? cur.accepted.filter((x) => x !== val) : [...cur.accepted, val];
      return { ...p, [dim]: { ...cur, accepted: accepted.length ? accepted : [cur.own] } };
    });
  }
  function setOwn(dim: string, val: string) {
    setPrefs((p) => ({ ...p, [dim]: { own: val, accepted: p[dim].accepted.includes(val) ? p[dim].accepted : [...p[dim].accepted, val] } }));
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
    if (s === "areas" && areas.length === 0) return { areas: "Choose at least one area." };
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
      return fe;
    }
    if (s === "stay") {
      const a = parseInt(stayMin), b = parseInt(stayMax);
      if (!(a >= 1)) return { stayMinMonths: "Enter at least 1 month." };
      if (!(b >= 1)) return { stayMaxMonths: "Enter at least 1 month." };
      if (b < a) return { stayMaxMonths: "Make this at least as long as your shortest stay." };
    }
    if (s === "gender" && !gender) return { gender: "Choose an option. “Prefer not to say” is fine." };
    if (s === "bio" && bio.trim().length < 80) return { bio: `Add ${80 - bio.trim().length} more characters, so people have something to reply to.` };
    return {};
  }

  /** The PATCH for one screen. Every screen saves on its own, so nothing is lost if the phone drops. */
  function requestFor(s: ScreenId): { path: string; body: Record<string, unknown> } | null {
    switch (s) {
      case "name": return { path: "/me/profile", body: { displayName: displayName.trim() } };
      case "journey": return { path: "/me/profile", body: { journey } };
      case "city": return { path: "/me/search", body: { cityId: city, rentPeriod: period } };
      case "areas": return { path: "/me/search", body: { cityId: city, areaIds: areas } };
      case "location": return { path: "/me/search", body: { locationDetail } };
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
        const dim = s.slice(2);
        return { path: "/me/search", body: { preferences: [{ dimension: dim, ownAnswer: prefs[dim].own, acceptedValues: prefs[dim].accepted }] } };
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
    journey, city, areas, locationDetail, rentMin, rentMax, period, moveMode, earliest, latest,
    stayMin, stayMax, gender, genderAccepts, prefs, answered, displayName, bio,
    // setters
    setJourney, setLocationDetail, setRentMin, setRentMax, setPeriod, setMoveMode, setEarliest, setLatest,
    setStayMin, setStayMax, setGender, setDisplayName, setBio,
    chooseCity, toggleArea, toggleAccepted, setOwn, toggleGenderAccept,
    // state
    errors, setErrors, saveState, setSaveState,
    hydrate, validate, save,
  };
}

/** Where to pick up a saved draft: the first question without an answer (from GET /me). */
export function resumeScreen(me: any): ScreenId {
  const p = me?.profile ?? {};
  const s = me?.search ?? {};
  if (!me?.displayName || String(me.displayName).includes("@") || String(me.displayName).trim().length < 2) return "name";
  if (!p.journey) return "journey";
  if (!s.cityId) return "city";
  if (!s.areas?.length) return "areas";
  if (s.rentMinMinor == null || s.rentMaxMinor == null) return "budget";
  if (!s.earliestDate || !s.moveMode || s.moveMode === "undecided") return "dates";
  if (s.stayMinMonths == null || s.stayMaxMonths == null) return "stay";
  if (!s.gender) return "gender";
  const done: string[] = (s.preferences ?? []).map((x: { dimension: string }) => x.dimension);
  const missing = QUESTIONNAIRE.find((q) => !done.includes(q.id));
  if (missing) return `h:${missing.id}` as ScreenId;
  if (!p.bio || String(p.bio).trim().length < 80) return "bio";
  return "review";
}
