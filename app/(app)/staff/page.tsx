"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/client";

interface VCase { userId: string; displayName: string; email: string | null; phone: string | null; city: string | null; submittedAt: string; }

export default function Staff() {
  const [data, setData] = useState<any>(null);
  const [cases, setCases] = useState<VCase[]>([]);
  const [research, setResearch] = useState<any>(null);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [audit, vers, res] = await Promise.all([
        api<any>("/staff/audit"),
        api<{ cases: VCase[] }>("/staff/verifications"),
        api<any>("/staff/research"),
      ]);
      setData(audit);
      setCases(vers.cases);
      setResearch(res);
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 403) setDenied(true);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function decide(userId: string, action: "approve" | "reject") {
    const reason = action === "reject" ? prompt("Reason for rejection (optional):") ?? undefined : undefined;
    setBusy(userId); setMsg(null);
    try {
      await api(`/staff/verifications/${userId}`, { body: { action, reason } });
      setMsg(action === "approve" ? "Member verified." : "Case rejected.");
      await load();
    } catch (e) {
      setMsg(e instanceof ApiClientError ? e.message : "Failed.");
    } finally { setBusy(null); }
  }

  if (denied) return <div className="card p-8 text-center text-stone-600">Staff access required.</div>;
  if (!data) return <div className="h-64 animate-pulse rounded-xl bg-stone-200" />;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-stone-900">Operations console</h1>
      {msg && <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm text-brand-800">{msg}</div>}

      {/* Identity verification queue */}
      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Identity verification queue</h2>
        {cases.length === 0 ? (
          <div className="card p-6 text-center text-sm text-stone-500">No one waiting for verification.</div>
        ) : (
          <div className="space-y-2">
            {cases.map((c) => (
              <div key={c.userId} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold text-stone-900">{c.displayName} <span className="text-xs font-normal text-stone-400">· {c.city}</span></p>
                  <p className="text-sm text-stone-500">{c.email}{c.phone ? ` · ${c.phone}` : ""}</p>
                  <p className="text-xs text-stone-400">Submitted {new Date(c.submittedAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary" disabled={busy === c.userId} onClick={() => decide(c.userId, "approve")}>Approve</button>
                  <button className="btn-danger" disabled={busy === c.userId} onClick={() => decide(c.userId, "reject")}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-stone-400">Approve only after confirming identity out-of-band (live check). No ID documents are stored.</p>
      </section>

      {/* User research */}
      {research && (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">User research</h2>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Testers" value={research.counts.testers} />
            <Stat label="Via demo persona" value={research.counts.personas} />
            <Stat label="Households formed" value={research.counts.households} />
            <Stat label="Moved in (demo)" value={research.counts.completed} />
          </div>

          <h3 className="mb-2 mt-5 font-semibold text-stone-900">Feedback ({research.feedback.length})</h3>
          {research.feedback.length === 0 ? (
            <div className="card p-5 text-center text-sm text-stone-500">No feedback yet.</div>
          ) : (
            <div className="space-y-2">
              {research.feedback.map((f: any) => (
                <div key={f.id} className="card p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-stone-400">
                    <span className="font-mono">{f.testerId ?? "—"}</span>
                    <span>· {f.page}</span>
                    {f.source && <span className="chip bg-stone-100 text-stone-600">{f.source}</span>}
                    {f.rating && <span>· {["😣", "🙁", "😐", "🙂", "😍"][f.rating - 1]}</span>}
                    <span className="ml-auto">{new Date(f.createdAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-stone-800">{f.message}</p>
                </div>
              ))}
            </div>
          )}

          <h3 className="mb-2 mt-5 font-semibold text-stone-900">Safety reports ({research.reports.length})</h3>
          {research.reports.length === 0 ? (
            <div className="card p-5 text-center text-sm text-stone-500">No reports.</div>
          ) : (
            <div className="space-y-2">
              {research.reports.map((r: any) => (
                <div key={r.id} className="card p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-stone-400">
                    <span className="font-mono font-semibold text-stone-600">{r.caseId}</span>
                    <span className="chip bg-red-50 text-red-700">{r.category.replaceAll("_", " ")}</span>
                    <span>{r.reporter} → {r.target}</span>
                    <span className="ml-auto">{new Date(r.createdAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-stone-800">{r.description}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Audit explorer */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Audit explorer</h2>
        <div className="mb-4 grid grid-cols-3 gap-3">
          <Stat label="Audit events" value={data.health.totalAudit} />
          <Stat label="Outbox pending" value={data.health.outboxPending} tone={data.health.outboxPending > 20 ? "warn" : "ok"} />
          <Stat label="Dead-letter" value={data.health.outboxDead} tone={data.health.outboxDead > 0 ? "warn" : "ok"} />
        </div>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr><th className="px-4 py-2">Event</th><th className="px-4 py-2">Actor</th><th className="px-4 py-2">Action</th><th className="px-4 py-2">Outcome</th><th className="px-4 py-2">When</th></tr>
              </thead>
              <tbody>
                {data.events.map((e: any) => (
                  <tr key={e.id} className="border-t border-stone-100">
                    <td className="px-4 py-2 font-medium text-stone-800">{e.eventType}</td>
                    <td className="px-4 py-2 text-stone-500">{e.actorType}</td>
                    <td className="px-4 py-2 text-stone-600">{e.action}</td>
                    <td className="px-4 py-2"><span className={`chip ${e.outcome === "allowed" ? "bg-brand-100 text-brand-800" : "bg-red-100 text-red-700"}`}>{e.outcome}</span></td>
                    <td className="px-4 py-2 text-stone-400">{new Date(e.occurredAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, tone = "ok" }: { label: string; value: number; tone?: "ok" | "warn" }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-stone-500">{label}</p>
      <p className={`text-2xl font-bold ${tone === "warn" ? "text-amber-600" : "text-stone-900"}`}>{value}</p>
    </div>
  );
}
