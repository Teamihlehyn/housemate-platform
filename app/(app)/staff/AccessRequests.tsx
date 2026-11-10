"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/client";

// Access requests (D15): review, invite, decline, resend; plus ad-hoc invites.
// Contracts: GET /staff/access-requests?status=…, POST /staff/access-requests/[id],
// POST /staff/invites.

interface Req {
  id: string; name: string; email: string; city: string; area: string; moveInMonth: string;
  howHeard: string | null; note: string | null; status: "pending" | "invited" | "declined";
  waitlisted: boolean; createdAt: string; reviewedAt: string | null; reviewedBy: string | null;
  declineReason: string | null; hasAccount: boolean;
  invite: { id: string; expiresAt: string; usedAt: string | null; state: "active" | "expired" | "used" | "revoked" } | null;
}
type Filter = "pending" | "invited" | "declined" | "all";
interface Issued { url: string; code: string; emailStatus: string; who: string; hours: number }
interface AdHoc { id: string; bound: boolean; email_hint: string | null; createdAt: string; expiresAt: string; state: string }
interface Abuse { invite_checks_1h: number; invite_failures_1h: number; max_checks_1h: number; max_failures_1h: number }

const when = (s: string) => new Date(s).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" });
const label = (s: string) => (s === "not_sure" ? "not sure yet" : (s[0].toUpperCase() + s.slice(1)).replaceAll("_", " "));
const EMAIL_STATUS: Record<string, string> = {
  sent: "Invite emailed.",
  not_configured: "Email isn't set up here, so nothing was sent. Copy the link and send it yourself.",
  failed: "The email didn't send. Copy the link and send it yourself, or press Resend.",
  not_requested: "No email sent. Copy the link and send it yourself.",
};

