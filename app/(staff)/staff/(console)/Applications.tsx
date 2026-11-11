"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/client";
import { CITIES } from "@/lib/constants";
import { formatMoney } from "@/lib/money";

// Applications queue (ENG-42), laid out per docs/design/applications-queue.md (DES-23).
// Contract: docs/engineering/approval-first-api.md §5.

type Filter = "submitted" | "in_review" | "call_booked" | "waitlisted" | "approved" | "declined";
const FILTERS: [Filter, string][] = [
  ["submitted", "New"],
  ["in_review", "In review"],
  ["call_booked", "Call booked"],
  ["waitlisted", "Waitlisted"],
  ["approved", "Approved"],
  ["declined", "Declined (30 days)"],
];
const EMPTY: Record<Filter, string> = {
  submitted: "No new applications. You're up to date.",
  in_review: "Nothing in review.",
  call_booked: "No calls booked.",
  waitlisted: "Nobody waitlisted.",
  approved: "No approved applications waiting to activate.",
  declined: "Nobody declined in the last 30 days.",
};
const DECLINE: [string, string][] = [
  ["not_genuine", "Doesn't look genuine"],
  ["agent_or_landlord", "Agent or landlord"],
  ["id_failed", "ID check didn't pass"],
  ["no_show", "Didn't attend the call"],
  ["duplicate", "Duplicate"],
  ["other", "Other"],
];
const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", submitted: "New", in_review: "In review", call_booked: "Call booked", approved: "Approved",
  declined: "Declined", waitlisted: "Waitlisted", withdrawn: "Withdrawn",
};

interface Row {
  id: string; version: number; display_name: string; city: string | null; city_open: boolean;
  areas: { id: string; label: string }[]; status: string; submitted_at: string | null; call_at: string | null;
  waiting_hours: number | null; waiting_label: string | null; cluster: { area_matches: number; members: number; applicants: number };
}
interface Detail {
  id: string; version: number; status: string; submitted_at: string | null; waiting_hours: number | null; call_at: string | null;
  reviewed_at: string | null; reviewed_by: string | null; decline_reason: string | null; reapply_after: string | null; email: string;
  display_name: string; journey: string | null; bio: string | null; city: string | null; city_open: boolean; areas: { id: string; label: string }[];
  budget: { currency: string; period: string; min_minor: number; max_minor: number; monthly_min_minor: number; monthly_max_minor: number } | null;
  move_in: { mode: string | null; earliest: string | null; latest: string | null; preferred: string | null } | null;
  stay: { min_months: number | null; max_months: number | null } | null;
  habits: { dimension: string; label: string; own: string; accepted: string[]; ruled_out: string[] }[];
  missing: string[]; activation: { state: string; expires_at: string } | null; can_act: boolean;
}

const cityName = (c: string | null) => (c === "lagos" ? "Lagos" : c === "london" ? "London" : "No city");
const tzOf = (c: string | null) => (c && c in CITIES ? CITIES[c as keyof typeof CITIES].timezone : undefined);
// "10 Nov, 14:02" in the reviewer's time zone.
const when = (s: string | null) =>
  s ? new Date(s).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
// "Thu 19 Nov, 14:30 Lagos time" in the applicant's city.
const callWhen = (s: string | null, city: string | null) =>
  s
    ? `${new Date(s).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: tzOf(city) })} ${cityName(city)} time`
    : "—";

function WaitingChip({ label, hours }: { label: string | null; hours: number | null }) {
  if (!label) return null;
  const cls =
    label === "Over 72 h" ? "bg-danger-50 text-danger-700" : label === "Over 24 h" ? "bg-caution-50 text-caution-800" : "bg-ink-50 text-ink-700";
  return (
    <span className={`chip ${cls}`}>
      {label !== "On time" && <span aria-hidden="true">◷ </span>}
      {label} · {hours} h
    </span>
  );
}

