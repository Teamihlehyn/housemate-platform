"use client";

import { useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/client";

// Step funnel (ENG-58): admin-only counts, no people. "Funnels" = distinct anonymous journeys.
interface Row { flow_version: string; city: string | null; event: string; step: string | null; step_index: number | null; events: number; funnels: number }

export default function FunnelPanel() {
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<{ rows: Row[] }>(`/staff/funnel?days=${days}`)
      .then((d) => { setRows(d.rows); setError(null); })
      .catch((e) => setError(e instanceof ApiClientError ? e.message : "Couldn't load the funnel."));
  }, [days]);
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-600">Application funnel</h2>
        <label className="ml-auto text-sm text-ink-600" htmlFor="funnel-days">Last</label>
        <select id="funnel-days" className="input min-h-[44px] w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          {[7, 30, 90, 365].map((d) => <option key={d} value={d}>{d} days</option>)}
        </select>
      </div>
      <p className="mb-3 text-xs text-ink-500">Counts only. No answers, names, emails or user ids are recorded.</p>
      {error && <p role="alert" className="field-error">{error}</p>}
      {!rows ? (
        <div className="h-32 animate-pulse rounded-xl bg-ink-100" />
      ) : rows.length === 0 ? (
        <div className="card p-5 text-center text-sm text-ink-600">No funnel events yet.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream text-left text-xs uppercase tracking-wide text-ink-600">
              <tr>{["Flow", "City", "Event", "Step", "People", "Events"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-ink-100">
                  <td className="px-3 py-2">{r.flow_version}</td>
                  <td className="px-3 py-2">{r.city ?? "—"}</td>
                  <td className="px-3 py-2">{r.event}</td>
                  <td className="px-3 py-2">{r.step ?? "—"}</td>
                  <td className="px-3 py-2 font-semibold">{r.funnels}</td>
                  <td className="px-3 py-2 text-ink-600">{r.events}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
