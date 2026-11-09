"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { api, ApiClientError } from "@/lib/client";
import { IconFeedback } from "@/components/icons";

// Anonymous per-browser tester ID + recruitment source (?source=whatsapp), used to
// match feedback, survey answers and Clarity recordings. Storage can be blocked
// (private mode), so every read/write is guarded.
function stored(key: string, make?: () => string): string {
  try {
    let v = localStorage.getItem(key);
    if (!v && make) {
      v = make();
      localStorage.setItem(key, v);
    }
    return v ?? "";
  } catch {
    return make ? make() : "";
  }
}

const FEEDBACK_URL = process.env.NEXT_PUBLIC_FEEDBACK_URL || "";

type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[][] };

export default function ResearchTools() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [testerId, setTesterId] = useState("");
  const [source, setSource] = useState("");

  useEffect(() => {
    const id = stored("hm_tester_id", () => "T-" + Math.random().toString(36).slice(2, 8).toUpperCase());
    const fromUrl = new URLSearchParams(window.location.search).get("source");
    if (fromUrl) {
      try { localStorage.setItem("hm_source", fromUrl.slice(0, 64)); } catch {}
    }
    const src = fromUrl?.slice(0, 64) || stored("hm_source");
    setTesterId(id);
    setSource(src);

    // Tag Clarity sessions (queued until the Clarity script loads).
    const w = window as unknown as { clarity?: ClarityFn };
    if (!w.clarity) {
      const stub: ClarityFn = (...args: unknown[]) => { (stub.q = stub.q || []).push(args); };
      w.clarity = stub;
    }
    w.clarity("set", "tester", id);
    if (src) w.clarity("set", "source", src);
  }, []);

  useEffect(() => {
    const onOpen = () => openFeedback();
    window.addEventListener("hm:open-feedback", onOpen);
    return () => window.removeEventListener("hm:open-feedback", onOpen);
  });

  function openFeedback() {
    try {
      if (!FEEDBACK_URL) throw new Error("no external form");
      const u = new URL(FEEDBACK_URL);
      u.searchParams.set("page", pathname);
      if (testerId) u.searchParams.set("tester", testerId);
      if (source) u.searchParams.set("source", source);
      window.open(u.toString(), "_blank", "noopener");
    } catch {
      setOpen(true);
    }
  }

  // On chat threads and onboarding the pill would cover the composer / Continue button; the
  // top bar has a Feedback button there.
  const hidePill = /^\/messages\/.+/.test(pathname) || pathname.startsWith("/onboarding");

  return (
    <>
      {!hidePill && <button
        onClick={openFeedback}
        className="fixed bottom-20 right-4 z-40 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-ink px-4 text-sm font-medium text-cream shadow-e2 transition hover:bg-black md:bottom-6 md:right-6"
        aria-label="Give feedback on this page"
      >
        <IconFeedback size={18} /> Feedback
      </button>}
      {open && <FeedbackDialog page={pathname} testerId={testerId} source={source} onClose={() => setOpen(false)} />}
    </>
  );
}

function FeedbackDialog({ page, testerId, source, onClose }: { page: string; testerId: string; source: string; onClose: () => void }) {
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setError(null);
    if (message.trim().length < 3) return setError("Write a few words so we know what to fix.");
    setBusy(true);
    try {
      await api("/feedback", { body: { message, rating, page, tester_id: testerId, source } });
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Couldn't send. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const faces = ["😣", "🙁", "😐", "🙂", "😍"];
  return (
    <div className="fixed inset-0 z-[60] grid place-items-end bg-black/30 p-4 sm:place-items-center" onClick={onClose}>
      <div className="card w-full max-w-md p-6" role="dialog" aria-modal="true" aria-labelledby="fb-title" onClick={(e) => e.stopPropagation()}>
        {done ? (
          <>
            <h2 id="fb-title" className="text-lg font-bold text-ink">Thank you</h2>
            <p className="mt-2 text-sm text-ink-600">That&apos;s exactly what helps us improve Peabudy.</p>
            <button className="btn-primary mt-4 w-full" onClick={onClose}>Back to the app</button>
          </>
        ) : (
          <>
            <h2 id="fb-title" className="text-lg font-bold text-ink">What&apos;s on your mind?</h2>
            <p className="mt-1 text-sm text-ink-600">Confusing, broken, or great — tell us about this page. Honest criticism helps most.</p>
            <div className="mt-4 flex justify-between gap-1" role="radiogroup" aria-label="How is it going?">
              {faces.map((f, i) => (
                <button key={i} type="button" role="radio" aria-checked={rating === i + 1} aria-label={`${i + 1} of 5`}
                  onClick={() => setRating(i + 1)}
                  className={`grid h-11 flex-1 place-items-center rounded-lg border text-xl ${rating === i + 1 ? "border-brand-500 bg-brand-50" : "border-ink-100"}`}>
                  {f}
                </button>
              ))}
            </div>
            <textarea className="input mt-3 min-h-[110px]" maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. I couldn't find where to set the notice period…" />
            {error && <p className="field-error" role="alert">{error}</p>}
            <p className="mt-2 text-xs text-ink-500">Sent with the page you&apos;re on ({page}) and your anonymous tester ID {testerId}.</p>
            <div className="mt-4 flex gap-2">
              <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
              <button className="btn-primary flex-1" disabled={busy} onClick={send}>{busy ? "Sending…" : "Send feedback"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Footer / inline link that opens the same feedback flow.
export function FeedbackLink({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event("hm:open-feedback"))}>
      {children}
    </button>
  );
}
