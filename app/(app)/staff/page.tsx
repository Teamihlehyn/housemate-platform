"use client";

import { useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/client";

export default function Staff() {
  const [data, setData] = useState<any>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    api<any>("/staff/audit").then(setData).catch((e) => { if (e instanceof ApiClientError && e.status === 403) setDenied(true); });
  }, []);

  if (denied) return <div className="card p-8 text-center text-stone-600">Staff access required.</div>;
  if (!data) return <div className="h-64 animate-pulse rounded-xl bg-stone-200" />;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-stone-900">Operations · Audit explorer</h1>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Audit events" value={data.health.totalAudit} />
        <Stat label="Outbox pending" value={data.health.outboxPending} tone={data.health.outboxPending > 20 ? "warn" : "ok"} />
        <Stat label="Dead-letter" value={data.health.outboxDead} tone={data.health.outboxDead > 0 ? "warn" : "ok"} />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2">Event</th>
                <th className="px-4 py-2">Actor</th>
                <th className="px-4 py-2">Action</th>
                <th className="px-4 py-2">Outcome</th>
                <th className="px-4 py-2">When</th>
              </tr>
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
      <p className="mt-3 text-xs text-stone-400">Redacted diffs only — no message bodies, contacts, addresses or evidence appear in the audit trail.</p>
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
