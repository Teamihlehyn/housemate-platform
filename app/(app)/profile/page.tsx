"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/client";
import { formatMoney } from "@/lib/money";
import { formatDateRange } from "@/lib/dates";
import { CITIES, GENDERS, GENDER_IDS, OWN_GENDER_OPTIONS, QUESTIONNAIRE, answerLabel } from "@/lib/constants";
import GenderPreferenceFields from "@/components/GenderPreferenceFields";
import { ChecksCard } from "@/components/ChecksCard";

const IS_BETA = process.env.NEXT_PUBLIC_APP_ENV === "beta";

export default function Profile() {
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => api<any>("/me").then(setMe).finally(() => setLoading(false)), []);
  useEffect(() => { load(); }, [load]);

  async function status(action: string) {
    setMsg(null);
    try { await api("/me/search/status", { body: { action } }); await load(); }
    catch (e) { setMsg(e instanceof ApiClientError ? e.message : "Failed"); }
  }

  if (loading) return <div className="h-64 animate-pulse rounded-xl bg-ink-100" />;
  if (!me) return null;

  const s = me.search;
  const city = s?.cityId ? CITIES[s.cityId as keyof typeof CITIES] : null;
  const published = me.profile?.publicationStatus === "published";

  if (!published) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <h1 className="text-xl font-bold text-ink">Finish setting up your profile</h1>
        <p className="mt-2 text-sm text-ink-600">You haven&apos;t published yet.</p>
        <Link href="/onboarding" className="btn-primary mt-4">Continue onboarding</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Your profile</h1>
        <span className={`chip ${s.status === "active" ? "bg-brand-100 text-brand-800" : "bg-ink-100 text-ink-600"}`}>
          Search {s.status}
        </span>
      </div>

      {msg && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">{msg}</div>}

      <div className="card p-6">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">{me.profile.avatarInitials}</span>
          <div>
            <h2 className="text-lg font-bold text-ink">{me.displayName}</h2>
            <p className="text-sm text-ink-600">{city?.label} · {s.areas.map((a: string) => city?.areas.find((x) => x.id === a)?.label).join(", ")}</p>
          </div>
        </div>
        <p className="mt-4 text-ink-700">{me.profile.bio}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-cream p-3">
            <p className="text-ink-600">Budget</p>
            <p className="font-medium text-ink">{formatMoney(s.rentMinMinor, s.currency)}–{formatMoney(s.rentMaxMinor, s.currency)}/{s.rentPeriod === "year" ? "yr" : "mo"}</p>
          </div>
          <div className="rounded-lg bg-cream p-3">
            <p className="text-ink-600">Move-in</p>
            <p className="font-medium text-ink">{s.earliestDate ? formatDateRange(s.earliestDate, s.latestDate) : "Flexible"}</p>
          </div>
        </div>
      </div>

      {/* Beta: completed checks, no number (ENG-04). Demo modes keep the labelled breakdown. */}
      {IS_BETA ? (
        <ChecksCard checks={me.credibility.checks ?? []} own as="h3" />
      ) : (
      <div className="card mt-4 p-6">
        <h3 className="font-semibold text-ink">Demo credibility: {me.credibility.score}/100</h3>
        <p className="text-xs text-ink-600">Checks completed — not a guarantee of safety.</p>
        <ul className="mt-3 space-y-1.5 text-sm">
          {me.credibility.components.map((c: any) => (
            <li key={c.category} className="flex justify-between border-b border-ink-100 pb-1.5">
              <span className="capitalize text-ink-600">{c.category === "additional" ? "Additional evidence" : c.category}</span>
              <span className={c.earned > 0 ? "font-medium text-ink" : "text-ink-500"}>{c.earned}/{c.available}</span>
            </li>
          ))}
        </ul>
      </div>
      )}

      <div className="card mt-4 p-6">
        <h3 className="font-semibold text-ink">Living habits</h3>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          {QUESTIONNAIRE.map((q) => {
            const p = s.preferences.find((x: any) => x.dimension === q.id);
            return (
              <div key={q.id} className="flex justify-between border-b border-ink-100 py-1.5 text-sm">
                <dt className="text-ink-600">{q.label}</dt>
                <dd className="font-medium text-ink">{p ? answerLabel(q.id, p.ownAnswer) : "—"}</dd>
              </div>
            );
          })}
        </dl>
      </div>

      <GenderCard search={s} onSaved={async (m) => { setMsg(m); await load(); }} />

      <div className="mt-4 flex gap-2">
        {s.status === "active" && <button className="btn-secondary" onClick={() => status("pause")}>Pause search</button>}
        {s.status === "paused" && <button className="btn-primary" onClick={() => status("resume")}>Resume search</button>}
        <Link href="/settings" className="btn-secondary">Settings &amp; privacy</Link>
      </div>
    </div>
  );
}

function GenderCard({ search, onSaved }: { search: any; onSaved: (msg: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [gender, setGender] = useState<string | null>(search.gender ?? null);
  const [accepts, setAccepts] = useState<string[]>(search.genderPreference ?? [...GENDER_IDS]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const savedAccepts: string[] = search.genderPreference ?? [...GENDER_IDS];
  const everyone = GENDER_IDS.every((g) => savedAccepts.includes(g));
  const genderLabel = OWN_GENDER_OPTIONS.find((o) => o.id === search.gender)?.label ?? "Not set";

  async function save() {
    setErrors({});
    if (!gender) return setErrors({ gender: "Choose an option — \"Prefer not to say\" is fine." });
    setBusy(true);
    try {
      await api("/me/search", { method: "PATCH", body: { gender, genderPreference: accepts } });
      setEditing(false);
      await onSaved("Saved. Your matches now reflect your housemate gender preference.");
    } catch (e) {
      if (e instanceof ApiClientError) setErrors(e.fieldErrors ?? { gender: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card mt-4 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-ink">Housemate gender</h3>
          <p className="text-xs text-ink-600">Private: only used to match you, never shown on your profile.</p>
        </div>
        {!editing && <button className="btn-secondary px-3 py-1.5 text-sm" onClick={() => setEditing(true)}>Edit</button>}
      </div>
      {editing ? (
        <div className="mt-4">
          <GenderPreferenceFields gender={gender} accepts={accepts} onChange={(n) => { setGender(n.gender); setAccepts(n.accepts); }} errors={errors} showPrivacyNote={false} />
          <div className="mt-4 flex gap-2">
            <button className="btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
            <button className="btn-ghost" onClick={() => { setEditing(false); setGender(search.gender ?? null); setAccepts(savedAccepts); setErrors({}); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="flex justify-between border-b border-ink-100 py-1.5 text-sm">
            <dt className="text-ink-600">Your gender</dt>
            <dd className="font-medium text-ink">{genderLabel}</dd>
          </div>
          <div className="flex justify-between border-b border-ink-100 py-1.5 text-sm">
            <dt className="text-ink-600">Open to living with</dt>
            <dd className="text-right font-medium text-ink">
              {everyone ? "Anyone" : GENDERS.filter((g) => savedAccepts.includes(g.id)).map((g) => g.plural).join(", ")}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}
