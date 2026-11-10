"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError, newIdempotencyKey } from "@/lib/client";
import { formatMoney } from "@/lib/money";
import { formatDateRange } from "@/lib/dates";
import { CITIES, QUESTIONNAIRE, answerLabel } from "@/lib/constants";
import ReportDialog from "@/components/ReportDialog";
import { ChecksCard, IdCheckedChip } from "@/components/ChecksCard";
import { identityChecked } from "@/lib/checks";

const IS_BETA = process.env.NEXT_PUBLIC_APP_ENV === "beta";

export default function MemberProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [composer, setComposer] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key] = useState(newIdempotencyKey);

  useEffect(() => {
    api<any>(`/users/${id}`)
      .then(setProfile)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  async function block() {
    if (!confirm("Block this member? This is immediate and hides you from each other. It also ends any shared household.")) return;
    await api("/blocks", { body: { target_user_id: id } });
    router.push("/discover");
  }
  async function send() {
    setBusy(true); setError(null);
    try {
      const res = await api<{ already?: boolean }>("/introductions", { body: { target_user_id: id, text }, idempotencyKey: key });
      if (res.already) setError("You already have an introduction with this member.");
      else router.push("/messages");
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Could not send."); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="h-64 animate-pulse rounded-xl bg-ink-100" />;
  if (notFound || !profile)
    return (
      <div className="card p-8 text-center">
        <p className="text-ink-700">This profile is no longer available.</p>
        <button className="btn-secondary mt-4" onClick={() => router.push("/discover")}>Back to Discover</button>
      </div>
    );

  const city = profile.cityId as keyof typeof CITIES;

  return (
    <div className="mx-auto max-w-2xl">
      <button className="btn-ghost mb-4 px-2" onClick={() => router.back()}>← Back</button>

      <div className="card p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">{profile.avatarInitials}</span>
            <div>
              <h1 className="text-xl font-bold text-ink">{profile.displayName}</h1>
              <p className="text-sm text-ink-600">{profile.areas.map((a: string) => CITIES[city]?.areas.find((x) => x.id === a)?.label ?? a).join(", ")} · {CITIES[city]?.label}</p>
              <span className="chip mt-1 bg-brand-100 text-brand-800">Active search</span>
              {profile.isSample && <span className="chip ml-1 mt-1 bg-ink-50 text-ink-600">Sample housemate · replies automatically</span>}
            </div>
          </div>
          {IS_BETA
            ? identityChecked(profile.credibility.checks) && <IdCheckedChip className="shrink-0" />
            : <span className="chip bg-brand-100 text-brand-800">Demo {profile.credibility.score}/100</span>}
        </div>

        <p className="mt-4 text-ink-700" data-clarity-mask="true">{profile.bio}</p>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-cream p-3">
            <p className="text-ink-600">Budget</p>
            <p className="font-medium text-ink">{formatMoney(profile.rentMinMinor, profile.currency)}–{formatMoney(profile.rentMaxMinor, profile.currency)}/{profile.rentPeriod === "year" ? "yr" : "mo"}</p>
          </div>
          <div className="rounded-lg bg-cream p-3">
            <p className="text-ink-600">Move-in</p>
            <p className="font-medium text-ink">{profile.earliestDate ? formatDateRange(profile.earliestDate, profile.latestDate) : "Flexible"}</p>
          </div>
        </div>
      </div>

      {/* Habits */}
      <div className="card mt-4 p-6">
        <h2 className="font-semibold text-ink">Living habits</h2>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          {QUESTIONNAIRE.map((q) => {
            const h = profile.habits.find((x: any) => x.dimension === q.id);
            return (
              <div key={q.id} className="flex justify-between border-b border-ink-100 py-1.5 text-sm">
                <dt className="text-ink-600">{q.label}</dt>
                <dd className="font-medium text-ink">{h?.ownAnswer ? answerLabel(q.id, h.ownAnswer) : "—"}</dd>
              </div>
            );
          })}
        </dl>
      </div>

      {/* Credibility: beta lists completed checks with no number (ENG-04); demo modes keep the labelled breakdown. */}
      {IS_BETA ? (
        <ChecksCard checks={profile.credibility.checks ?? []} own={false} />
      ) : (
      <div className="card mt-4 p-6">
        <h2 className="font-semibold text-ink">Demo credibility: {profile.credibility.score}/100</h2>
        <p className="text-xs text-ink-600">Checks completed — not a guarantee of safety.</p>
        <ul className="mt-3 space-y-1.5 text-sm">
          {profile.credibility.components.map((c: any) => (
            <li key={c.category} className="flex items-center justify-between border-b border-ink-100 pb-1.5">
              <span className="capitalize text-ink-600">{c.category === "additional" ? "Additional evidence" : c.category}</span>
              <span className={`font-medium ${c.earned > 0 ? "text-ink" : "text-ink-500"}`}>
                {c.earned}/{c.available} {c.status === "not_provided" ? "· Not provided" : ""}
              </span>
            </li>
          ))}
        </ul>
      </div>
      )}

      <div className="mt-4 flex gap-2">
        <button className="btn-primary flex-1" onClick={() => setComposer(true)}>Send introduction</button>
        <button className="btn-secondary" onClick={() => setReporting(true)}>Report</button>
        <button className="btn-danger" onClick={block}>Block</button>
      </div>

      {reporting && <ReportDialog targetUserId={id} targetName={profile.displayName} onClose={() => setReporting(false)} />}

      {composer && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setComposer(false)}>
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-ink">Introduce yourself</h2>
            <textarea className="input mt-3 min-h-[120px]" value={text} onChange={(e) => setText(e.target.value)} placeholder="30–300 characters…" />
            <p className="mt-1 text-xs text-ink-500">{text.length} / 300</p>
            {error && <p className="field-error">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button className="btn-secondary flex-1" onClick={() => setComposer(false)}>Cancel</button>
              <button className="btn-primary flex-1" disabled={busy || text.length < 30} onClick={send}>{busy ? "Sending…" : "Send"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
