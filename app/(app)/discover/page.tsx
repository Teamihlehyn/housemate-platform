"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiClientError, newIdempotencyKey } from "@/lib/client";
import { formatMoney } from "@/lib/money";
import { formatDateRange } from "@/lib/dates";
import { CITIES } from "@/lib/constants";
import Pea from "@/components/brand/Pea";
import { IconCalendar, IconChat, IconCheck, IconWallet } from "@/components/icons";
import { IdCheckedChip } from "@/components/ChecksCard";
import SearchChips from "@/components/discover/SearchChips";
import ProfileStrength from "@/components/ProfileStrength";

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
  score?: number;
  idChecked?: boolean;
  testAccount?: boolean; // ENG-67: test environments only
  reasons: string[];
  /** ENG-69: open to anywhere in their city. */
  anyArea?: boolean;
  /** ENG-51: something from this person waiting for you (private to you). */
  activity?: { kind: "new_message"; href: string; count?: number } | { kind: "introduced"; href: string } | null;
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

  const [editSignal, setEditSignal] = useState(0);

  // Resolves to how many people fit, for the search chips' "Saved. 3 people fit now."
  const load = useCallback(
    () =>
      api<{ candidates: Candidate[]; exclusions: any; gate?: string | null }>("/recommendations")
        .then((d) => {
          setCandidates(d.candidates);
          setExclusions(d.exclusions);
          setIdentityPending(d.gate === "identity_pending");
          return d.candidates.length;
        })
        .catch((e) => { if (e instanceof ApiClientError && e.status === 403) router.replace("/onboarding"); return 0; })
        .finally(() => setLoading(false)),
    [router],
  );
  useEffect(() => { load(); }, [load]);

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
            Before you can see other users, someone from the Peabudy team checks your photo ID on a 10-minute video call.
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

      <SearchChips onSaved={load} openSignal={editSignal} />

      {/* DES-38: what's left to make your profile stronger; hide for a week, never nags. */}
      <ProfileStrength from="discover" dismissible headingLevel={2} className="mb-5" />

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
              : "There aren't any compatible users in your city yet."}
            {exclusions && exclusions.narrowFilters.length > 0 && (
              <> Your narrowest filters: <strong>{exclusions.narrowFilters.join(", ")}</strong>.</>
            )}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-600">Try another area or a wider budget. You can change them back any time.</p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <button type="button" className="btn-primary" onClick={() => setEditSignal((n) => n + 1)}>Change areas or budget</button>
            <Link href="/profile" className="btn-secondary">Dates and habits</Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((c) => (
            <div key={c.userId} className="card flex flex-col p-4 sm:p-5">
              <ActivityLink activity={c.activity} name={c.displayName} />
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className={`grid h-12 w-12 shrink-0 place-items-center rounded-full font-bold ${TINTS[c.userId.charCodeAt(c.userId.length - 1) % TINTS.length]}`}>{c.avatarInitials}</span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-ink">{c.displayName}</span>
                    {process.env.NEXT_PUBLIC_APP_ENV === "research" && <span className="chip-sample">Sample</span>}
                    {c.idChecked && <IdCheckedChip />}
                    {c.testAccount && <span className="chip bg-caution-50 text-caution-800">Test account — ID not checked</span>}
                  </p>
                  <p className="truncate text-sm text-ink-600">{c.anyArea ? `Anywhere in ${c.cityId === "london" ? "London" : "Lagos"}` : c.areas.map((a) => areaLabel(c.cityId, a)).join(", ")}</p>
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
      if (res.already) setError("You already have an introduction with this person.");
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

/** DES-25: "New message" / "Introduced themselves" on a card. Text and an icon, not colour alone;
 *  one tap opens the thread (or Messages, where introductions are answered). Private to you. */
function ActivityLink({ activity, name }: { activity: Candidate["activity"]; name: string }) {
  if (!activity?.href) return null;
  const message = activity.kind === "new_message";
  const count = message && "count" in activity ? activity.count ?? 1 : 1;
  return (
    <Link
      href={activity.href}
      className="-mx-1 -mt-1 mb-3 flex min-h-[44px] items-center gap-2 rounded-field bg-brand-50 px-3 text-sm font-semibold text-brand-800 ring-1 ring-brand-200 hover:bg-brand-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <IconChat size={18} className="shrink-0" />
      <span className="min-w-0 flex-1">
        {message ? (count > 1 ? `${count} new messages` : "New message") : "Introduced themselves"}
        <span className="sr-only"> from {name}</span>
      </span>
      <span aria-hidden="true">{message ? "Open" : "Reply"} →</span>
    </Link>
  );
}
