"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiClientError, newIdempotencyKey } from "@/lib/client";
import { formatMoney } from "@/lib/money";
import { formatDateRange } from "@/lib/dates";
import { CITIES } from "@/lib/constants";

interface Candidate {
  userId: string;
  displayName: string;
  avatarInitials: string | null;
  cityId: string;
  areas: string[];
  rentMinMinor: number;
  rentMaxMinor: number;
  currency: string;
  rentPeriod: string;
  earliestDate: string | null;
  latestDate: string | null;
  bio: string | null;
  score: number;
  reasons: string[];
}

function areaLabel(city: string, area: string) {
  return CITIES[city as keyof typeof CITIES]?.areas.find((a) => a.id === area)?.label ?? area;
}

export default function Discover() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [exclusions, setExclusions] = useState<{ narrowFilters: string[]; excludedCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [passed, setPassed] = useState<Set<string>>(new Set());
  const [composerFor, setComposerFor] = useState<Candidate | null>(null);
  const [identityPending, setIdentityPending] = useState(false);
  const isBeta = process.env.NEXT_PUBLIC_APP_ENV === "beta";

  useEffect(() => {
    api<{ candidates: Candidate[]; exclusions: any }>("/recommendations")
      .then((d) => { setCandidates(d.candidates); setExclusions(d.exclusions); })
      .catch((e) => { if (e instanceof ApiClientError && e.status === 403) router.replace("/onboarding"); })
      .finally(() => setLoading(false));
    if (isBeta) {
      api<{ credibility: { components: { category: string; status: string }[] } }>("/me")
        .then((m) => {
          const id = m.credibility.components.find((c) => c.category === "identity");
          setIdentityPending(id?.status !== "verified");
        })
        .catch(() => {});
    }
  }, [router, isBeta]);

  const visible = candidates.filter((c) => !passed.has(c.userId));

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-stone-200" />
        {[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-xl bg-stone-200" />)}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">Discover housemates</h1>
        <p className="text-sm text-stone-600">Ranked by shared dates, areas and living habits. The number is match strength, not a percentage.</p>
      </div>

      {identityPending && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-semibold text-amber-900">Identity verification pending</p>
          <p className="mt-1 text-sm text-amber-800">
            You can browse, but you&apos;ll only appear to others and be able to send introductions once our team
            verifies your identity. We&apos;ll email you to arrange a short check.
          </p>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-3xl">🔍</p>
          <h2 className="mt-3 font-semibold text-stone-900">No matches right now</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-stone-600">
            {exclusions && exclusions.excludedCount > 0
              ? `We checked ${exclusions.excludedCount} nearby ${exclusions.excludedCount === 1 ? "person" : "people"} but none fit all your hard constraints yet.`
              : "There aren't compatible members in your city yet."}
            {exclusions && exclusions.narrowFilters.length > 0 && (
              <> Your narrowest filters: <strong>{exclusions.narrowFilters.join(", ")}</strong>.</>
            )}
          </p>
          <Link href="/profile" className="btn-secondary mt-5">Adjust my search</Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((c) => (
            <div key={c.userId} className="card flex flex-col p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-100 font-bold text-brand-700">{c.avatarInitials}</span>
                  <div>
                    <p className="font-semibold text-stone-900">{c.displayName}</p>
                    <p className="text-xs text-stone-500">{c.areas.map((a) => areaLabel(c.cityId, a)).join(", ")}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="chip bg-brand-100 text-brand-800">Demo {c.score}/100</span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-600">
                <span>💷 {formatMoney(c.rentMinMinor, c.currency)}–{formatMoney(c.rentMaxMinor, c.currency)}/{c.rentPeriod === "year" ? "yr" : "mo"}</span>
                {c.earliestDate && c.latestDate && <span>📅 {formatDateRange(c.earliestDate, c.latestDate)}</span>}
              </div>

              <ul className="mt-3 space-y-1 text-sm text-stone-700">
                {c.reasons.map((r, i) => (
                  <li key={i} className="flex gap-2"><span className="text-brand-600">✓</span>{r}</li>
                ))}
              </ul>

              <div className="mt-4 flex gap-2 border-t border-stone-100 pt-4">
                <Link href={`/members/${c.userId}`} className="btn-secondary flex-1">View profile</Link>
                <button className="btn-primary flex-1" onClick={() => setComposerFor(c)}>Introduce</button>
                <button className="btn-ghost" onClick={() => setPassed((p) => new Set(p).add(c.userId))} aria-label="Pass">Pass</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {composerFor && (
        <IntroComposer candidate={composerFor} onClose={() => setComposerFor(null)}
          onSent={() => { setComposerFor(null); router.push("/messages"); }} />
      )}
    </div>
  );
}

function IntroComposer({ candidate, onClose, onSent }: { candidate: Candidate; onClose: () => void; onSent: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key] = useState(newIdempotencyKey);

  async function send() {
    setBusy(true); setError(null);
    try {
      const res = await api<{ already?: boolean }>("/introductions", {
        body: { target_user_id: candidate.userId, text },
        idempotencyKey: key,
      });
      if (res.already) setError("You already have an introduction with this member.");
      else onSent();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not send.");
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-stone-900">Introduce yourself to {candidate.displayName}</h2>
        <p className="mt-1 text-sm text-stone-600">30–300 characters. Mention your dates and what you&apos;re looking for.</p>
        <textarea className="input mt-3 min-h-[120px]" value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Hi! I'm also looking around your dates and areas…" />
        <p className="mt-1 text-xs text-stone-400">{text.length} / 300</p>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1" onClick={send} disabled={busy || text.length < 30}>{busy ? "Sending…" : "Send introduction"}</button>
        </div>
      </div>
    </div>
  );
}
