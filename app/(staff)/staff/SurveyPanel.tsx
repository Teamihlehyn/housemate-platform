"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/client";

// Survey emails (D17) and the opted-in export (ENG-30). Admin only; the API returns 404
// to anyone else. Only people who ticked "email me a survey" and haven't unsubscribed.
export default function SurveyPanel() {
  const [campaign, setCampaign] = useState("survey-1");
  const [url, setUrl] = useState(process.env.NEXT_PUBLIC_SURVEY_URL || "");
  const [preview, setPreview] = useState<{ eligible: number; already_sent: number; would_send: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function run(dry: boolean) {
    setBusy(true); setMsg(null);
    try {
      const d = await api<any>("/staff/survey/send", { body: { campaign, survey_url: url || undefined, dry_run: dry } });
      if (dry) setPreview(d);
      else {
        setMsg({ tone: d.failed ? "error" : "ok", text: `Sent ${d.sent}${d.failed ? `, ${d.failed} failed (try again to retry them)` : ""}. ${d.remaining} still to send.` });
        setPreview(null);
      }
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof ApiClientError ? e.message : "That didn't work. Try again." });
    } finally { setBusy(false); }
  }

  return (
    <section aria-labelledby="survey-title" className="space-y-4">
      <h2 id="survey-title" className="sr-only">Survey emails</h2>
      <div className="card p-4">
        <h3 className="font-semibold text-ink">Send the survey email</h3>
        <p className="mt-1 text-sm text-ink-600">Goes only to users who opted in and haven&apos;t unsubscribed. Each person gets a campaign once; up to 25 per press.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="sv-campaign" className="label">Campaign</label>
            <input id="sv-campaign" className="input" value={campaign} onChange={(e) => { setCampaign(e.target.value); setPreview(null); }} />
            <p className="mt-1 text-xs text-ink-500">For example survey-1, then survey-1-reminder.</p>
          </div>
          <div>
            <label htmlFor="sv-url" className="label">Survey link (https)</label>
            <input id="sv-url" className="input" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
        </div>
        {msg && (
          <div role={msg.tone === "error" ? "alert" : "status"} className={`mt-3 rounded-lg border px-4 py-2.5 text-sm ${msg.tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-brand-200 bg-brand-50 text-brand-800"}`}>
            {msg.text}
          </div>
        )}
        {preview && (
          <p className="mt-3 text-sm text-ink" role="status">
            {preview.eligible} opted in · {preview.already_sent} already sent this campaign · <strong>{preview.would_send} would get it now</strong>.
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-secondary min-h-[44px]" disabled={busy} onClick={() => run(true)}>Check who&apos;d get it</button>
          {preview && preview.would_send > 0 && (
            <button
              className="btn-primary min-h-[44px]"
              disabled={busy}
              onClick={() => confirm(`Email the survey to up to ${Math.min(25, preview.would_send)} people now?`) && run(false)}
            >
              Send to {Math.min(25, preview.would_send)}
            </button>
          )}
        </div>
      </div>

      <div className="card p-4">
        <h3 className="font-semibold text-ink">Export the opted-in list</h3>
        <p className="mt-1 text-sm text-ink-600">Use only to send the Peabudy survey and one reminder. Delete the file after sending.</p>
        <a className="btn-secondary mt-3 inline-flex min-h-[44px] items-center" href="/api/v1/staff/survey/export.csv">Download CSV</a>
      </div>
    </section>
  );
}
