"use client";

// Conversational onboarding: one question per screen, asked by Pea.
// Presentation only: the fields, validation and API calls are the same as the previous
// six-step form (PATCH /me/profile, PATCH /me/search in the same groups, then publish).

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client";
import { CITIES, GENDERS, GENDER_IDS, JOURNEYS, OWN_GENDER_OPTIONS, QUESTIONNAIRE, CityId, Dimension } from "@/lib/constants";
import { formatMoney, monthlyEquivalentMinor } from "@/lib/money";
import { formatDateRange } from "@/lib/dates";
import Pea, { PeaMood, PeaTone } from "@/components/brand/Pea";
import { IconArrowRight, IconBack, IconCheck, IconEye, IconLock } from "@/components/icons";

type Prefs = Record<string, { own: string; accepted: string[] }>;

type ScreenId =
  | "name" | "journey" | "city" | "areas" | "location" | "budget" | "dates" | "stay"
  | "gender" | "genderPref" | `h:${Dimension}` | "bio" | "review";

const HABIT_IDS = QUESTIONNAIRE.map((q) => `h:${q.id}` as ScreenId);
const SCREENS: ScreenId[] = [
  "name", "journey", "city", "areas", "location", "budget", "dates", "stay",
  "gender", "genderPref", ...HABIT_IDS, "bio", "review",
];

const SECTIONS: { label: string; screens: ScreenId[] }[] = [
  { label: "About you", screens: ["name", "journey"] },
  { label: "Where", screens: ["city", "areas", "location"] },
  { label: "Money and dates", screens: ["budget", "dates", "stay"] },
  { label: "Living together", screens: ["gender", "genderPref", ...HABIT_IDS] },
  { label: "Your profile", screens: ["bio", "review"] },
];

// Which screen owns each server field, so a server error takes you to the right question.
const FIELD_SCREEN: Record<string, ScreenId> = {
  displayName: "name", journey: "journey", cityId: "city", city: "city", areas: "areas", areaIds: "areas",
  locationDetail: "location", rentMinMinor: "budget", rentMaxMinor: "budget", rentPeriod: "budget",
  moveMode: "dates", earliestDate: "dates", latestDate: "dates", preferredDate: "dates",
  stayMinMonths: "stay", stayMaxMonths: "stay", gender: "gender", genderPreference: "genderPref",
  preferences: "h:cleaning", bio: "bio",
};

// Conversational wording for the six habits (display only; values come from QUESTIONNAIRE).
const HABIT_ASK: Record<Dimension, { q: string; accept: string; tone: PeaTone }> = {
  cleaning: { q: "How often do you clean shared spaces?", accept: "Who could you live with?", tone: "pea" },
  quiet: { q: "When should weeknights go quiet?", accept: "Who could you live with?", tone: "fresh" },
  guests: { q: "How often do you have overnight guests?", accept: "Who could you live with?", tone: "sage" },
  smoking: { q: "Do you smoke at home?", accept: "Who could you live with?", tone: "pea" },
  pets: { q: "Do you have a pet?", accept: "Who could you live with?", tone: "fresh" },
  social: { q: "How social do you like home to be?", accept: "Who could you live with?", tone: "sage" },
};

const IS_BETA = process.env.NEXT_PUBLIC_APP_ENV === "beta";
const IS_RESEARCH = process.env.NEXT_PUBLIC_APP_ENV === "research";

interface Candidate {
  userId: string;
  displayName: string;
  avatarInitials: string | null;
  cityId: string;
  areas: string[];
  reasons: string[];
}

