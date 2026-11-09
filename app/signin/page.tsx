"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/brand/Logo";
import Pea from "@/components/brand/Pea";
import { api, ApiClientError } from "@/lib/client";
import { CITIES } from "@/lib/constants";
import { PERSONAS } from "@/lib/personas";

const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV;
const IS_BETA = APP_ENV === "beta";
const PERSONAS_ON = !IS_BETA;
const CONSENT_REQUIRED = IS_BETA || APP_ENV === "research";
const SEND_ERRORS = ["EMAIL_SEND_FAILED", "EMAIL_NOT_CONFIGURED"];
const LIMIT_ERRORS = ["RATE_LIMITED", "TOO_MANY_ATTEMPTS"];

// The two sign-in calls read Retry-After, which lib/client's api() doesn't expose.
class AuthError extends ApiClientError {
  constructor(code: string, message: string, status: number, public retryAfter: number | null) {
    super(code, message, status);
  }
}
async function authPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Request-ID": crypto.randomUUID() },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = json.error ?? {};
    const ra = parseInt(res.headers.get("Retry-After") ?? "", 10);
    throw new AuthError(err.code ?? "ERROR", err.message ?? "Something went wrong.", res.status, Number.isFinite(ra) ? ra : null);
  }
  return json.data as T;
}
function waitText(seconds: number) {
  if (seconds < 90) return "You can try again in about a minute.";
  const m = Math.ceil(seconds / 60);
  return m < 90 ? `You can try again in about ${m} minutes.` : `You can try again in about ${Math.round(m / 60)} hour${Math.round(m / 60) === 1 ? "" : "s"}.`;
}

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sinkCode, setSinkCode] = useState<string | null>(null);
  const [stage, setStage] = useState<"email" | "code">("email");
  const [error, setError] = useState<{ message: string; sendFailed?: boolean } | null>(null);
  const [consentError, setConsentError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<{ step: "code" | "verify"; at: number } | null>(null);
  const personasRef = useRef<HTMLDivElement>(null);
  const consentRef = useRef<HTMLLabelElement>(null);

  // Rate limits: keep the button working, but explain instead of calling again too soon.
  function stillLocked(step: "code" | "verify"): boolean {
    if (lockedUntil && lockedUntil.step === step && Date.now() < lockedUntil.at) {
      setError({ message: `Too many tries for now. ${waitText(Math.ceil((lockedUntil.at - Date.now()) / 1000))}` });
      return true;
    }
    return false;
  }
  function limitMessage(e: unknown, step: "code" | "verify"): string | null {
    if (!(e instanceof AuthError) || !LIMIT_ERRORS.includes(e.code)) return null;
    if (e.retryAfter) {
      setLockedUntil({ step, at: Date.now() + e.retryAfter * 1000 });
      return `${e.message} ${waitText(e.retryAfter)}`;
    }
    return e.message;
  }

  function needConsent(): boolean {
    if (CONSENT_REQUIRED && !consent) {
      setConsentError(true);
      consentRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return true;
    }
    return false;
  }

  async function requestCode() {
    setError(null);
    if (!email.trim()) return setError({ message: "Enter your email address." });
    if (needConsent()) return;
    if (stillLocked("code")) return;
    setBusy("code");
    try {
      const data = await authPost<{ sink_code?: string }>("/auth/request-code", { email });
      setStage("code");
      if (data.sink_code) {
        setSinkCode(data.sink_code);
        setCode(data.sink_code);
      }
    } catch (e) {
      const sendFailed = e instanceof ApiClientError && SEND_ERRORS.includes(e.code);
      const limited = limitMessage(e, "code");
      setError({
        message: limited
          ? limited
          : sendFailed
          ? PERSONAS_ON
            ? "We couldn't send your code to that address. Use a demo persona instead — it takes one click."
            : "We couldn't send your code to that address. Check it for typos, or tell us via the Feedback button."
          : e instanceof ApiClientError
            ? e.message
            : "Something went wrong. Check your connection and try again.",
        sendFailed,
      });
    } finally {
      setBusy(null);
    }
  }

  async function verify() {
    setError(null);
    if (code.trim().length < 6) return setError({ message: "Enter the 6-digit code." });
    if (stillLocked("verify")) return;
    setBusy("verify");
    try {
      const data = await authPost<{ is_new: boolean }>("/auth/verify-code", { email, code, accept_privacy: consent });
      router.push(data.is_new ? "/onboarding" : "/discover");
      router.refresh();
    } catch (e) {
      // 422 CONSENT_REQUIRED (e.g. the privacy notice changed): show the API's message and the box.
      if (e instanceof ApiClientError && e.code === "CONSENT_REQUIRED") {
        setConsentError(true);
        consentRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      // 403 FORBIDDEN (account pending deletion) and everything else: show the API's message.
      setError({ message: limitMessage(e, "verify") ?? (e instanceof ApiClientError ? e.message : "We couldn't check that code. Try again.") });
    } finally {
      setBusy(null);
    }
  }

  async function startPersona(key: string) {
    setError(null);
    if (needConsent()) return;
    setBusy(key);
    try {
      const data = await api<{ next: string }>("/auth/demo-persona", { body: { persona: key, accept_privacy: consent } });
      router.push(data.next);
      router.refresh();
    } catch (e) {
      setError({ message: e instanceof ApiClientError ? e.message : "Couldn't start the demo. Please try again." });
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen bg-pastel">
      <header className="border-b border-ink-100/70">
        <div className="mx-auto max-w-5xl px-4 py-2">
          <Logo size="sm" />
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl items-start gap-5 px-4 py-6 md:grid-cols-2 md:gap-8 md:py-10">
        <div className="card p-5 sm:p-8">
          <div className="mb-4 flex items-end gap-2" aria-hidden="true">
            <Pea size={48} mood="happy" blink />
            <Pea size={40} mood="awake" tone="fresh" blink />
          </div>
          <h1 className="font-display text-h1 text-ink md:text-h1-md">Sign in or join Peabudy</h1>
          <p className="mt-2 text-sm text-ink-600">
            {IS_BETA
              ? "We'll email you a 6-digit code to sign in. It expires in 10 minutes."
              : "Enter any email and your 6-digit code appears right here on screen — no inbox needed."}
          </p>

          {/* Consent applies to both email sign-in and demo personas. */}
          <label
            ref={consentRef}
            className={`mt-6 flex items-start gap-3 min-h-[44px] rounded-field border p-3 text-sm ${consentError ? "border-red-300 bg-red-50" : "border-ink-100 bg-cream"}`}
          >
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 accent-ink"
              checked={consent}
              onChange={(e) => { setConsent(e.target.checked); setConsentError(false); }}
            />
            <span className="text-ink-700">
              I agree to the{" "}
              <a href="/privacy" target="_blank" className="font-medium text-brand-700 underline underline-offset-2">privacy notice</a>
              {CONSENT_REQUIRED ? (
                <span className="ml-1.5 rounded bg-ink-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-600">Required</span>
              ) : (
                " (optional here)"
              )}
              {consentError && <span className="mt-1 block text-xs font-medium text-red-700" role="alert">Tick this box to continue.</span>}
            </span>
          </label>

          {stage === "email" ? (
            <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); requestCode(); }}>
              <div>
                <label className="label" htmlFor="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  className="input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  data-clarity-mask="true"
                />
              </div>
              <ErrorBox error={error} onPersonas={() => personasRef.current?.scrollIntoView({ behavior: "smooth" })} />
              <button className="btn-primary w-full" disabled={busy === "code"} aria-busy={busy === "code"}>
                {busy === "code" ? "Sending…" : IS_BETA ? "Email me a code" : "Get my code"}
              </button>
            </form>
          ) : (
            <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); verify(); }}>
              <p className="text-sm text-ink-600">
                {sinkCode ? "Your code for" : "Code sent to"} <span className="font-medium text-ink">{email}</span>
              </p>
              {sinkCode && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Your code (shown here for testing):{" "}
                  <span className="font-mono text-base font-bold tracking-widest">{sinkCode}</span>
                </div>
              )}
              <div>
                <label className="label" htmlFor="code">6-digit code</label>
                <input
                  id="code"
                  inputMode="numeric"
                  className="input font-mono tracking-widest"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  data-clarity-mask="true"
                />
              </div>
              <ErrorBox error={error} onPersonas={() => personasRef.current?.scrollIntoView({ behavior: "smooth" })} />
              <button className="btn-primary w-full" disabled={busy === "verify"} aria-busy={busy === "verify"}>
                {busy === "verify" ? "Verifying…" : "Continue"}
              </button>
              <button type="button" className="btn-ghost w-full" onClick={() => { setStage("email"); setCode(""); setSinkCode(null); setError(null); }}>
                Use a different email
              </button>
            </form>
          )}
        </div>

        {PERSONAS_ON && (
          <div ref={personasRef} className="card scroll-mt-24 p-5 sm:p-8">
            <h2 className="text-lg font-semibold text-ink">Try a demo persona</h2>
            <p className="mt-1 text-sm text-ink-600">
              Skip sign-up and explore in 30 seconds. You get your own private copy with sample housemates who
              reply automatically — nothing you do is seen by other testers.
            </p>
            <div className="mt-4 space-y-2">
              {PERSONAS.map((p) => (
                <button
                  key={p.key}
                  className="flex min-h-[64px] w-full items-center gap-3 rounded-panel border border-ink-100 bg-white p-3 text-left transition duration-quick hover:border-ink-400 hover:bg-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60"
                  disabled={!!busy}
                  onClick={() => startPersona(p.key)}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-pea-100 font-bold text-ink">{p.name[0]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink">
                      {busy === p.key ? "Setting up…" : `Try as ${p.name}`}
                      <span className="ml-2 text-xs font-normal text-ink-500">{CITIES[p.city].label.replace(" pilot", "")}</span>
                    </span>
                    <span className="block text-sm text-ink-600">{p.subtitle}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ErrorBox({ error, onPersonas }: { error: { message: string; sendFailed?: boolean } | null; onPersonas: () => void }) {
  if (!error) return null;
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
      <p>{error.message}</p>
      {error.sendFailed && PERSONAS_ON && (
        <button type="button" className="btn-secondary mt-2 w-full" onClick={onPersonas}>Use a demo persona instead</button>
      )}
    </div>
  );
}
