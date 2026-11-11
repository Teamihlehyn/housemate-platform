"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/client";
import { REPORT_CATEGORIES } from "@/lib/constants";

// Report a user. Creates a private case; it never changes their public score.
export default function ReportDialog({
  targetUserId,
  targetName,
  conversationId,
  onClose,
}: {
  targetUserId: string;
  targetName: string;
  conversationId?: string;
  onClose: () => void;
}) {
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!category) return setError("Choose what happened.");
    if (description.trim().length < 20) return setError("Please describe what happened in at least 20 characters.");
    setBusy(true);
    try {
      const d = await api<{ caseId: string }>("/reports", {
        body: { target_user_id: targetUserId, category, description, conversation_id: conversationId },
      });
      setCaseId(d.caseId);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Couldn't send the report.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] grid items-end bg-black/40 sm:place-items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[90dvh] w-full animate-sheet-in overflow-y-auto rounded-t-sheet bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:max-w-md sm:rounded-sheet sm:p-6" role="dialog" aria-modal="true" aria-labelledby="report-title" onClick={(e) => e.stopPropagation()}>
        {caseId ? (
          <>
            <h2 id="report-title" className="text-lg font-bold text-ink">Report received</h2>
            <p className="mt-2 text-sm text-ink-600">
              Your case number is <span className="font-mono font-semibold">{caseId}</span>. {targetName} won&apos;t be told who reported them.
            </p>
            <p className="mt-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
              Support in this prototype is simulated and is not an emergency service. If anyone is in danger, contact local emergency services.
            </p>
            <button className="btn-primary mt-4 w-full" onClick={onClose}>Done</button>
          </>
        ) : (
          <>
            <h2 id="report-title" className="text-lg font-bold text-ink">Report {targetName}</h2>
            <p className="mt-1 text-sm text-ink-600">Reports are private. {process.env.NEXT_PUBLIC_APP_ENV === "beta" ? "We review every one." : <>They don&apos;t change anyone&apos;s score on their own.</>}</p>
            <fieldset className="mt-4">
              <legend className="label">What happened?</legend>
              <div className="space-y-1.5">
                {REPORT_CATEGORIES.map((c) => (
                  <label key={c.id} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-field px-2 text-sm text-ink hover:bg-ink-50">
                    <input className="h-5 w-5 accent-ink" type="radio" name="report-category" value={c.id} checked={category === c.id} onChange={() => setCategory(c.id)} />
                    {c.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="label mt-4" htmlFor="report-desc">Tell us more</label>
            <textarea id="report-desc" className="input min-h-[100px]" maxLength={1000} value={description}
              onChange={(e) => setDescription(e.target.value)} placeholder="What happened, and when?" data-clarity-mask="true" />
            <p className="mt-1 text-xs text-ink-500">{description.length} / 1000</p>
            {error && <p className="field-error" role="alert">{error}</p>}
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row">
              <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
              <button className="btn-danger flex-1" disabled={busy} onClick={submit}>{busy ? "Sending…" : "Send report"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