export default function Onboarding() {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [answered, setAnswered] = useState<string[]>([]); // habit ids the person has answered
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  // form state (unchanged data contract)
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
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [published, setPublished] = useState<{ score: number; pending: boolean } | null>(null);
  const [matches, setMatches] = useState<Candidate[] | null>(null);
  // DES-13: optional, unticked survey opt-in, saved with publish (PATCH /me/preferences).
  const [surveyOptIn, setSurveyOptIn] = useState(false);
  const [surveySaved, setSurveySaved] = useState(false);
  const [surveyFailed, setSurveyFailed] = useState(false);

  // Resume from existing data
  useEffect(() => {
    api<any>("/me").then((me) => {
      if (me.profile?.journey) setJourney(me.profile.journey);
      if (me.displayName && !me.displayName.includes("@")) setDisplayName(me.displayName);
      if (me.profile?.bio) setBio(me.profile.bio);
      if ((me.preferences?.survey_opt_in ?? me.survey_opt_in) === true) { setSurveyOptIn(true); setSurveySaved(true); }
      const s = me.search;
      if (s) {
        if (s.cityId) { setCity(s.cityId); setPeriod(s.rentPeriod ?? CITIES[s.cityId as CityId].defaultPeriod); }
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
      if (me.profile?.publicationStatus === "published") router.replace("/discover");
    }).catch(() => {});
  }, [router]);

  const screen: ScreenId | "done" = published ? "done" : SCREENS[idx];
  const cityCfg = city ? CITIES[city] : null;
  const firstName = displayName.trim().split(/\s+/)[0] || "";

  // Move focus to the new question so screen readers announce it.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    headingRef.current?.focus();
    window.scrollTo({ top: 0 });
  }, [idx, published]);

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

  function fail(fe: Record<string, string>, msg?: string) {
    setErrors(fe);
    if (msg) setTopError(msg);
    const target = Object.keys(fe).map((k) => FIELD_SCREEN[k]).find(Boolean);
    if (target && target !== screen) setIdx(SCREENS.indexOf(target));
    return false;
  }

  // Validate this screen and save when it closes a group. Same requests as before.
  async function saveScreen(): Promise<boolean> {
    setErrors({});
    setTopError(null);
    const s = screen;
    // client-side checks (the server checks again)
    if (s === "name" && displayName.trim().length < 2) return fail({ displayName: "Tell us what to call you (at least 2 characters)." });
    if (s === "journey" && !journey) return fail({ journey: "Choose a journey." });
    if (s === "city" && !city) return fail({ city: "Choose a city." });
    if (s === "areas" && areas.length === 0) return fail({ areas: "Choose at least one area." });
    if (s === "budget") {
      const fe: Record<string, string> = {};
      if (!(parseFloat(rentMin) > 0)) fe.rentMinMinor = "Enter a valid minimum budget.";
      if (!(parseFloat(rentMax) > 0)) fe.rentMaxMinor = "Enter a valid maximum budget.";
      else if (parseFloat(rentMax) < parseFloat(rentMin)) fe.rentMaxMinor = "Maximum budget must be at least minimum budget.";
      if (Object.keys(fe).length) return fail(fe);
    }
    if (s === "dates") {
      const fe: Record<string, string> = {};
      if (!earliest) fe.earliestDate = moveMode === "exact" ? "Choose your move-in date." : "Choose your earliest move-in date.";
      if (moveMode === "range" && !latest) fe.latestDate = "Choose your latest acceptable move-in date.";
      if (Object.keys(fe).length) return fail(fe);
    }
    if (s === "gender" && !gender) return fail({ gender: "Choose an option. \"Prefer not to say\" is fine." });

    setBusy(true);
    try {
      if (s === "name") await api("/me/profile", { method: "PATCH", body: { displayName } });
      else if (s === "journey") await api("/me/profile", { method: "PATCH", body: { journey } });
      else if (s === "location") {
        await api("/me/search", { method: "PATCH", body: { cityId: city, areaIds: areas, rentPeriod: period, locationDetail } });
      } else if (s === "stay") {
        const min = Math.round(parseFloat(rentMin) * 100);
        const max = Math.round(parseFloat(rentMax) * 100);
        await api("/me/search", {
          method: "PATCH",
          body: {
            rentMinMinor: min, rentMaxMinor: max, rentPeriod: period, moveMode,
            earliestDate: earliest, latestDate: moveMode === "exact" ? earliest : latest,
            stayMinMonths: parseInt(stayMin), stayMaxMonths: parseInt(stayMax),
          },
        });
      } else if (s === HABIT_IDS[HABIT_IDS.length - 1]) {
        await api("/me/search", {
          method: "PATCH",
          body: {
            gender,
            genderPreference: genderAccepts,
            preferences: QUESTIONNAIRE.map((q) => ({ dimension: q.id, ownAnswer: prefs[q.id].own, acceptedValues: prefs[q.id].accepted })),
          },
        });
      } else if (s === "bio") {
        await api("/me/profile", { method: "PATCH", body: { displayName, bio } });
      }
      if (typeof s === "string" && s.startsWith("h:")) {
        const dim = s.slice(2);
        setAnswered((a) => (a.includes(dim) ? a : [...a, dim]));
      }
      return true;
    } catch (e) {
      if (e instanceof ApiClientError) return fail(e.fieldErrors ?? {}, e.message);
      setTopError("We couldn't save that. Check your connection and try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function next(e?: FormEvent) {
    e?.preventDefault();
    if (busy) return;
    if (screen === "review") return publish();
    if (await saveScreen()) setIdx((i) => Math.min(SCREENS.length - 1, i + 1));
  }
  function back() {
    setErrors({});
    setTopError(null);
    setIdx((i) => Math.max(0, i - 1));
  }

  async function publish() {
    setBusy(true);
    setTopError(null);
    if (surveyOptIn !== surveySaved) {
      // Never block publishing on this optional choice; say so on the next screen if it failed.
      try {
        await api("/me/preferences", { method: "PATCH", body: { survey_opt_in: surveyOptIn, source: "onboarding" } });
        setSurveySaved(surveyOptIn);
        setSurveyFailed(false);
      } catch {
        setSurveyFailed(true);
      }
    }
    try {
      const data = await api<{ credibility: { score: number }; pendingIdentity?: boolean }>("/me/search/publish", { body: {} });
      setPublished({ score: data.credibility.score, pending: !!data.pendingIdentity });
      if (!data.pendingIdentity) {
        api<{ candidates: Candidate[] }>("/recommendations")
          .then((d) => setMatches(d.candidates))
          .catch(() => setMatches([]));
      }
    } catch (e) {
      setTopError(e instanceof ApiClientError ? e.message : "We couldn't publish your profile. Try again.");
    } finally {
      setBusy(false);
    }
  }

  // Optional screens can be skipped when nothing has been entered.
  const canSkip =
    (screen === "location" && !locationDetail.trim()) ||
    (screen === "genderPref" && genderAccepts.length === GENDER_IDS.length);

  const section = SECTIONS.findIndex((sec) => sec.screens.includes(screen as ScreenId));
  const habitIdx = HABIT_IDS.indexOf(screen as ScreenId);

  /* ------------------------------ what Pea says ----------------------------- */
  const talk = useMemo((): { line: string; mood: PeaMood } => {
    const hi = firstName ? `, ${firstName}` : "";
    switch (screen) {
      case "name": return { line: "Hi, I'm Pea. I'll help you find someone whose plans fit yours.", mood: "awake" };
      case "journey": return { line: `Lovely to meet you${hi}. Let's start with the big picture.`, mood: "happy" };
      case "city": return { line: "Where are you planning to live?", mood: "awake" };
      case "areas": return { line: `${cityCfg ? cityCfg.label.replace(/ pilot$/, "") : "Nice"}. Let's narrow it down.`, mood: "happy" };
      case "location": return { line: "Got a street or postcode in mind? Totally optional.", mood: "awake" };
      case "budget": return { line: "Now the money bit. No judgement, just numbers.", mood: "awake" };
      case "dates": return { line: "Timing matters most. We only match people whose dates overlap.", mood: "awake" };
      case "stay": return { line: "Roughly is fine. You can change it later.", mood: "happy" };
      case "gender": return { line: "A couple of private questions. Only the matching uses these.", mood: "awake" };
      case "genderPref": return { line: "This works both ways, and nobody sees why someone isn't shown.", mood: "awake" };
      case "bio": return { line: `Last one${hi}. A few lines help people say hello.`, mood: "happy" };
      case "review": return { line: "Looking good. Here's what people will match you on.", mood: "happy" };
      case "done": return { line: "You're in. Let's meet some people.", mood: "happy" };
      default:
        return {
          line: habitIdx === 0
            ? "Six quick questions about living together. Each answer wakes up a pea."
            : `${answered.length} of 6 peas awake. Keep going.`,
          mood: habitIdx % 2 ? "wow" : "awake",
        };
    }
  }, [screen, firstName, cityCfg, habitIdx, answered.length]);

  /* ---------------------------------- render ---------------------------------- */

  if (screen === "done") {
    return <Done name={firstName} published={published!} matches={matches} surveyFailed={surveyFailed} />;
  }

  const ctaLabel = screen === "review" ? (busy ? "Publishing…" : "Publish my profile") : busy ? "Saving…" : "Continue";

  return (
    <div data-no-bottom-nav className="-mx-4 -my-6 min-h-[calc(100dvh-92px)] bg-pastel md:mx-auto md:my-0 md:max-w-xl md:rounded-sheet md:min-h-0">
      <form onSubmit={next} noValidate className="mx-auto flex min-h-[calc(100dvh-92px)] max-w-xl flex-col px-4 pt-3 md:min-h-[640px] md:px-8 md:pt-6">
        {/* Top row: Back · progress · Skip */}
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={back} disabled={idx === 0 || busy} className="btn-ghost -ml-2 px-3 disabled:invisible">
            <IconBack size={20} /> Back
          </button>
          <p className="text-caption text-ink-600" aria-live="polite">
            {SECTIONS[section]?.label} · {idx + 1} of {SCREENS.length}
          </p>
          <button type="button" onClick={() => next()} className={`btn-ghost -mr-2 px-3 ${canSkip ? "" : "invisible"}`} tabIndex={canSkip ? 0 : -1} aria-hidden={!canSkip}>
            Skip
          </button>
        </div>
        <div className="mt-1 grid grid-cols-5 gap-1.5" aria-hidden="true">
          {SECTIONS.map((sec, i) => (
            <span key={sec.label} className={`h-1.5 rounded-full ${i < section ? "bg-ink" : i === section ? "bg-pea-500" : "bg-ink-100"}`} />
          ))}
        </div>

        <div key={screen} className="flex-1 animate-rise-in pb-6">
          {/* Pea asks */}
          <div className="mt-6 flex items-start gap-2.5">
            <Pea size={52} mood={talk.mood} blink className="shrink-0" />
            <p className="mt-1 rounded-panel rounded-tl-md bg-white px-4 py-2.5 text-sm font-medium text-ink shadow-e1 ring-1 ring-ink-100">
              {talk.line}
            </p>
          </div>

          {habitIdx >= 0 && <HabitPod answered={answered} current={QUESTIONNAIRE[habitIdx].id} />}

          {topError && (
            <div className="mt-5 rounded-field border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700" role="alert">
              {topError}
            </div>
          )}

          <div className="mt-6">
            {screen === "name" && (
              <>
                <Question refEl={headingRef} htmlFor="dn">What should we call you?</Question>
                <NameTag name={displayName} />
                <input
                  id="dn"
                  className="input mt-4 text-lg"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Alex M."
                  autoComplete="given-name"
                  maxLength={40}
                  aria-invalid={!!errors.displayName}
                  aria-describedby="dn-help"
                  data-clarity-mask="true"
                />
                <FieldError msg={errors.displayName} />
                <Reassure id="dn-help" icon="eye">Shown on your profile. You can change it anytime.</Reassure>
              </>
            )}

            {screen === "journey" && (
              <fieldset>
                <Question refEl={headingRef} legend>What are you looking to do?</Question>
                <div className="mt-4 space-y-3" role="radiogroup">
                  {JOURNEYS.map((j, i) => (
                    <OptionCard key={j.id} checked={journey === j.id} onClick={() => setJourney(j.id)} title={j.label} help={j.help}
                      art={<JourneyArt kind={i} />} />
                  ))}
                </div>
                <FieldError msg={errors.journey} />
              </fieldset>
            )}

            {screen === "city" && (
              <fieldset>
                <Question refEl={headingRef} legend>Which city?</Question>
                <div className="mt-4 grid grid-cols-2 gap-3" role="radiogroup">
                  {(Object.keys(CITIES) as CityId[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={city === c}
                      onClick={() => { if (city !== c) { setCity(c); setAreas([]); setPeriod(CITIES[c].defaultPeriod); } }}
                      className={`relative flex min-h-[132px] flex-col justify-between rounded-card border-2 bg-white p-4 text-left transition duration-quick focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${city === c ? "border-ink" : "border-transparent ring-1 ring-ink-100 hover:ring-ink-400"}`}
                    >
                      <span className="font-display text-3xl font-extrabold text-ink" aria-hidden="true">{c === "london" ? "£" : "₦"}</span>
                      <span>
                        <span className="block text-h3 text-ink">{c === "london" ? "London" : "Lagos"}</span>
                        <span className="block text-sm text-ink-600">Rent usually per {CITIES[c].defaultPeriod}</span>
                      </span>
                      {city === c && <Tick />}
                    </button>
                  ))}
                </div>
                <FieldError msg={errors.city || errors.cityId} />
              </fieldset>
            )}

            {screen === "areas" && cityCfg && (
              <fieldset>
                <Question refEl={headingRef} legend>Which areas would you live in?</Question>
                <p className="helper">Pick up to 5. You&apos;ll only see people who share at least one.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {cityCfg.areas.map((a) => {
                    const on = areas.includes(a.id);
                    const full = !on && areas.length >= 5;
                    return (
                      <button key={a.id} type="button" aria-pressed={on} onClick={() => toggleArea(a.id)} aria-disabled={full}
                        className={`choice-chip ${full ? "opacity-60" : ""}`}>
                        {on && <IconCheck size={16} strokeWidth={2.5} />}
                        {a.label}
                      </button>
                    );
                  })}
                </div>
                <p className="num mt-3 text-sm font-medium text-ink-700" aria-live="polite">{areas.length} of 5 chosen</p>
                <FieldError msg={errors.areas || errors.areaIds} />
              </fieldset>
            )}

            {screen === "location" && (
              <>
                <Question refEl={headingRef} htmlFor="loc">
                  {city === "london" ? "Postcode or address" : "Address"} <span className="text-ink-600">(optional)</span>
                </Question>
                <input
                  id="loc"
                  className="input mt-4"
                  value={locationDetail}
                  onChange={(e) => setLocationDetail(e.target.value)}
                  placeholder={city === "london" ? "e.g. E8 3RH, or a street you have in mind" : "e.g. 12 Herbert Macaulay Way, Yaba"}
                  maxLength={200}
                  aria-describedby="loc-help"
                  data-clarity-mask="true"
                />
                <FieldError msg={errors.locationDetail} />
                <Reassure id="loc-help">Private: only you see this. It never appears on your profile.</Reassure>
              </>
            )}

            {screen === "budget" && cityCfg && (
              <fieldset>
                <Question refEl={headingRef} legend>What&apos;s your rent budget, per person?</Question>
                <div className="mt-4 inline-flex rounded-full bg-white p-1 ring-1 ring-ink-100" role="radiogroup" aria-label="Budget period">
                  {(["month", "year"] as const).map((p) => (
                    <button key={p} type="button" role="radio" aria-checked={period === p} onClick={() => setPeriod(p)}
                      className={`min-h-[44px] rounded-full px-5 text-sm font-semibold ${period === p ? "bg-ink text-cream" : "text-ink-700"}`}>
                      Per {p}
                    </button>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <MoneyInput id="rmin" label="From" currency={cityCfg.currency} value={rentMin} onChange={setRentMin} error={errors.rentMinMinor} />
                  <MoneyInput id="rmax" label="Up to" currency={cityCfg.currency} value={rentMax} onChange={setRentMax} error={errors.rentMaxMinor} />
                </div>
                {period === "year" && parseFloat(rentMin) > 0 && parseFloat(rentMax) > 0 && (
                  <p className="num mt-3 text-sm text-ink-700">
                    About {formatMoney(monthlyEquivalentMinor(Math.round(parseFloat(rentMin) * 100), "year"), cityCfg.currency)}–
                    {formatMoney(monthlyEquivalentMinor(Math.round(parseFloat(rentMax) * 100), "year"), cityCfg.currency)} a month.
                  </p>
                )}
                <FieldError msg={errors.rentPeriod} />
                <Reassure icon="eye">People you match with see this range, so they know it fits. Matching only needs your ranges to overlap.</Reassure>
              </fieldset>
            )}

            {screen === "dates" && (
              <fieldset>
                <Question refEl={headingRef} legend>When can you move in?</Question>
                <div className="mt-4 inline-flex rounded-full bg-white p-1 ring-1 ring-ink-100" role="radiogroup" aria-label="Move-in timing">
                  {(["exact", "range"] as const).map((m) => (
                    <button key={m} type="button" role="radio" aria-checked={moveMode === m} onClick={() => setMoveMode(m)}
                      className={`min-h-[44px] rounded-full px-5 text-sm font-semibold ${moveMode === m ? "bg-ink text-cream" : "text-ink-700"}`}>
                      {m === "exact" ? "Exact date" : "Date range"}
                    </button>
                  ))}
                </div>
                <div className="mt-4 grid gap-3 min-[400px]:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="e">{moveMode === "exact" ? "Move-in date" : "Earliest"}</label>
                    <input id="e" type="date" className="input" value={earliest} onChange={(e) => setEarliest(e.target.value)} aria-invalid={!!errors.earliestDate} />
                    <FieldError msg={errors.earliestDate} />
                  </div>
                  {moveMode === "range" && (
                    <div>
                      <label className="label" htmlFor="l">Latest</label>
                      <input id="l" type="date" className="input" value={latest} onChange={(e) => setLatest(e.target.value)} aria-invalid={!!errors.latestDate} />
                      <FieldError msg={errors.latestDate} />
                    </div>
                  )}
                </div>
                <FieldError msg={errors.moveMode || errors.preferredDate} />
                <p className="helper">A range gives you more matches. It must be within the next 18 months.</p>
              </fieldset>
            )}

            {screen === "stay" && (
              <fieldset>
                <Question refEl={headingRef} legend>How long do you want to stay?</Question>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Stepper id="sm" label="At least" value={stayMin} onChange={setStayMin} min={1} max={24} error={errors.stayMinMonths} />
                  <Stepper id="sx" label="At most" value={stayMax} onChange={setStayMax} min={1} max={36} error={errors.stayMaxMonths} />
                </div>
                <p className="helper">In months. You&apos;ll match with people whose range overlaps yours.</p>
              </fieldset>
            )}

            {screen === "gender" && (
              <fieldset>
                <Question refEl={headingRef} legend>What&apos;s your gender?</Question>
                <div className="mt-4 space-y-2" role="radiogroup">
                  {OWN_GENDER_OPTIONS.map((o) => (
                    <RadioRow key={o.id} checked={gender === o.id} onClick={() => setGender(o.id)} label={o.label} />
                  ))}
                </div>
                <FieldError msg={errors.gender} />
                <Reassure>Private: used only to match you. Never shown on your profile.</Reassure>
              </fieldset>
            )}

            {screen === "genderPref" && (
              <fieldset>
                <Question refEl={headingRef} legend>Who are you open to living with?</Question>
                <div className="mt-4 space-y-2">
                  {GENDERS.map((g) => (
                    <RadioRow key={g.id} multi checked={genderAccepts.includes(g.id)} onClick={() => toggleGenderAccept(g.id)} label={g.plural} />
                  ))}
                </div>
                <p className="mt-3 text-sm font-medium text-ink-700" aria-live="polite">
                  {genderAccepts.length === GENDER_IDS.length
                    ? "Open to anyone."
                    : `Only ${GENDERS.filter((g) => genderAccepts.includes(g.id)).map((g) => g.plural.toLowerCase()).join(" and ")}.`}{" "}
                  {gender === "prefer_not_to_say" && "Because you'd rather not say, you'll be matched with people who are open to living with anyone."}
                </p>
                <FieldError msg={errors.genderPreference} />
                <Reassure>Private, and it works both ways: nobody sees why someone isn&apos;t shown.</Reassure>
              </fieldset>
            )}

            {habitIdx >= 0 && (() => {
              const q = QUESTIONNAIRE[habitIdx];
              const p = prefs[q.id];
              const ruledOut = q.values.filter((v) => !p.accepted.includes(v.id));
              return (
                <div>
                  <fieldset>
                    <Question refEl={headingRef} legend>{HABIT_ASK[q.id].q}</Question>
                    <div className="mt-4 space-y-2" role="radiogroup">
                      {q.values.map((v) => (
                        <RadioRow key={v.id} checked={p.own === v.id} onClick={() => setOwn(q.id, v.id)} label={v.label} />
                      ))}
                    </div>
                  </fieldset>
                  <fieldset className="mt-6">
                    <legend className="text-h3 text-ink">{HABIT_ASK[q.id].accept}</legend>
                    <p className="helper mt-0.5">Untick any answer that would be a dealbreaker.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {q.values.map((v) => (
                        <button key={v.id} type="button" role="checkbox" aria-checked={p.accepted.includes(v.id)} onClick={() => toggleAccepted(q.id, v.id)} className="choice-chip">
                          {p.accepted.includes(v.id) ? <IconCheck size={16} strokeWidth={2.5} /> : <span aria-hidden="true" className="h-4 w-4 rounded-full border-2 border-ink-400" />}
                          {v.label}
                        </button>
                      ))}
                    </div>
                    <p className={`mt-3 rounded-field px-3 py-2 text-sm font-medium ${ruledOut.length ? "bg-apricot-100 text-apricot-800" : "bg-white text-ink-700 ring-1 ring-ink-100"}`} aria-live="polite">
                      {ruledOut.length
                        ? `Dealbreaker: you won't be matched with people who say “${ruledOut.map((v) => v.label).join("” or “")}”.`
                        : "Flexible: any answer is fine with you."}
                    </p>
                  </fieldset>
                  <FieldError msg={errors.preferences} />
                </div>
              );
            })()}

            {screen === "bio" && (
              <>
                <Question refEl={headingRef} htmlFor="bio">Tell people a bit about you</Question>
                <textarea
                  id="bio"
                  className="input mt-4 min-h-[160px] leading-relaxed"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={600}
                  aria-describedby="bio-count bio-help"
                  aria-invalid={!!errors.bio}
                  placeholder="Your routine, what you're looking for, and what makes you easy to live with."
                  data-clarity-mask="true"
                />
                <p id="bio-count" className={`num mt-1.5 text-sm font-medium ${bio.trim().length >= 80 ? "text-brand-700" : "text-ink-600"}`}>
                  {bio.trim().length < 80 ? `${80 - bio.trim().length} more characters to go` : `✓ ${bio.length} / 600`}
                </p>
                <FieldError msg={errors.bio} />
                <Reassure id="bio-help" icon="eye">Shown on your profile. Don&apos;t include your address or phone number.</Reassure>
              </>
            )}

            {screen === "review" && (
              <>
                <Question refEl={headingRef}>Ready to go live?</Question>
                <dl className="mt-4 divide-y divide-ink-100 rounded-card bg-white px-4 ring-1 ring-ink-100">
                  {[
                    ["Name", displayName, "name"],
                    ["Looking to", JOURNEYS.find((j) => j.id === journey)?.label, "journey"],
                    ["Areas", `${cityCfg ? (city === "london" ? "London" : "Lagos") : ""} · ${areas.map((a) => cityCfg?.areas.find((x) => x.id === a)?.label).join(", ")}`, "areas"],
                    ["Budget", cityCfg && rentMin && rentMax ? `${formatMoney(Math.round(parseFloat(rentMin) * 100), cityCfg.currency)}–${formatMoney(Math.round(parseFloat(rentMax) * 100), cityCfg.currency)} per ${period}` : "", "budget"],
                    ["Move-in", earliest ? formatDateRange(earliest, moveMode === "range" && latest ? latest : earliest) : "", "dates"],
                    ["Living habits", `${answered.length} of 6 answered`, "h:cleaning"],
                  ].map(([k, val, target]) => (
                    <div key={k} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <dt className="text-caption text-ink-600">{k}</dt>
                        <dd className="truncate text-sm font-medium text-ink">{val || "—"}</dd>
                      </div>
                      <button type="button" onClick={() => setIdx(SCREENS.indexOf(target as ScreenId))} className="btn-ghost shrink-0 px-3 text-sm">
                        Edit<span className="sr-only"> {k}</span>
                      </button>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-sm text-ink-700">
                  {IS_BETA
                    ? "When you publish, our team checks your identity before other members can see you."
                    : "Publishing runs a demo identity check, so your checks show as “Demo verified”. Your profile becomes visible to people who match."}
                </p>
                <label className="mt-5 flex min-h-[44px] cursor-pointer items-start gap-3 rounded-field border border-ink-100 bg-white p-3.5 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-5 w-5 shrink-0 accent-ink"
                    checked={surveyOptIn}
                    onChange={(e) => setSurveyOptIn(e.target.checked)}
                  />
                  <span className="text-ink-700">
                    Email me a short survey about my experience. Optional. About 4 minutes, sent once with at most one reminder. Stop any time in Settings or from the email.
                  </span>
                </label>
              </>
            )}
          </div>
        </div>

        {/* Sticky Continue */}
        <div className="sticky bottom-0 -mx-4 mt-auto bg-gradient-to-t from-paper via-paper/95 to-paper/0 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4 md:static md:mx-0 md:bg-none md:px-0 md:pb-8">
          <button type="submit" className="btn-primary btn-lg w-full" aria-busy={busy}>
            {ctaLabel} {!busy && <IconArrowRight size={18} />}
          </button>
        </div>
      </form>
    </div>
  );
}

/* --------------------------------- pieces --------------------------------- */

function Question({ children, refEl, legend, htmlFor }: { children: React.ReactNode; refEl: React.RefObject<HTMLHeadingElement | null>; legend?: boolean; htmlFor?: string }) {
  const h = (
    <h1 ref={refEl} tabIndex={-1} className="font-display text-display text-ink focus:outline-none md:text-[2.25rem] md:leading-[2.5rem]">
      {htmlFor ? <label htmlFor={htmlFor}>{children}</label> : children}
    </h1>
  );
  return legend ? <legend className="w-full">{h}</legend> : h;
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="field-error" role="alert">{msg}</p>;
}

function Reassure({ children, id, icon = "lock" }: { children: React.ReactNode; id?: string; icon?: "lock" | "eye" }) {
  return (
    <p id={id} className="mt-3 flex items-start gap-2 text-sm text-ink-700">
      <span className="mt-0.5 shrink-0 text-ink-600">{icon === "lock" ? <IconLock size={16} /> : <IconEye size={16} />}</span>
      <span>{children}</span>
    </p>
  );
}

function Tick() {
  return (
    <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-ink text-cream" aria-hidden="true">
      <IconCheck size={14} strokeWidth={3} />
    </span>
  );
}

function OptionCard({ checked, onClick, title, help, art }: { checked: boolean; onClick: () => void; title: string; help: string; art: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onClick}
      className={`relative flex w-full items-center gap-3 rounded-card border-2 bg-white p-3 pr-10 text-left transition duration-quick focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${checked ? "border-ink" : "border-transparent ring-1 ring-ink-100 hover:ring-ink-400"}`}
    >
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-panel bg-pea-50">{art}</span>
      <span>
        <span className="block text-h3 text-ink">{title}</span>
        <span className="mt-0.5 block text-sm text-ink-600">{help}</span>
      </span>
      {checked && <Tick />}
    </button>
  );
}

function JourneyArt({ kind }: { kind: number }) {
  if (kind === 0)
    return (
      <span className="flex -space-x-2" aria-hidden="true">
        <Pea size={28} mood="happy" />
        <Pea size={28} mood="awake" tone="fresh" />
      </span>
    );
  if (kind === 1)
    return (
      <span className="relative" aria-hidden="true">
        <Pea size={32} mood="awake" />
        <span className="absolute -right-2 -top-1 text-base">⌂</span>
      </span>
    );
  return (
    <span className="relative" aria-hidden="true">
      <Pea size={32} mood="wink" tone="sage" />
      <span className="absolute -right-2 -top-1 rounded-full bg-white px-1 text-[10px] font-bold text-ink ring-1 ring-ink-100">+1</span>
    </span>
  );
}

function RadioRow({ checked, onClick, label, multi = false }: { checked: boolean; onClick: () => void; label: string; multi?: boolean }) {
  return (
    <button
      type="button"
      role={multi ? "checkbox" : "radio"}
      aria-checked={checked}
      onClick={onClick}
      className={`flex min-h-[52px] w-full items-center gap-3 rounded-field border-2 bg-white px-4 text-left text-body font-medium text-ink transition duration-quick focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${checked ? "border-ink" : "border-transparent ring-1 ring-ink-100 hover:ring-ink-400"}`}
    >
      <span
        aria-hidden="true"
        className={`grid h-5 w-5 shrink-0 place-items-center border-2 ${multi ? "rounded-md" : "rounded-full"} ${checked ? "border-ink bg-ink text-cream" : "border-ink-400"}`}
      >
        {checked && (multi ? <IconCheck size={12} strokeWidth={3.5} /> : <span className="h-2 w-2 rounded-full bg-cream" />)}
      </span>
      {label}
    </button>
  );
}

function MoneyInput({ id, label, currency, value, onChange, error }: { id: string; label: string; currency: string; value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-ink-600" aria-hidden="true">
          {currency === "NGN" ? "₦" : "£"}
        </span>
        <input
          id={id}
          className="input num pl-9"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
          aria-invalid={!!error}
          aria-label={`${label}, in ${currency === "NGN" ? "naira" : "pounds"}`}
        />
      </div>
      <FieldError msg={error} />
    </div>
  );
}

function Stepper({ id, label, value, onChange, min, max, error }: { id: string; label: string; value: string; onChange: (v: string) => void; min: number; max: number; error?: string }) {
  const n = parseInt(value) || min;
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="flex items-center gap-1 rounded-field bg-white p-1 ring-1 ring-ink-400">
        <button type="button" className="btn-icon text-xl" onClick={() => onChange(String(Math.max(min, n - 1)))} aria-label={`${label}: one month fewer`}>−</button>
        <input
          id={id}
          className="num w-full min-w-0 bg-transparent text-center text-lg font-semibold text-ink focus:outline-none"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          aria-invalid={!!error}
          aria-describedby={`${id}-unit`}
        />
        <button type="button" className="btn-icon text-xl" onClick={() => onChange(String(Math.min(max, n + 1)))} aria-label={`${label}: one month more`}>+</button>
      </div>
      <p id={`${id}-unit`} className="mt-1 text-center text-caption text-ink-600">months</p>
      <FieldError msg={error} />
    </div>
  );
}

function NameTag({ name }: { name: string }) {
  const letters = name.trim().slice(0, 24).split("");
  return (
    <div className="mt-5 flex items-center gap-3" aria-hidden="true">
      <Pea size={64} mood={letters.length ? "happy" : "awake"} tone="fresh" className={letters.length ? "animate-wiggle" : ""} key={letters.length > 0 ? "on" : "off"} />
      <div className="min-w-0 flex-1 overflow-hidden rounded-panel bg-white ring-1 ring-ink-100">
        <p className="bg-ink px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-cream">Hello, my name is</p>
        <p className="flex h-12 items-center overflow-hidden whitespace-pre px-3 font-display text-2xl font-extrabold text-ink">
          {letters.length === 0 ? <span className="text-ink-300">…</span> : letters.map((l, i) => (
            <span key={`${i}-${l}`} className="inline-block animate-pop-in">{l}</span>
          ))}
        </p>
      </div>
    </div>
  );
}

function HabitPod({ answered, current }: { answered: string[]; current: string }) {
  const n = answered.length;
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-caption text-ink-600">Living habits</p>
        <span className="num inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-xs font-semibold text-cream" aria-live="polite">
          <span className={`h-2 w-2 rounded-full ${n ? "bg-pea-300" : "bg-ink-400"}`} aria-hidden="true" />
          {n} of 6 peas awake
        </span>
      </div>
      <div className="mt-2 rounded-full bg-brand-600 p-1.5" aria-hidden="true">
        <div className="grid grid-cols-6 justify-items-center rounded-full bg-brand-100 px-1 py-1">
          {QUESTIONNAIRE.map((q) => {
            const on = answered.includes(q.id);
            return (
              <span key={q.id} className={`${on ? "animate-pop-in" : ""} ${q.id === current && !on ? "rounded-full ring-2 ring-pea-500 ring-offset-1 ring-offset-brand-100" : ""}`}>
                <Pea size={40} tone={HABIT_ASK[q.id].tone} mood={on ? "awake" : "sleep"} dim={!on} blink={on} className="h-9 w-9 sm:h-10 sm:w-10" />
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Done({ name, published, matches, surveyFailed }: { name: string; published: { score: number; pending: boolean }; matches: Candidate[] | null; surveyFailed?: boolean }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);

  return (
    <div data-no-bottom-nav className="-mx-4 -my-6 min-h-[calc(100dvh-92px)] bg-pastel px-4 pb-24 pt-8 md:mx-auto md:my-0 md:max-w-xl md:rounded-sheet md:px-8 md:pb-10">
      <div className="flex justify-center gap-0.5" aria-hidden="true">
        {QUESTIONNAIRE.map((q, i) => (
          <span key={q.id} className="animate-pop-in" style={{ animationDelay: `${i * 70}ms` }}>
            <Pea size={44} tone={HABIT_ASK[q.id].tone} mood={i % 2 ? "happy" : "wow"} className="animate-bob" />
          </span>
        ))}
      </div>

      {surveyFailed && (
        <p role="status" className="mx-auto mt-4 max-w-md rounded-field border border-caution-200 bg-caution-50 px-3 py-2 text-center text-sm text-caution-800">
          We couldn&apos;t save your survey email choice. You can set it in <Link href="/settings" className="font-semibold underline underline-offset-2">Settings</Link>.
        </p>
      )}
      {published.pending ? (
        <div className="mt-6 text-center">
          <h1 ref={headingRef} tabIndex={-1} className="font-display text-display text-ink focus:outline-none">Profile submitted</h1>
          <p className="mx-auto mt-3 max-w-md text-ink-700">
            Our team will check your identity with a short call before you appear to other members. We&apos;ll email you to arrange it. You can look around in the meantime.
          </p>
          <Link href="/discover" className="btn-primary btn-lg mt-6 w-full sm:w-auto">Look around <IconArrowRight size={18} /></Link>
        </div>
      ) : (
        <>
          <div className="mt-6 text-center">
            <h1 ref={headingRef} tabIndex={-1} className="font-display text-display text-ink focus:outline-none">
              Your profile is ready{name ? `, ${name}` : ""}
            </h1>
            <p className="mx-auto mt-3 max-w-md text-ink-700">
              You&apos;re visible to people whose plans fit yours. Demo checks: <strong className="num">{published.score}/100</strong>.
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-ink-600">Checks completed — not a guarantee of safety.</p>
          </div>

          <section aria-labelledby="first-matches" className="mt-8">
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="first-matches" className="text-h2 text-ink">Your first matches</h2>
              {matches && matches.length > 0 && (
                <span className="num text-sm font-medium text-ink-700">{matches.length} {matches.length === 1 ? "person fits" : "people fit"} right now</span>
              )}
            </div>
            {IS_RESEARCH && matches && matches.length > 0 && (
              <p className="mt-1 text-sm text-ink-600">Everyone here is a sample housemate created for your test. They reply automatically.</p>
            )}

            {matches === null ? (
              <div className="mt-4 space-y-3" aria-busy="true" aria-label="Loading your matches">
                {[0, 1, 2].map((i) => <div key={i} className="skeleton h-24" />)}
              </div>
            ) : matches.length === 0 ? (
              <div className="mt-4 rounded-card bg-white p-5 text-center ring-1 ring-ink-100">
                <p className="font-semibold text-ink">No one fits all your must-haves yet</p>
                <p className="mt-1 text-sm text-ink-700">Discover shows which of your filters are the narrowest, so you can widen one.</p>
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {matches.slice(0, 3).map((m, i) => (
                  <li key={m.userId} className="animate-rise-in" style={{ animationDelay: `${200 + i * 120}ms` }}>
                    <Link href={`/members/${m.userId}`} className="flex items-center gap-3 rounded-card bg-white p-4 ring-1 ring-ink-100 transition duration-quick hover:ring-ink-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full font-bold ${["bg-lilac-100 text-lilac-800", "bg-sky-100 text-sky-800", "bg-apricot-100 text-apricot-800"][i % 3]}`}>
                        {m.avatarInitials}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-ink">{m.displayName}</span>
                          {IS_RESEARCH && <span className="chip-sample">Sample</span>}
                        </span>
                        <span className="mt-0.5 flex items-start gap-1.5 text-sm text-ink-700">
                          <span className="mt-0.5 text-brand-600"><IconCheck size={14} strokeWidth={2.5} /></span>
                          <span className="line-clamp-2">{m.reasons[0] ?? "Your plans fit"}</span>
                        </span>
                      </span>
                      <IconArrowRight size={18} className="shrink-0 text-ink-600" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/discover" className="btn-primary btn-lg mt-6 w-full">
              {matches && matches.length > 0 ? "See all my matches" : "Go to Discover"} <IconArrowRight size={18} />
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
