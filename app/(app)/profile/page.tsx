"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/client";
import { formatMoney } from "@/lib/money";
import { formatDateRange } from "@/lib/dates";
import { CITIES, QUESTIONNAIRE, answerLabel } from "@/lib/constants";

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

  if (loading) return <div className="h-64 animate-pulse rounded-xl bg-stone-200" />;
  if (!me) return null;

  const s = me.search;
  const city = s?.cityId ? CITIES[s.cityId as keyof typeof CITIES] : null;
  const published = me.profile?.publicationStatus === "published";

  if (!published) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <h1 className="text-xl font-bold text-stone-900">Finish setting up your profile</h1>
        <p className="mt-2 text-sm text-stone-600">You haven&apos;t published yet.</p>
        <Link href="/onboarding" className="btn-primary mt-4">Continue onboarding</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-900">Your profile</h1>
        <span className={`chip ${s.status === "active" ? "bg-brand-100 text-brand-800" : "bg-stone-200 text-stone-600"}`}>
          Search {s.status}
        </span>
      </div>

      {msg && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">{msg}</div>}

      <div className="card p-6">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">{me.profile.avatarInitials}</span>
          <div>
            <h2 className="text-lg font-bold text-stone-900">{me.displayName}</h2>
            <p className="text-sm text-stone-500">{city?.label} · {s.areas.map((a: string) => city?.areas.find((x) => x.id === a)?.label).join(", ")}</p>
          </div>
        </div>
        <p className="mt-4 text-stone-700">{me.profile.bio}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-stone-50 p-3">
            <p className="text-stone-500">Budget</p>
            <p className="font-medium text-stone-900">{formatMoney(s.rentMinMinor, s.currency)}–{formatMoney(s.rentMaxMinor, s.currency)}/{s.rentPeriod === "year" ? "yr" : "mo"}</p>
          </div>
          <div className="rounded-lg bg-stone-50 p-3">
            <p className="text-stone-500">Move-in</p>
            <p className="font-medium text-stone-900">{s.earliestDate ? formatDateRange(s.earliestDate, s.latestDate) : "Flexible"}</p>
          </div>
        </div>
      </div>

      <div className="card mt-4 p-6">
        <h3 className="font-semibold text-stone-900">Demo credibility: {me.credibility.score}/100</h3>
        <p className="text-xs text-stone-500">Checks completed — not a guarantee of safety.</p>
        <ul className="mt-3 space-y-1.5 text-sm">
          {me.credibility.components.map((c: any) => (
            <li key={c.category} className="flex justify-between border-b border-stone-100 pb-1.5">
              <span className="capitalize text-stone-600">{c.category === "additional" ? "Additional evidence" : c.category}</span>
              <span className={c.earned > 0 ? "font-medium text-stone-800" : "text-stone-400"}>{c.earned}/{c.available}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card mt-4 p-6">
        <h3 className="font-semibold text-stone-900">Living habits</h3>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          {QUESTIONNAIRE.map((q) => {
            const p = s.preferences.find((x: any) => x.dimension === q.id);
            return (
              <div key={q.id} className="flex justify-between border-b border-stone-100 py-1.5 text-sm">
                <dt className="text-stone-500">{q.label}</dt>
                <dd className="font-medium text-stone-800">{p ? answerLabel(q.id, p.ownAnswer) : "—"}</dd>
              </div>
            );
          })}
        </dl>
      </div>

      <div className="mt-4 flex gap-2">
        {s.status === "active" && <button className="btn-secondary" onClick={() => status("pause")}>Pause search</button>}
        {s.status === "paused" && <button className="btn-primary" onClick={() => status("resume")}>Resume search</button>}
        <Link href="/settings" className="btn-secondary">Settings &amp; privacy</Link>
      </div>
    </div>
  );
}