export default function AccessRequests({ isAdmin }: { isAdmin: boolean }) {
  const [filter, setFilter] = useState<Filter>("pending");
  const [rows, setRows] = useState<Req[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [adhocEmail, setAdhocEmail] = useState("");
  const [adhocName, setAdhocName] = useState("");
  const [adhocList, setAdhocList] = useState<AdHoc[]>([]);
  const [abuse, setAbuse] = useState<Abuse | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<{ requests: Req[]; counts: Record<string, number>; abuse: Abuse }>(`/staff/access-requests?status=${filter}`);
      setRows(d.requests);
      setCounts(d.counts);
      setAbuse(d.abuse);
      if (isAdmin) setAdhocList((await api<{ invites: AdHoc[] }>("/staff/invites")).invites);
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof ApiClientError ? e.message : "Couldn't load requests." });
    }
  }, [filter, isAdmin]);
  useEffect(() => { load(); }, [load]);

  async function act(r: Req, action: "invite" | "decline" | "resend") {
    let reason: string | undefined;
    if (action === "decline") {
      const v = prompt(`Decline ${r.name}? Optional reason (staff only, not sent to them):`);
      if (v === null) return;
      reason = v || undefined;
    }
    setBusy(r.id); setMsg(null); setIssued(null);
    try {
      const d = await api<{ invite_url?: string; invite_code?: string; email_status: string }>(`/staff/access-requests/${r.id}`, {
        body: { action, reason },
      });
      if (d.invite_url) setIssued({ url: d.invite_url, code: d.invite_code!, emailStatus: d.email_status, who: r.name, hours: 14 * 24 });
      setMsg({ tone: "ok", text: action === "decline" ? `${r.name} declined.` : EMAIL_STATUS[d.email_status] ?? "Invite created." });
      await load();
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof ApiClientError ? e.message : "That didn't work. Try again." });
    } finally { setBusy(null); }
  }

  async function adhoc(ev: FormEvent) {
    ev.preventDefault();
    setBusy("adhoc"); setMsg(null); setIssued(null);
    try {
      const d = await api<{ invite_url: string; invite_code: string; email_status: string; bound: boolean }>("/staff/invites", {
        body: { email: adhocEmail.trim() || undefined, name: adhocName.trim() || undefined },
      });
      setIssued({ url: d.invite_url, code: d.invite_code, emailStatus: d.email_status, who: adhocEmail.trim() || "anyone (single use)", hours: d.bound ? 14 * 24 : 72 });
      setMsg({ tone: "ok", text: EMAIL_STATUS[d.email_status] ?? "Invite created." });
      setAdhocEmail(""); setAdhocName("");
      await load();
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof ApiClientError ? e.message : "That didn't work. Try again." });
    } finally { setBusy(null); }
  }

  async function revoke(inviteId: string, who: string) {
    if (!confirm(`Revoke the invite for ${who}? The link and code stop working at once.`)) return;
    setBusy(inviteId); setMsg(null); setIssued(null);
    try {
      await api(`/staff/invites/${inviteId}`, { body: { action: "revoke" } });
      setMsg({ tone: "ok", text: "Invite revoked." });
      await load();
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof ApiClientError ? e.message : "That didn't work. Try again." });
    } finally { setBusy(null); }
  }

  async function purge() {
    setBusy("purge"); setMsg(null);
    try {
      const dry = await api<{ declined: number; stale_pending: number }>("/staff/access-requests/purge", { body: { dry_run: true } });
      const n = dry.declined + dry.stale_pending;
      if (n === 0) { setMsg({ tone: "ok", text: "Nothing to delete." }); return; }
      if (!confirm(`Permanently delete ${dry.declined} declined and ${dry.stale_pending} pending-over-30-days requests? This can't be undone.`)) return;
      const d = await api<{ deleted_requests: number }>("/staff/access-requests/purge", { body: {} });
      setMsg({ tone: "ok", text: `Deleted ${d.deleted_requests} requests.` });
      await load();
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof ApiClientError ? e.message : "That didn't work. Try again." });
    } finally { setBusy(null); }
  }

  const hot = abuse && (abuse.invite_checks_1h >= abuse.max_checks_1h / 2 || abuse.invite_failures_1h >= abuse.max_failures_1h / 2);

  return (
    <section aria-labelledby="ar-title">
      <h2 id="ar-title" className="sr-only">Access requests</h2>
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {(["pending", "invited", "declined", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`min-h-[44px] rounded-full border px-4 text-sm ${filter === f ? "border-ink bg-ink text-cream" : "border-ink-200 bg-white text-ink"}`}
          >
            {f[0].toUpperCase() + f.slice(1)}{f !== "all" && counts[f] !== undefined ? ` (${counts[f]})` : ""}
          </button>
        ))}
      </div>

      {abuse && (
        <p className={`mb-3 text-xs ${hot ? "font-semibold text-amber-700" : "text-ink-500"}`}>
          Last hour: {abuse.invite_checks_1h}/{abuse.max_checks_1h} invite-link checks · {abuse.invite_failures_1h}/{abuse.max_failures_1h} wrong invite codes at sign-in.
          {hot ? " That's high — someone may be guessing codes. At the limit, all invite checks pause for an hour." : ""}
        </p>
      )}
      {msg && (
        <div role={msg.tone === "error" ? "alert" : "status"} className={`mb-3 rounded-lg border px-4 py-2.5 text-sm ${msg.tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-brand-200 bg-brand-50 text-brand-800"}`}>
          {msg.text}
        </div>
      )}
      {issued && (
        <div className="card mb-3 p-4 text-sm">
          <p className="font-semibold text-ink">Invite for {issued.who}</p>
          <p className="mt-1 break-all font-mono text-ink-700">{issued.url}</p>
          <p className="mt-1 text-ink-600">Code <span className="font-mono font-semibold">{issued.code}</span> · works once · expires in {issued.hours >= 48 ? `${Math.round(issued.hours / 24)} days` : `${issued.hours} hours`}. It won&apos;t be shown again.</p>
          <button className="btn-secondary mt-2 min-h-[44px]" onClick={() => navigator.clipboard?.writeText(issued.url).then(() => setMsg({ tone: "ok", text: "Link copied." }))}>
            Copy link
          </button>
        </div>
      )}

      {rows === null ? (
        <div className="h-32 animate-pulse rounded-xl bg-ink-100" />
      ) : rows.length === 0 ? (
        <div className="card p-6 text-center text-sm text-ink-600">No {filter === "all" ? "" : filter + " "}requests.</div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="card p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">
                    {r.name}
                    <span className="ml-2 chip bg-ink-50 text-ink-600">{r.status}</span>
                    {r.waitlisted && <span className="ml-1 chip bg-amber-50 text-amber-800">City not open · waitlisted</span>}
                    {r.hasAccount && <span className="ml-1 chip bg-brand-50 text-brand-800">Has an account</span>}
                  </p>
                  <p className="break-all text-ink-600" data-clarity-mask="true">{r.email}</p>
                  <p className="text-ink-600">
                    {label(r.city)} · {label(r.area)} · moving {label(r.moveInMonth)}{r.howHeard ? ` · heard via ${r.howHeard}` : ""}
                  </p>
                  {r.note && <p className="mt-1 whitespace-pre-wrap text-ink" data-clarity-mask="true">“{r.note}”</p>}
                  <p className="mt-1 text-xs text-ink-500">
                    Asked {when(r.createdAt)}
                    {r.reviewedAt && ` · ${r.status} by ${r.reviewedBy ?? "staff"} ${when(r.reviewedAt)}`}
                    {r.invite && ` · invite ${r.invite.state}${r.invite.state === "active" ? ` until ${when(r.invite.expiresAt)}` : ""}`}
                    {r.declineReason && ` · reason: ${r.declineReason}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(r.status === "pending" || r.status === "declined") && !r.hasAccount && (
                    <button className="btn-primary min-h-[44px]" disabled={busy === r.id} onClick={() => act(r, "invite")}>Invite</button>
                  )}
                  {r.status === "invited" && !r.hasAccount && (
                    <button className="btn-secondary min-h-[44px]" disabled={busy === r.id} onClick={() => act(r, "resend")}>Resend</button>
                  )}
                  {r.invite?.state === "active" && (
                    <button className="btn-secondary min-h-[44px]" disabled={busy === r.invite.id} onClick={() => revoke(r.invite!.id, r.name)}>Revoke</button>
                  )}
                  {(r.status === "pending" || r.status === "invited") && !r.hasAccount && (
                    <button className="btn-danger min-h-[44px]" disabled={busy === r.id} onClick={() => act(r, "decline")}>Decline</button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-ink-500">Resend makes a new link; the old one stops working. Revoke stops a link without replacing it. Declining sends nothing.</p>

      {isAdmin && (
        <div className="card mt-6 p-4">
          <h3 className="font-semibold text-ink">Delete old requests</h3>
          <p className="mt-1 text-sm text-ink-600">Deletes declined requests and requests left pending for more than 30 days, with their unused invites.</p>
          <button className="btn-secondary mt-3 min-h-[44px]" disabled={busy === "purge"} onClick={purge}>Delete old requests</button>
        </div>
      )}

      {isAdmin && <>
      <form onSubmit={adhoc} className="card mt-6 p-4">
        <h3 className="font-semibold text-ink">Invite someone directly</h3>
        <p className="mt-1 text-sm text-ink-600">With an email, the invite only works for that address, is emailed and lasts 14 days. Leave it empty for a single-use code you hand over yourself; it lasts 72 hours.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="adhoc-email" className="label">Email (optional)</label>
            <input id="adhoc-email" type="email" className="input" value={adhocEmail} onChange={(e) => setAdhocEmail(e.target.value)} data-clarity-mask="true" />
          </div>
          <div>
            <label htmlFor="adhoc-name" className="label">First name (optional)</label>
            <input id="adhoc-name" className="input" value={adhocName} onChange={(e) => setAdhocName(e.target.value)} />
          </div>
        </div>
        <button className="btn-primary mt-3 min-h-[44px]" disabled={busy === "adhoc"}>Create invite</button>
      </form>
      {adhocList.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 font-semibold text-ink">Direct invites</h3>
          <ul className="space-y-2">
            {adhocList.map((i) => (
              <li key={i.id} className="card flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span className="text-ink-700">
                  {i.bound ? i.email_hint : "Anyone (single use)"} · <span className="chip bg-ink-50 text-ink-600">{i.state}</span>
                  <span className="ml-1 text-xs text-ink-500">made {when(i.createdAt)}{i.state === "active" ? ` · until ${when(i.expiresAt)}` : ""}</span>
                </span>
                {i.state === "active" && (
                  <button className="btn-secondary min-h-[44px]" disabled={busy === i.id} onClick={() => revoke(i.id, i.bound ? i.email_hint ?? "this address" : "this code")}>Revoke</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      </>}
    </section>
  );
}
