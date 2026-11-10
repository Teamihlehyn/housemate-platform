"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PublicShell from "@/components/PublicShell";
import Pea from "@/components/brand/Pea";
import { api, ApiClientError } from "@/lib/client";

// DES-13 unsubscribe. GET shows a confirmation button and POST withdraws, so link scanners in
// mail clients can't unsubscribe anyone by fetching the URL. Works signed out, shows no email.
// Contract: GET/POST /api/v1/unsubscribe?token=… (also accepts ?t= from the export's links).

type State = "checking" | "ready" | "busy" | "done" | "invalid" | "error";

export default function Unsubscribe() {
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const t = q.get("token") || q.get("t");
    setToken(t);
    if (!t) return setState("invalid");
    api(`/unsubscribe?token=${encodeURIComponent(t)}`)
      .then(() => setState("ready"))
      .catch((e) => {
        // A bad or expired token is a 404/422; anything else shouldn't stop someone opting out.
        if (e instanceof ApiClientError && (e.status === 404 || e.status === 422) && e.code !== "ERROR") setState("invalid");
        else setState("ready");
      });
  }, []);

  async function stop() {
    if (!token) return;
    setState("busy");
    try {
      await api(`/unsubscribe?token=${encodeURIComponent(token)}`, { method: "POST", body: {} });
      setState("done");
    } catch (e) {
      setState(e instanceof ApiClientError && (e.status === 404 || e.status === 422) && e.code !== "ERROR" ? "invalid" : "error");
    }
  }

  return (
    <PublicShell>
      <div className="card flex flex-col items-center p-6 text-center sm:p-10">
        {state === "checking" && (
          <div role="status" className="py-6">
            <Pea size={64} mood="awake" blink />
            <p className="mt-3 text-body text-ink-700">One moment…</p>
          </div>
        )}

        {(state === "ready" || state === "busy" || state === "error") && (
          <>
            <Pea size={72} mood="awake" blink />
            <h1 className="mt-4 font-display text-h1 text-ink">Stop survey emails?</h1>
            <p className="mt-2 max-w-sm text-body text-ink-700">
              We&apos;ll stop emailing you surveys. Your account and everything else stay as they are.
            </p>
            {state === "error" && (
              <p className="mt-4 w-full rounded-field border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700" role="alert">
                That didn&apos;t go through. Check your connection and press the button again.
              </p>
            )}
            <button type="button" className="btn-primary btn-lg mt-6 w-full sm:w-auto" onClick={stop} aria-busy={state === "busy"}>
              {state === "busy" ? "Stopping…" : "Stop survey emails"}
            </button>
            <Link href="/" className="btn-ghost mt-2">Keep survey emails</Link>
          </>
        )}

        {state === "done" && (
          <>
            <Pea size={72} mood="happy" />
            <h1 className="mt-4 font-display text-h1 text-ink" tabIndex={-1} ref={(el) => el?.focus()}>Done</h1>
            <p className="mt-2 max-w-sm text-body text-ink-700" role="status">
              We won&apos;t email you surveys. You can turn them back on in Settings.
            </p>
            <p className="mt-6 text-sm text-ink-700">Changed your mind?</p>
            <Link href="/settings" className="btn-secondary mt-2">Go to Settings</Link>
          </>
        )}

        {state === "invalid" && (
          <>
            <Pea size={72} mood="sleep" dim />
            <h1 className="mt-4 font-display text-h1 text-ink">This link doesn&apos;t work</h1>
            <p className="mt-2 max-w-sm text-body text-ink-700">
              It may be incomplete or out of date. You can stop survey emails in Settings, or reply to any survey email and we&apos;ll do it for you.
            </p>
            <Link href="/settings" className="btn-primary btn-lg mt-6">Go to Settings</Link>
          </>
        )}
      </div>
    </PublicShell>
  );
}