function clusterText(c: Row["cluster"]) {
  const parts = [];
  parts.push(`${c.members} ${c.members === 1 ? "user" : "users"}`);
  parts.push(`${c.applicants} other ${c.applicants === 1 ? "applicant" : "applicants"}`);
  return `${parts.join(" and ")} in these areas`;
}

export default function Applications({ isAdmin = false }: { isAdmin?: boolean }) {
  const [filter, setFilter] = useState<Filter>("submitted");
  const [city, setCity] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams({ status: filter, ...(city ? { city } : {}) });
      const d = await api<{ applications: Row[]; counts: Record<string, number> }>(`/staff/applications?${q}`);
      setRows(d.applications);
      setCounts(d.counts);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Couldn't load applications.");
    }
  }, [filter, city]);
  useEffect(() => { load(); }, [load]);

  if (openId) return <ApplicationDetail id={openId} onBack={() => { setOpenId(null); load(); }} />;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-ink">Applications</h2>
        <button className="btn-ghost min-h-[44px]" onClick={load} aria-label="Reload applications">↻ Reload</button>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
        {FILTERS.map(([id, text]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            aria-pressed={filter === id}
            className={`min-h-[44px] rounded-full px-3 text-sm ${filter === id ? "bg-ink text-cream" : "bg-ink-50 text-ink-700"}`}
          >
            {text} ({counts[id] ?? 0})
          </button>
        ))}
      </div>
      <label className="label" htmlFor="app-city">City</label>
      <select id="app-city" className="input mb-4 min-h-[44px] max-w-xs" value={city} onChange={(e) => setCity(e.target.value)}>
        <option value="">All cities</option>
        {Object.values(CITIES).map((c) => <option key={c.id} value={c.id}>{cityName(c.id)}</option>)}
      </select>
      {error && <p role="alert" className="field-error mb-3">{error}</p>}
      {!rows ? (
        <div className="h-32 animate-pulse rounded-xl bg-ink-100" />
      ) : rows.length === 0 ? (
        <div className="card p-6 text-center text-sm text-ink-600">{EMPTY[filter]}</div>
      ) : (
        <>
          {/* Phone: cards */}
          <ul className="space-y-2 md:hidden">
            {rows.map((r) => (
              <li key={r.id}>
                <button onClick={() => setOpenId(r.id)} className="card block min-h-[44px] w-full p-4 text-left hover:bg-cream">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">{r.display_name} · {cityName(r.city)}</span>
                    <WaitingChip label={r.waiting_label} hours={r.waiting_hours} />
                    {!r.city_open && <span className="chip bg-sky-100 text-sky-800">{cityName(r.city)}: opens later</span>}
                  </div>
                  <p className="mt-1 text-sm text-ink-600">{r.areas.map((a) => a.label).join(", ") || "No areas"}</p>
                  <p className="mt-1 text-xs text-ink-500">
                    {STATUS_LABEL[r.status]} · sent {when(r.submitted_at)}
                    {r.call_at ? ` · call ${callWhen(r.call_at, r.city)}` : ""} · {clusterText(r.cluster)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
          {/* Desktop: a table; the whole row opens the application */}
          <div className="card hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-cream text-left text-xs uppercase tracking-wide text-ink-600">
                <tr>
                  {["Name", "City", "Areas", "Status", "Sent", "Waiting", "Call", "Area cluster"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="h-[44px] cursor-pointer border-t border-ink-100 hover:bg-cream" onClick={() => setOpenId(r.id)}>
                    <td className="px-3 py-2">
                      <button className="font-semibold text-ink underline-offset-2 hover:underline" onClick={(e) => { e.stopPropagation(); setOpenId(r.id); }}>{r.display_name}</button>
                    </td>
                    <td className="px-3 py-2">{cityName(r.city)}{!r.city_open && <span className="chip ml-1 bg-sky-100 text-sky-800">opens later</span>}</td>
                    <td className="px-3 py-2">{r.areas.map((a) => a.label).join(", ")}</td>
                    <td className="px-3 py-2">{STATUS_LABEL[r.status]}</td>
                    <td className="px-3 py-2">{when(r.submitted_at)}</td>
                    <td className="px-3 py-2"><WaitingChip label={r.waiting_label} hours={r.waiting_hours} /></td>
                    <td className="px-3 py-2">{r.call_at ? callWhen(r.call_at, r.city) : "—"}</td>
                    <td className="px-3 py-2 text-ink-600">{r.cluster.members} users · {r.cluster.applicants} applicants</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {isAdmin && <RetentionPanel onDone={load} />}
    </section>
  );
}

// Admin: delete application data the privacy notice says we don't keep (R7).
function RetentionPanel({ onDone }: { onDone: () => void }) {
  type Counts = { stale_drafts: number; declined: number; withdrawn: number; expired_tombstones: number; deleted_accounts?: number };
  const [counts, setCounts] = useState<Counts | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function run(dry: boolean) {
    setBusy(true);
    setError(null);
    try {
      const r = await api<Counts>("/staff/applications/purge", { body: { dry_run: dry } });
      if (dry) {
        setCounts(r);
        setDone(null);
      } else {
        setCounts(null);
        setDone(`Deleted ${r.deleted_accounts ?? 0} applications and their answers.`);
        onDone();
      }
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }
  const total = counts ? counts.stale_drafts + counts.declined + counts.withdrawn : 0;
  return (
    <div className="card mt-6 space-y-2 p-4 text-sm">
      <h3 className="font-semibold text-ink">Application data retention</h3>
      <p className="text-ink-600">
        Deletes drafts untouched for 30 days, and declined or withdrawn applications 30 days after the decision. For a declined
        person we keep only a scrambled email and their reapply date.
      </p>
      {done && <p role="status" className="text-brand-800">{done}</p>}
      {error && <p role="alert" className="field-error">{error}</p>}
      {!counts ? (
        <button className="btn-secondary min-h-[44px]" disabled={busy} onClick={() => run(true)}>Check what's due</button>
      ) : (
        <div className="space-y-2">
          <p>Due now: {counts.stale_drafts} old drafts, {counts.declined} declined, {counts.withdrawn} withdrawn.</p>
          {total > 0 ? (
            <div className="flex flex-wrap gap-2">
              <button className="btn-danger min-h-[44px]" disabled={busy} onClick={() => run(false)}>Delete {total} now</button>
              <button className="btn-ghost min-h-[44px]" onClick={() => setCounts(null)}>Cancel</button>
            </div>
          ) : (
            <p className="text-ink-600">Nothing to delete.</p>
          )}
        </div>
      )}
    </div>
  );
}

type Msg = { tone: "ok" | "error"; text: string; reload?: boolean } | null;

function ApplicationDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [priv, setPriv] = useState<{ gender: string | null; gender_preference: string[]; at: string } | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [link, setLink] = useState<{ url: string; code: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // Inputs survive a reload after a version conflict.
  const [callAt, setCallAt] = useState("");
  const [callLink, setCallLink] = useState("");
  const [sendCallEmail, setSendCallEmail] = useState(true);
  const [idSeen, setIdSeen] = useState(false);
  const [idHint, setIdHint] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmDecline, setConfirmDecline] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setD((await api<{ application: Detail }>(`/staff/applications/${id}`)).application);
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof ApiClientError ? e.message : "Couldn't load this application." });
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
    } catch {
      setCopied(null);
    }
  }

  async function act(action: string, okText: string, extra: Record<string, unknown> = {}) {
    if (!d) return;
    setBusy(true);
    setMsg(null);
    setLink(null);
    try {
      const r = await api<{ application: Detail; activation_url?: string; activation_code?: string; email_status: string }>(
        `/staff/applications/${id}`,
        { body: { action, expected_version: d.version, ...extra } }
      );
      setD(r.application);
      setConfirmDecline(false);
      const failed = r.email_status === "failed" || r.email_status === "not_configured";
      if (failed && r.activation_url && r.activation_code) setLink({ url: r.activation_url, code: r.activation_code });
      const emailText =
        r.email_status === "sent" ? " Email sent." : failed ? " The email didn't send." : "";
      setMsg({ tone: failed ? "error" : "ok", text: okText + emailText });
    } catch (e) {
      if (e instanceof ApiClientError && e.code === "VERSION_CONFLICT") {
        setMsg({ tone: "error", text: "Someone else changed this application. Reload to see the latest.", reload: true });
      } else {
        setMsg({ tone: "error", text: e instanceof ApiClientError ? e.message : "That didn't work. Try again." });
      }
    } finally {
      setBusy(false);
    }
  }

  async function reveal() {
    try {
      const r = await api<{ gender: string | null; gender_preference: string[] }>(`/staff/applications/${id}/reveal`, { body: {} });
      setPriv({ ...r, at: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) });
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof ApiClientError ? e.message : "Couldn't show the private fields." });
    }
  }

  if (!d) {
    return (
      <section>
        <button className="btn-ghost mb-3 min-h-[44px]" onClick={onBack}>Back to applications</button>
        {msg ? <p role="alert" className="field-error">{msg.text}</p> : <div className="h-64 animate-pulse rounded-xl bg-ink-100" />}
      </section>
    );
  }
  const s = d.status;
  const money = (m: number) => (d.budget ? formatMoney(m, d.budget.currency) : "");
  const first = (d.display_name || "them").split(" ")[0];
  const tz = cityName(d.city);

  const bookCall = (
    <div className="space-y-2 rounded-lg border border-ink-100 p-3">
      <label className="label" htmlFor="call-at">Call date and time ({tz} time)</label>
      <input id="call-at" type="datetime-local" className="input min-h-[44px]" value={callAt} onChange={(e) => setCallAt(e.target.value)} />
      <label className="label" htmlFor="call-link">Video link (optional)</label>
      <input id="call-link" type="url" inputMode="url" placeholder="https://" className="input min-h-[44px]" value={callLink} onChange={(e) => setCallLink(e.target.value)} />
      <label className="flex min-h-[44px] items-center gap-2 text-sm">
        <input type="checkbox" checked={sendCallEmail} onChange={(e) => setSendCallEmail(e.target.checked)} /> Email them the time (E4)
      </label>
      <p className="text-xs text-ink-500">Subject: “Your Peabudy ID call: {callAt ? "the time you chose" : "…"}”</p>
      <button className="btn-secondary min-h-[44px]" disabled={busy}
        onClick={() => {
          if (!callAt) return setMsg({ tone: "error", text: "Choose the call's date and time first." });
          act("call_booked", "Call time saved.", { call_at: zonedToIso(callAt, tzOf(d.city)), send_email: sendCallEmail, call_link: callLink.trim() || undefined });
        }}>
        {s === "call_booked" ? "Change call time" : "Save call time"}
      </button>
    </div>
  );
  const approve = (
    <div className="space-y-2 rounded-lg border border-ink-100 p-3">
      <label className="flex min-h-[44px] items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={idSeen} onChange={(e) => { setIdSeen(e.target.checked); setIdHint(false); }} />
        <span>I saw a photo ID that matches this person on a video call, and they're 18 or over</span>
      </label>
      <p className="text-xs text-ink-500">Method: video call</p>
      <button className="btn-confirm min-h-[44px] w-full sm:w-auto" disabled={busy}
        onClick={() => (idSeen ? act("approve", "Approved.", { id_check_confirmed: true, id_check_method: "video" }) : setIdHint(true))}>
        Approve
      </button>
      {idHint && <p className="field-error" role="alert">Tick the ID confirmation first.</p>}
    </div>
  );
  const decline = (
    <fieldset className="space-y-1 rounded-lg border border-ink-100 p-3">
      <legend className="label px-1">Decline reason</legend>
      {DECLINE.map(([v, t]) => (
        <label key={v} className="flex min-h-[44px] items-center gap-2 text-sm">
          <input type="radio" name="decline-reason" value={v} checked={reason === v} onChange={() => setReason(v)} /> {t}
        </label>
      ))}
      <p className="text-xs text-ink-500">The applicant won't see the reason. They get a kind, generic email and can reapply in 30 days.</p>
      {!confirmDecline ? (
        <button className="btn-danger min-h-[44px]" disabled={busy}
          onClick={() => (reason ? setConfirmDecline(true) : setMsg({ tone: "error", text: "Choose a reason first." }))}>
          Decline
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>Decline {first}?</span>
          <button className="btn-danger min-h-[44px]" disabled={busy} onClick={() => act("decline", "Declined.", { reason })}>Yes, decline</button>
          <button className="btn-ghost min-h-[44px]" onClick={() => setConfirmDecline(false)}>Cancel</button>
        </div>
      )}
    </fieldset>
  );
  const waitlist = (
    <div>
      <button className="btn-ghost min-h-[44px]" disabled={busy} onClick={() => act("waitlist", "Waitlisted.")}>Waitlist</button>
      <p className="text-xs text-ink-500">For cities that aren't open yet.</p>
    </div>
  );
  const startReview = (
    <button className="btn-primary min-h-[44px] w-full sm:w-auto" disabled={busy} onClick={() => act("start_review", "Review started.")}>Start review</button>
  );
  const resend = (
    <div>
      <button className="btn-primary min-h-[44px]" disabled={busy} onClick={() => act("resend_activation", "New activation link created.")}>Resend activation</button>
      <p className="text-xs text-ink-500">The old link stops working.</p>
    </div>
  );

  let actions: React.ReactNode = null;
  if (s === "submitted") actions = <>{startReview}{bookCall}{decline}{waitlist}</>;
  else if (s === "in_review") actions = <>{bookCall}{approve}{decline}{waitlist}</>;
  else if (s === "call_booked") actions = <>{approve}{bookCall}{decline}{waitlist}</>;
  else if (s === "waitlisted") actions = <>{startReview}{decline}</>;
  else if (s === "approved") actions = <>{resend}{decline}</>;
  else if (s === "declined") actions = <p className="text-sm text-ink-600">Declined {when(d.reviewed_at)}. They can reapply from {d.reapply_after ? new Date(d.reapply_after).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}.</p>;
  else actions = <p className="text-sm text-ink-600">Nothing to do: {STATUS_LABEL[s] ?? s}.</p>;

  return (
    <section>
      <button className="btn-ghost mb-3 min-h-[44px]" onClick={onBack}>Back to applications</button>
      <div className="md:grid md:grid-cols-[3fr_2fr] md:gap-6">
        <div className="space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-ink">{d.display_name || "(no name yet)"}</h1>
              <span className="chip bg-ink-50 text-ink-700">{STATUS_LABEL[s]}</span>
            </div>
            <p className="mt-1 text-xs text-ink-500">
              Sent {when(d.submitted_at)}{d.waiting_hours != null ? ` · waiting ${d.waiting_hours} h` : ""}
              {d.call_at ? ` · call ${callWhen(d.call_at, d.city)}` : ""}{d.reviewed_by ? ` · last reviewed by ${d.reviewed_by}` : ""}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="break-all text-sm text-ink-600" data-clarity-mask="true">{d.email}</span>
              <button className="btn-ghost min-h-[44px] text-sm" onClick={() => copy(d.email, "email")}>{copied === "email" ? "Copied" : "Copy"}</button>
            </div>
          </div>

          <div className="card space-y-3 p-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Profile as other users will see it</p>
            <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1">
              <dt className="text-ink-500">Areas</dt><dd>{d.areas.map((a) => a.label).join(", ") || "—"} ({cityName(d.city)}{!d.city_open && ": opens later"})</dd>
              <dt className="text-ink-500">Budget</dt>
              <dd>{d.budget ? `${money(d.budget.min_minor)}–${money(d.budget.max_minor)} a ${d.budget.period}${d.budget.period === "year" ? ` (about ${money(d.budget.monthly_min_minor)}–${money(d.budget.monthly_max_minor)} a month)` : ""}` : "—"}</dd>
              <dt className="text-ink-500">Move in</dt><dd>{d.move_in?.mode === "undecided" ? "Undecided" : d.move_in?.earliest ? `${d.move_in.earliest} to ${d.move_in.latest}` : "—"}</dd>
              <dt className="text-ink-500">Stay</dt><dd>{d.stay?.min_months != null ? `${d.stay.min_months}–${d.stay.max_months} months` : "—"}</dd>
              <dt className="text-ink-500">Looking for</dt><dd>{d.journey?.replaceAll("_", " ") ?? "—"}</dd>
            </dl>
            <p className="whitespace-pre-wrap text-ink" data-clarity-mask="true">{d.bio || "No bio yet."}</p>
          </div>

          <div className="card space-y-1 p-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Matching answers</p>
            <ul className="space-y-1">
              {d.habits.map((h) => (
                <li key={h.dimension}>
                  <span className="text-ink-500">{h.label.replace(/[?:]$/, "")}:</span> {h.own}
                  {h.ruled_out.length > 0 && <span className="text-ink-500"> · won't live with: {h.ruled_out.join(", ").toLowerCase()}</span>}
                </li>
              ))}
            </ul>
            {d.missing.length > 0 && <p className="font-medium text-danger-700">Missing: {d.missing.join(", ")} (approve will refuse)</p>}
          </div>

          <div className="card p-4 text-sm">
            {priv ? (
              <>
                <p>Gender: {priv.gender?.replaceAll("_", " ") ?? "not given"} · open to living with: {priv.gender_preference.join(", ").replaceAll("_", " ")}</p>
                <p className="mt-1 text-xs text-ink-500">Shown to you at {priv.at}. Logged.</p>
              </>
            ) : (
              <>
                <p className="mb-2 text-ink-600">Gender and housemate preference are hidden. Open them only if you need them for this review. Opening them is logged.</p>
                <button className="btn-secondary min-h-[44px]" onClick={reveal}>Show private fields</button>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 md:mt-0">
          <div className="card space-y-3 p-4 md:sticky md:top-4">
            {msg && (
              <div role={msg.tone === "error" ? "alert" : "status"} className={`rounded-lg px-3 py-2 text-sm ${msg.tone === "error" ? "bg-danger-50 text-danger-700" : "bg-brand-50 text-brand-800"}`}>
                {msg.text}
                {msg.reload && <button className="btn-secondary ml-2 min-h-[44px]" onClick={() => { setMsg(null); load(); }}>Reload</button>}
              </div>
            )}
            {link && (
              <div className="rounded-lg border border-caution-200 bg-caution-50 p-3 text-sm">
                <p>The email didn't send. Copy the link and send it to them yourself, from hello@peabudy.com.</p>
                <p className="mt-1 break-all font-mono" data-clarity-mask="true">{link.url}</p>
                <p className="mt-1 font-mono" data-clarity-mask="true">Code: {link.code}</p>
                <button className="btn-secondary mt-2 min-h-[44px]" onClick={() => copy(link.url, "link")}>{copied === "link" ? "Copied" : "Copy link"}</button>
              </div>
            )}
            {d.activation && s === "approved" && <p className="text-xs text-ink-500">Activation link: {d.activation.state}, until {when(d.activation.expires_at)}</p>}
            {d.can_act ? actions : <p className="text-sm text-ink-600">You can view applications. A verifier or admin approves and declines.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

// A datetime-local value ("2026-11-19T14:30") read as wall-clock time in the city's time zone,
// so "14:30 Lagos time" is stored as 13:30Z whatever the reviewer's own time zone is.
function zonedToIso(local: string, tz: string | undefined): string {
  const asUtc = new Date(local + ":00Z");
  if (!tz) return new Date(local).toISOString();
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .formatToParts(asUtc)
    .reduce<Record<string, string>>((a, p) => ({ ...a, [p.type]: p.value }), {});
  const shown = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(asUtc.getTime() - (shown - asUtc.getTime())).toISOString();
}
