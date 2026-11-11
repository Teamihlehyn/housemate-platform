"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/client";
import Applications from "./Applications";
import SurveyPanel from "./SurveyPanel";

type Tab = "applications" | "verification" | "reports" | "feedback" | "survey" | "audit";

interface VCase { userId: string; displayName: string; email: string | null; phone: string | null; city: string | null; submittedAt: string; }

export default function Staff() {
  const [data, setData] = useState<any>(null);
  const [cases, setCases] = useState<VCase[]>([]);
  const [research, setResearch] = useState<any>(null);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("applications");
  const [role, setRole] = useState<string | null>(null);
  const [moreBusy, setMoreBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const me = await api<{ role: string }>("/me");
      // The audit explorer is admin-only; other staff never call it.
      const [audit, vers, res] = await Promise.all([
        me.role === "admin" ? api<any>("/staff/audit") : Promise.resolve(null),
        api<{ cases: VCase[] }>("/staff/verifications"),
        api<any>("/staff/research"),
      ]);
      setRole(me.role);
      setData(audit ?? { none: true });
      setCases(vers.cases);
      setResearch(res);
    } catch (e) {
      if (e instanceof ApiClientError && (e.status === 403 || e.status === 404)) setDenied(true);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function decide(userId: string, action: "approve" | "reject") {
    const reason = action === "reject" ? prompt("Reason for rejection (optional):") ?? undefined : undefined;
    setBusy(userId); setMsg(null);
    try {
      await api(`/staff/verifications/${userId}`, { body: { action, reason } });
      setMsg(action === "approve" ? "Identity confirmed." : "Case rejected.");
      await load();
    } catch (e) {
      setMsg(e instanceof ApiClientError ? e.message : "Failed.");
    } finally { setBusy(null); }
  }

  async function loadMoreFeedback() {
    const last = research?.feedback?.[research.feedback.length - 1];
    if (!last) return;
    setMoreBusy(true);
    try {
      const d = await api<any>(`/staff/research?before=${encodeURIComponent(last.createdAt)}`);
      setResearch((r: any) => ({ ...r, feedback: [...r.feedback, ...d.feedback], more_feedback: d.more_feedback }));
    } finally { setMoreBusy(false); }
  }

  const tabs: [Tab, string][] = [
    ["applications", "Applications"],
    // Members who published before approval-first sign-up (shown only while any wait).
    ...(cases.length ? ([["verification", `Identity checks (${cases.length})`]] as [Tab, string][]) : []),
    ["reports", `Reports${research?.reports?.length ? ` (${research.reports.length})` : ""}`],
    ["feedback", "Feedback"],
    ...(role === "admin" && research?.mode === "beta" ? ([["survey", "Survey"]] as [Tab, string][]) : []),
    ...(role === "admin" ? ([["audit", "Audit"]] as [Tab, string][]) : []),
  ];

  if (denied) return <div className="card p-8 text-center text-ink-600">Staff access required.</div>;
  if (!data) return <div className="h-64 animate-pulse rounded-xl bg-ink-100" />;

  return (
    <div>
      <h1 className="sr-only">Back office</h1>
      <nav className="mb-5 flex flex-wrap gap-1 border-b border-ink-100" role="tablist" aria-label="Back office sections">
        {tabs.map(([id, text]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`min-h-[44px] whitespace-nowrap px-3 text-sm ${tab === id ? "border-b-2 border-ink font-semibold text-ink" : "text-ink-600"}`}
          >
            {text}
          </button>
        ))}
      </nav>
      {msg && <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm text-brand-800">{msg}</div>}

      {/* Identity verification queue */}
      {tab === "verification" && <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-600">Identity verification queue</h2>
        {cases.length === 0 ? (
          <div className="card p-6 text-center text-sm text-ink-600">No one waiting for verification.</div>
        ) : (
          <div className="space-y-2">
            {cases.map((c) => (
              <div key={c.userId} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold text-ink">{c.displayName} <span className="text-xs font-normal text-ink-500">· {c.city}</span></p>
                  <p className="text-sm text-ink-600">{c.email}{c.phone ? ` · ${c.phone}` : ""}</p>
                  <p className="text-xs text-ink-500">Submitted {new Date(c.submittedAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary" disabled={busy === c.userId} onClick={() => decide(c.userId, "approve")}>Approve</button>
                  <button className="btn-danger" disabled={busy === c.userId} onClick={() => decide(c.userId, "reject")}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-ink-500">Approve only after confirming identity out-of-band (live check). No ID documents are stored.</p>
      </section>}

      {tab === "applications" && <Applications isAdmin={role === "admin"} />}
      {tab === "survey" && role === "admin" && <SurveyPanel />}

      {/* Feedback and reports (beta) / user research */}
      {tab === "feedback" && research && (
        <section className="mb-8">
          {research.mode === "beta" ? (
            <div className="mb-4 grid grid-cols-3 gap-3">
              <Stat label="Users" value={research.counts.members} />
              <Stat label="Verified" value={research.counts.verified} />
              <Stat label="Feedback (7 days)" value={research.counts.feedback7d} />
            </div>
          ) : (
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Testers" value={research.counts.testers} />
              <Stat label="Via demo persona" value={research.counts.personas} />
              <Stat label="Households formed" value={research.counts.households} />
              <Stat label="Moved in (demo)" value={research.counts.completed} />
            </div>
          )}

          <h3 className="mb-2 mt-5 font-semibold text-ink">Feedback</h3>
          {research.feedback.length === 0 ? (
            <div className="card p-5 text-center text-sm text-ink-600">No feedback yet.</div>
          ) : (
            <div className="space-y-2">
              {research.feedback.map((f: any) => (
                <div key={f.id} className="card p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
                    {f.sender.signedIn ? (
                      <span className="font-semibold text-ink-700">{f.sender.displayName} <span className="font-mono font-normal text-ink-500">· {f.sender.ref}</span></span>
                    ) : (
                      <span>Signed out{f.testerId ? <span className="font-mono"> · {f.testerId}</span> : null}</span>
                    )}
                    <span>· {f.page}</span>
                    {f.source && <span className="chip bg-ink-50 text-ink-600">{f.source}</span>}
                    {f.rating && <span>· {["😣", "🙁", "😐", "🙂", "😍"][f.rating - 1]}</span>}
                    <span className="ml-auto">{new Date(f.createdAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-ink">{f.message}</p>
                </div>
              ))}
            </div>
          )}

          {research.more_feedback && (
            <button className="btn-secondary mt-3 min-h-[44px]" disabled={moreBusy} onClick={loadMoreFeedback}>Load more feedback</button>
          )}

        </section>
      )}

      {tab === "reports" && research && (
        <section className="mb-8">
          <h2 className="mb-2 font-semibold text-ink">Safety reports ({research.reports.length})</h2>
          {research.reports.length === 0 ? (
            <div className="card p-5 text-center text-sm text-ink-600">No reports.</div>
          ) : (
            <div className="space-y-2">
              {research.reports.map((r: any) => (
                <div key={r.id} className="card p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
                    <span className="font-mono font-semibold text-ink-600">{r.caseId}</span>
                    <span className="chip bg-danger-50 text-danger-700">{r.category.replaceAll("_", " ")}</span>
                    <span>{r.reporter} → {r.target}</span>
                    <span className="ml-auto">{new Date(r.createdAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-ink">{r.description}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Audit explorer */}
      {tab === "audit" && role === "admin" && data?.health && <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-600">Audit explorer</h2>
        <div className="mb-4 grid grid-cols-3 gap-3">
          <Stat label="Audit events" value={data.health.totalAudit} />
          <Stat label="Outbox pending" value={data.health.outboxPending} tone={data.health.outboxPending > 20 ? "warn" : "ok"} />
          <Stat label="Dead-letter" value={data.health.outboxDead} tone={data.health.outboxDead > 0 ? "warn" : "ok"} />
        </div>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream text-left text-xs uppercase tracking-wide text-ink-600">
                <tr><th className="px-4 py-2">Event</th><th className="px-4 py-2">Actor</th><th className="px-4 py-2">Action</th><th className="px-4 py-2">Outcome</th><th className="px-4 py-2">When</th></tr>
              </thead>
              <tbody>
                {data.events.map((e: any) => (
                  <tr key={e.id} className="border-t border-ink-100">
                    <td className="px-4 py-2 font-medium text-ink">{e.eventType}</td>
                    <td className="px-4 py-2 text-ink-600">{e.actorType}</td>
                    <td className="px-4 py-2 text-ink-600">{e.action}</td>
                    <td className="px-4 py-2"><span className={`chip ${e.outcome === "allowed" ? "bg-brand-100 text-brand-800" : "bg-red-100 text-red-700"}`}>{e.outcome}</span></td>
                    <td className="px-4 py-2 text-ink-500">{new Date(e.occurredAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>}
    </div>
  );
}

function Stat({ label, value, tone = "ok" }: { label: string; value: number; tone?: "ok" | "warn" }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-ink-600">{label}</p>
      <p className={`text-2xl font-bold ${tone === "warn" ? "text-amber-600" : "text-ink"}`}>{value}</p>
    </div>
  );
}
