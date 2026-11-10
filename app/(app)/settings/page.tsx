"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/client";

export default function Settings() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  // DES-13 survey emails: null until loaded, so we never show a guessed state.
  const [survey, setSurvey] = useState<boolean | null>(null);
  const [surveyMsg, setSurveyMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api<Record<string, unknown>>("/me")
      .then((me) => {
        const prefs = (me.preferences ?? {}) as Record<string, unknown>;
        const v = prefs.survey_opt_in ?? me.survey_opt_in ?? me.surveyOptIn;
        setSurvey(typeof v === "boolean" ? v : false);
      })
      .catch(() => setSurvey(false));
  }, []);

  async function setSurveyOptIn(on: boolean) {
    const before = survey;
    setSurvey(on);
    setSurveyMsg(null);
    setBusy("survey");
    try {
      await api("/me/preferences", { method: "PATCH", body: { survey_opt_in: on, source: "settings" } });
      setSurveyMsg({ ok: true, text: on ? "Saved. We'll email you a short survey about your experience." : "Saved. We won't email you surveys." });
    } catch (e) {
      setSurvey(before);
      setSurveyMsg({ ok: false, text: e instanceof ApiClientError && e.code !== "ERROR" ? e.message : "We couldn't save that. Check your connection and try again." });
    } finally { setBusy(null); }
  }

  async function exportData() {
    setBusy("export"); setMsg(null);
    try {
      const d = await api<{ export: unknown }>("/me/export");
      const blob = new Blob([JSON.stringify(d.export, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "peabudy-data.json"; a.click();
      URL.revokeObjectURL(url);
      setMsg("Your data has been downloaded.");
    } catch (e) {
      setMsg(e instanceof ApiClientError ? e.message : "Export failed.");
    } finally { setBusy(null); }
  }

  async function deleteAccount() {
    if (!confirm("Delete your account? Your profile is hidden immediately and your data is removed under our retention policy. This can't be undone here.")) return;
    setBusy("delete"); setMsg(null);
    try {
      await api("/me/delete", { body: {} });
      router.push("/"); router.refresh();
    } catch (e) {
      setMsg(e instanceof ApiClientError ? e.message : "Deletion failed.");
    } finally { setBusy(null); }
  }

  async function signOut() {
    await api("/auth/logout", { body: {} });
    router.push("/"); router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 font-display text-h1 text-ink">Settings &amp; privacy</h1>
      {msg && <div role="status" className="mb-4 rounded-field border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm text-brand-800">{msg}</div>}

      <div className="card mb-4 p-5">
        <h2 className="font-semibold text-ink">Survey emails</h2>
        <label className="mt-3 flex min-h-[44px] cursor-pointer items-start gap-3 rounded-field border border-ink-100 bg-cream p-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5 shrink-0 accent-ink"
            checked={!!survey}
            disabled={survey === null || busy === "survey"}
            onChange={(e) => setSurveyOptIn(e.target.checked)}
            aria-describedby="survey-state"
          />
          <span className="text-ink-700">
            Email me a short survey about my experience. Optional. About 4 minutes, sent once with at most one reminder. Stop any time here or from the email.
          </span>
        </label>
        <p id="survey-state" className="mt-2 text-sm text-ink-600" aria-live="polite">
          {survey === null ? "Loading…" : surveyMsg ? <span className={surveyMsg.ok ? "text-brand-800" : "font-medium text-danger-700"} role={surveyMsg.ok ? undefined : "alert"}>{surveyMsg.text}</span> : survey ? "On: we'll email you a short survey about your experience." : "Off: we won't email you surveys."}
        </p>
      </div>

      <div className="card divide-y divide-ink-100">
        <Row title="Your data" desc="Download everything we hold about you as a JSON file.">
          <button className="btn-secondary" disabled={busy === "export"} onClick={exportData}>{busy === "export" ? "Preparing…" : "Export my data"}</button>
        </Row>
        <Row title="Privacy notice" desc="How we collect and use your data.">
          <Link href="/privacy" target="_blank" className="btn-secondary">View notice</Link>
        </Row>
        <Row title="Sign out" desc="Sign out of this device.">
          <button className="btn-secondary" onClick={signOut}>Sign out</button>
        </Row>
        <Row title="Delete account" desc="Hide your profile immediately and remove your data under our retention policy.">
          <button className="btn-danger" disabled={busy === "delete"} onClick={deleteAccount}>{busy === "delete" ? "Processing…" : "Delete account"}</button>
        </Row>
      </div>
    </div>
  );
}

function Row({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="font-medium text-ink">{title}</p>
        <p className="text-sm text-ink-600">{desc}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
