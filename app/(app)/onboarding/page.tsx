"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client";
import { CITIES, JOURNEYS, QUESTIONNAIRE, CityId } from "@/lib/constants";

type Prefs = Record<string, { own: string; accepted: string[] }>;

const STEPS = ["Journey", "Destination", "Budget & dates", "Living habits", "About you", "Publish"];

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [topError, setTopError] = useState<string | null>(null);

  // form state
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
  const [prefs, setPrefs] = useState<Prefs>(() => {
    const p: Prefs = {};
    for (const q of QUESTIONNAIRE) p[q.id] = { own: q.values[0].id, accepted: q.values.map((v) => v.id) };
    return p;
  });
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [published, setPublished] = useState<{ score: number } | null>(null);

  // Resume from existing data
  useEffect(() => {
    api<any>("/me").then((me) => {
      if (me.profile?.journey) setJourney(me.profile.journey);
      if (me.displayName && !me.displayName.includes("@")) setDisplayName(me.displayName);
      if (me.profile?.bio) setBio(me.profile.bio);
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
        if (s.preferences?.length) {
          setPrefs((prev) => {
            const next = { ...prev };
            for (const p of s.preferences) next[p.dimension] = { own: p.ownAnswer, accepted: p.acceptedValues };
            return next;
          });
        }
      }
      if (me.profile?.publicationStatus === "published") router.replace("/discover");
    }).catch(() => {});
  }, [router]);

  const cityCfg = city ? CITIES[city] : null;

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

  async function saveStep(): Promise<boolean> {
    setBusy(true);
    setErrors({});
    setTopError(null);
    try {
      if (step === 0) {
        if (!journey) { setErrors({ journey: "Choose a journey." }); return false; }
        await api("/me/profile", { method: "PATCH", body: { journey } });
      } else if (step === 1) {
        if (!city) { setErrors({ city: "Choose a city." }); return false; }
        if (areas.length === 0) { setErrors({ areas: "Choose at least one area." }); return false; }
        await api("/me/search", { method: "PATCH", body: { cityId: city, areaIds: areas, rentPeriod: period, locationDetail } });
      } else if (step === 2) {
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
      } else if (step === 3) {
        await api("/me/search", {
          method: "PATCH",
          body: { preferences: QUESTIONNAIRE.map((q) => ({ dimension: q.id, ownAnswer: prefs[q.id].own, acceptedValues: prefs[q.id].accepted })) },
        });
      } else if (step === 4) {
        await api("/me/profile", { method: "PATCH", body: { displayName, bio } });
      }
      return true;
    } catch (e) {
      if (e instanceof ApiClientError) {
        setErrors(e.fieldErrors ?? {});
        setTopError(e.message);
      }
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    if (await saveStep()) setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }
  async function publish() {
    setBusy(true);
    setTopError(null);
    try {
      const data = await api<{ credibility: { score: number } }>("/me/search/publish", { body: {} });
      setPublished({ score: data.credibility.score });
    } catch (e) {
      setTopError(e instanceof ApiClientError ? e.message : "Could not publish.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Step indicator */}
      <ol className="mb-6 flex flex-wrap items-center gap-2 text-xs font-medium">
        {STEPS.map((s, i) => (
          <li key={s} className={`chip ${i === step ? "bg-brand-600 text-white" : i < step ? "bg-brand-100 text-brand-700" : "bg-stone-100 text-stone-500"}`}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      {topError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {topError}
        </div>
      )}

      <div className="card p-6">
        {step === 0 && (
          <fieldset>
            <legend className="text-xl font-bold text-stone-900">What are you looking to do?</legend>
            <div className="mt-4 space-y-3">
              {JOURNEYS.map((j) => (
                <button key={j.id} onClick={() => setJourney(j.id)}
                  className={`w-full rounded-lg border p-4 text-left transition ${journey === j.id ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500" : "border-stone-300 hover:bg-stone-50"}`}>
                  <div className="font-semibold text-stone-900">{j.label}</div>
                  <div className="mt-1 text-sm text-stone-600">{j.help}</div>
                </button>
              ))}
            </div>
            {errors.journey && <p className="field-error">{errors.journey}</p>}
          </fieldset>
        )}

        {step === 1 && (
          <fieldset>
            <legend className="text-xl font-bold text-stone-900">Where are you looking?</legend>
            <p className="mt-1 text-sm text-stone-600">This prototype supports London and Lagos.</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {(Object.keys(CITIES) as CityId[]).map((c) => (
                <button key={c} onClick={() => { setCity(c); setAreas([]); setPeriod(CITIES[c].defaultPeriod); }}
                  className={`rounded-lg border p-4 text-left ${city === c ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500" : "border-stone-300 hover:bg-stone-50"}`}>
                  <div className="font-semibold">{CITIES[c].label}</div>
                  <div className="text-sm text-stone-500">{CITIES[c].currency}</div>
                </button>
              ))}
            </div>
            {errors.city && <p className="field-error">{errors.city}</p>}
            {cityCfg && (
              <div className="mt-6">
                <p className="label">Preferred areas (up to 5)</p>
                <div className="flex flex-wrap gap-2">
                  {cityCfg.areas.map((a) => (
                    <button key={a.id} onClick={() => toggleArea(a.id)}
                      className={`chip border ${areas.includes(a.id) ? "border-brand-500 bg-brand-100 text-brand-800" : "border-stone-300 bg-white text-stone-600"}`}>
                      {a.label}
                    </button>
                  ))}
                </div>
                {errors.areas && <p className="field-error">{errors.areas}</p>}
              </div>
            )}
            {cityCfg && (
              <div className="mt-6">
                <label className="label" htmlFor="loc">
                  {city === "london" ? "Postcode or address (optional)" : "Address (optional)"}
                </label>
                <input
                  id="loc"
                  className="input"
                  value={locationDetail}
                  onChange={(e) => setLocationDetail(e.target.value)}
                  placeholder={
                    city === "london"
                      ? "e.g. E8 3RH, or a street / area you have in mind"
                      : "e.g. 12 Herbert Macaulay Way, Yaba"
                  }
                  maxLength={200}
                />
                <p className="mt-1 text-xs text-stone-400">
                  Private — only you see this. It never appears on your public profile card.
                </p>
                {errors.locationDetail && <p className="field-error">{errors.locationDetail}</p>}
              </div>
            )}
          </fieldset>
        )}

        {step === 2 && (
          <fieldset>
            <legend className="text-xl font-bold text-stone-900">Budget &amp; move-in dates</legend>
            <p className="mt-1 text-sm text-stone-600">Rent per person, in {cityCfg?.currency}.</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="rmin">Minimum</label>
                <input id="rmin" className="input" inputMode="numeric" value={rentMin} onChange={(e) => setRentMin(e.target.value)} />
                {errors.rentMinMinor && <p className="field-error">{errors.rentMinMinor}</p>}
              </div>
              <div>
                <label className="label" htmlFor="rmax">Maximum</label>
                <input id="rmax" className="input" inputMode="numeric" value={rentMax} onChange={(e) => setRentMax(e.target.value)} />
                {errors.rentMaxMinor && <p className="field-error">{errors.rentMaxMinor}</p>}
              </div>
            </div>
            <div className="mt-3">
              <label className="label">Period</label>
              <div className="flex gap-2">
                {(["month", "year"] as const).map((p) => (
                  <button key={p} onClick={() => setPeriod(p)} className={`chip border ${period === p ? "border-brand-500 bg-brand-100 text-brand-800" : "border-stone-300 bg-white"}`}>per {p}</button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <label className="label">Move-in timing</label>
              <div className="flex gap-2">
                {(["exact", "range"] as const).map((m) => (
                  <button key={m} onClick={() => setMoveMode(m)} className={`chip border ${moveMode === m ? "border-brand-500 bg-brand-100 text-brand-800" : "border-stone-300 bg-white"}`}>{m === "exact" ? "Exact date" : "Date range"}</button>
                ))}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="e">{moveMode === "exact" ? "Move-in date" : "Earliest"}</label>
                <input id="e" type="date" className="input" value={earliest} onChange={(e) => setEarliest(e.target.value)} />
                {errors.earliestDate && <p className="field-error">{errors.earliestDate}</p>}
              </div>
              {moveMode === "range" && (
                <div>
                  <label className="label" htmlFor="l">Latest</label>
                  <input id="l" type="date" className="input" value={latest} onChange={(e) => setLatest(e.target.value)} />
                  {errors.latestDate && <p className="field-error">{errors.latestDate}</p>}
                </div>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="sm">Min stay (months)</label>
                <input id="sm" className="input" inputMode="numeric" value={stayMin} onChange={(e) => setStayMin(e.target.value)} />
                {errors.stayMinMonths && <p className="field-error">{errors.stayMinMonths}</p>}
              </div>
              <div>
                <label className="label" htmlFor="sx">Max stay (months)</label>
                <input id="sx" className="input" inputMode="numeric" value={stayMax} onChange={(e) => setStayMax(e.target.value)} />
                {errors.stayMaxMonths && <p className="field-error">{errors.stayMaxMonths}</p>}
              </div>
            </div>
          </fieldset>
        )}

        {step === 3 && (
          <fieldset>
            <legend className="text-xl font-bold text-stone-900">Living habits</legend>
            <p className="mt-1 text-sm text-stone-600">Your answer, plus what you&apos;d accept in a housemate. Anything you leave selected is &quot;accepted&quot;.</p>
            <div className="mt-4 space-y-5">
              {QUESTIONNAIRE.map((q) => (
                <div key={q.id} className="rounded-lg border border-stone-200 p-4">
                  <p className="font-medium text-stone-900">{q.label}</p>
                  <div className="mt-2">
                    <p className="text-xs font-medium text-stone-500">You</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {q.values.map((v) => (
                        <button key={v.id} onClick={() => setPrefs((p) => ({ ...p, [q.id]: { own: v.id, accepted: p[q.id].accepted.includes(v.id) ? p[q.id].accepted : [...p[q.id].accepted, v.id] } }))}
                          className={`chip border ${prefs[q.id].own === v.id ? "border-brand-500 bg-brand-600 text-white" : "border-stone-300 bg-white text-stone-600"}`}>{v.label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="text-xs font-medium text-stone-500">Accept in a housemate</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {q.values.map((v) => (
                        <button key={v.id} onClick={() => toggleAccepted(q.id, v.id)}
                          className={`chip border ${prefs[q.id].accepted.includes(v.id) ? "border-brand-300 bg-brand-50 text-brand-700" : "border-stone-200 bg-stone-50 text-stone-400 line-through"}`}>{v.label}</button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
        )}

        {step === 4 && (
          <fieldset>
            <legend className="text-xl font-bold text-stone-900">About you</legend>
            <div className="mt-4">
              <label className="label" htmlFor="dn">Display name</label>
              <input id="dn" className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Alex M." />
              {errors.displayName && <p className="field-error">{errors.displayName}</p>}
            </div>
            <div className="mt-4">
              <label className="label" htmlFor="bio">Short bio (80–600 characters)</label>
              <textarea id="bio" className="input min-h-[120px]" value={bio} onChange={(e) => setBio(e.target.value)}
                placeholder="Tell potential housemates about your routine, what you're looking for, and what makes you easy to live with." />
              <p className="mt-1 text-xs text-stone-400">{bio.length} / 600</p>
              {errors.bio && <p className="field-error">{errors.bio}</p>}
            </div>
          </fieldset>
        )}

        {step === 5 && (
          <div>
            {published ? (
              <div className="text-center">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand-100 text-3xl">✅</div>
                <h2 className="mt-4 text-xl font-bold text-stone-900">You&apos;re live!</h2>
                <p className="mt-2 text-stone-600">Your demo credibility is <strong>{published.score}/100</strong>. Discovery is on.</p>
                <button className="btn-primary mt-6" onClick={() => router.push("/discover")}>Start discovering</button>
              </div>
            ) : (
              <div>
                <h2 className="text-xl font-bold text-stone-900">Ready to publish</h2>
                <p className="mt-2 text-sm text-stone-600">
                  Publishing runs a simulated core identity check (demo) and gives you a baseline demo
                  credibility of 60 (identity 40 + email 10 + phone 10). Your profile becomes discoverable.
                </p>
                <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm">
                  <p><span className="text-stone-500">Journey:</span> {JOURNEYS.find((j) => j.id === journey)?.label}</p>
                  <p><span className="text-stone-500">City:</span> {city && CITIES[city].label}</p>
                  <p><span className="text-stone-500">Areas:</span> {areas.map((a) => cityCfg?.areas.find((x) => x.id === a)?.label).join(", ")}</p>
                  <p><span className="text-stone-500">Move-in:</span> {earliest}{moveMode === "range" ? ` → ${latest}` : ""}</p>
                </div>
                <button className="btn-primary mt-6 w-full" onClick={publish} disabled={busy}>
                  {busy ? "Publishing…" : "Publish my profile"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Nav buttons */}
        {!(step === 5 && published) && (
          <div className="mt-6 flex justify-between">
            <button className="btn-secondary" disabled={step === 0 || busy} onClick={() => setStep((s) => Math.max(0, s - 1))}>Back</button>
            {step < 5 ? (
              <button className="btn-primary" disabled={busy} onClick={next}>{busy ? "Saving…" : "Next"}</button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
