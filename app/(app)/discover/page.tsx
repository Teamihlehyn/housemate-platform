"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiClientError, newIdempotencyKey } from "@/lib/client";
import { formatMoney } from "@/lib/money";
import { formatDateRange } from "@/lib/dates";
import { CITIES } from "@/lib/constants";
import Pea from "@/components/brand/Pea";
import { IconCalendar, IconCheck, IconWallet } from "@/components/icons";

// Avatar tints are chosen from the id, never from gender or anything personal.
const TINTS = ["bg-lilac-100 text-lilac-800", "bg-sky-100 text-sky-800", "bg-apricot-100 text-apricot-800", "bg-pea-100 text-ink"];

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

  useEffect(() => {
    api<{ candidates: Candidate[]; exclusions: any; gate?: string | null }>("/recommendations")
      .then((d) => {
        setCandidates(d.candidates);
        setExclusions(d.exclusions);
        setIdentityPending(d.gate === "identity_pending");
      })
      .catch((e) => { if (e instanceof ApiClientError && e.status === 403) router.replace("/onboarding"); })
      .finally(() => setLoading(false));
  }, [router]);

  const visible = candidates.filter((c) => !passed.has(c.userId));

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-48" />
        {[0, 1, 2].map((i) => <div key={i} className="skeleton h-44" />)}
      </div>
    );
  }

  if (identityPending) {
    // DES-04 "Verification pending": the API returns no candidates until identity is checked.
    return (
      <div className="mx-auto max-w-lg">
        <div className="card p-6 text-center sm:p-8">
          <div className="flex justify-center gap-1" aria-hidden="true">
            <Pea size={64} mood="awake" blink />
            <Pea size={64} mood="sleep" tone="fresh" dim />
          </div>
          <h1 className="mt-4 font-display text-h1 text-ink">Your ID check is next</h1>
          <p className="mt-2 text-ink-700">
            Before you can see other members, someone from our team checks your photo ID on a 10-minute video call.
            We&apos;ll email you within a day to book it. Nobody can see your profile until then.
          </p>
          <Link href="/profile" className="btn-secondary mt-6">Check my profile</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-h1 text-ink md:text-h1-md">Discover housemates</h1>
        <p className="mt-1 text-sm text-ink-600">Ranked by shared dates, areas and living habits.</p>
      </div>

      {process.env.NEXT_PUBLIC_APP_ENV === "research" && (
        <div className="mb-5 rounded-panel border border-dashed border-ink-400 bg-white p-4 text-sm text-ink-700">
          Everyone here is a <strong>sample housemate</strong> created for your test, matched to what you entered. They reply
          automatically, so you can introduce yourself, chat, agree a household plan and book a viewing on your own.
        </div>
      )}

      {visible.length === 0 ? (
        <div className="card p-6 text-center sm:p-8">
          <div className="flex justify-center" aria-hidden="true"><Pea size={64} mood="sleep" /></div>
          <h2 className="mt-3 text-h2 text-ink">No one fits all your must-haves yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-600">
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
            <div key={c.userId} className="card flex flex-col p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className={`grid h-12 w-12 shrink-0 place-items-center rounded-full font-bold ${TINTS[c.userId.charCodeAt(c.userId.length - 1) % TINTS.length]}`}>{c.avatarInitials}</span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-ink">{c.displayName}</span>
                    {process.env.NEXT_PUBLIC_APP_ENV === "research" && <span className="chip-sample">Sample</span>}
                  </p>
                  <p className="truncate text-sm text-ink-600">{c.areas.map((a) => areaLabel(c.cityId, a)).join(", ")}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink-700">
                <span className="num inline-flex items-center gap-1.5"><IconWallet size={16} className="text-ink-600" />{formatMoney(c.rentMinMinor, c.currency)}–{formatMoney(c.rentMaxMinor, c.currency)}/{c.rentPeriod === "year" ? "yr" : "mo"}</span>
                {c.earliestDate && c.latestDate && <span className="inline-flex items-center gap-1.5"><IconCalendar size={16} className="text-ink-600" />{formatDateRange(c.earliestDate, c.latestDate)}</span>}
              </div>

              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-600">Why you match</p>
              <ul className="mt-1.5 space-y-1 text-sm text-ink-700">
                {c.reasons.map((r, i) => (
                  <li key={i} className="flex gap-2"><IconCheck size={16} strokeWidth={2.5} className="mt-0.5 shrink-0 text-brand-600" />{r}</li>
                ))}
              </ul>

              <div className="mt-4 grid grid-cols-[1fr_1fr_auto] gap-2 border-t border-ink-100 pt-4">
                <Link href={`/members/${c.userId}`} className="btn-secondary px-3">Profile</Link>
                <button className="btn-primary px-3" onClick={() => setComposerFor(c)}>Introduce</button>
                <button className="btn-ghost px-3" onClick={() => setPassed((p) => new Set(p).add(c.userId))} aria-label={`Not for me: hide ${c.displayName} for now`}>Not for me</button>
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
    <div className="fixed inset-0 z-50 grid items-end bg-black/40 sm:place-items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="intro-title" className="w-full animate-sheet-in rounded-t-sheet bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:max-w-md sm:rounded-sheet sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-ink-100 sm:hidden" aria-hidden="true" />
        <h2 id="intro-title" className="text-h2 text-ink">Introduce yourself to {candidate.displayName}</h2>
        <p className="mt-1 text-sm text-ink-600">30–300 characters. Mention your dates and what you&apos;re looking for.</p>
        <textarea autoFocus aria-label="Your introduction" data-clarity-mask="true" className="input mt-3 min-h-[120px]" value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Hi! I'm also looking around your dates and areas…" />
        <p className="num mt-1 text-sm text-ink-600">{text.length < 30 ? `${30 - text.length} more characters to go` : `${text.length} / 300`}</p>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1" onClick={() => (text.trim().length < 30 ? setError("Write at least 30 characters so they know why you're getting in touch.") : send())} aria-busy={busy}>{busy ? "Sending…" : "Send introduction"}</button>
        </div>
      </div>
    </div>
  );
}
