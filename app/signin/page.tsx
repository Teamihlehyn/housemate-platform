"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/client";
import { CITIES } from "@/lib/constants";
import { PERSONAS } from "@/lib/personas";

const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV;
const IS_BETA = APP_ENV === "beta";
const PERSONAS_ON = !IS_BETA;
const CONSENT_REQUIRED = IS_BETA || APP_ENV === "research";
const SEND_ERRORS = ["EMAIL_SEND_FAILED", "EMAIL_NOT_CONFIGURED"];

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
  const personasRef = useRef<HTMLDivElement>(null);
  const consentRef = useRef<HTMLLabelElement>(null);

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
    setBusy("code");
    try {
      const data = await api<{ sink_code?: string }>("/auth/request-code", { body: { email } });
      setStage("code");
      if (data.sink_code) {
        setSinkCode(data.sink_code);
        setCode(data.sink_code);
      }
    } catch (e) {
      const sendFailed = e instanceof ApiClientError && SEND_ERRORS.includes(e.code);
      setError({
        message: sendFailed
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
    setBusy("verify");
    try {
      const data = await api<{ is_new: boolean }>("/auth/verify-code", { body: { email, code, accept_privacy: consent } });
      router.push(data.is_new ? "/onboarding" : "/discover");
      router.refresh();
    } catch (e) {
      setError({ message: e instanceof ApiClientError ? e.message : "Could not verify." });
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
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <Link href="/" className="font-bold text-brand-700">← Housemate</Link>
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-2">
        <div className="card p-8">
          <h1 className="text-2xl font-bold text-stone-900">Sign in or create an account</h1>
          <p className="mt-2 text-sm text-stone-600">
            {IS_BETA
              ? "We'll email you a 6-digit code to sign in. It expires in 10 minutes."
              : "Enter any email and your 6-digit code appears right here on screen — no inbox needed."}
          </p>

          {/* Consent applies to both email sign-in and demo personas. */}
          <label
            ref={consentRef}
            className={`mt-6 flex items-start gap-3 rounded-lg border p-3 text-sm ${consentError ? "border-red-300 bg-red-50" : "border-stone-200 bg-stone-50"}`}
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4"
              checked={consent}
              onChange={(e) => { setConsent(e.target.checked); setConsentError(false); }}
            />
            <span className="text-stone-700">
              I agree to the{" "}
              <a href="/privacy" target="_blank" className="font-medium text-brand-700 underline underline-offset-2">privacy notice</a>
              {CONSENT_REQUIRED ? (
                <span className="ml-1.5 rounded bg-stone-200 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-stone-600">Required</span>
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
              <button className="btn-primary w-full" disabled={busy === "code"}>
                {busy === "code" ? "Sending…" : IS_BETA ? "Email me a code" : "Get my code"}
              </button>
            </form>
          ) : (
            <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); verify(); }}>
              <p className="text-sm text-stone-600">
                {sinkCode ? "Your code for" : "Code sent to"} <span className="font-medium text-stone-900">{email}</span>
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
              <button className="btn-primary w-full" disabled={busy === "verify" || code.length < 6}>
                {busy === "verify" ? "Verifying…" : "Continue"}
              </button>
              <button type="button" className="btn-ghost w-full" onClick={() => { setStage("email"); setCode(""); setSinkCode(null); setError(null); }}>
                Use a different email
              </button>
            </form>
          )}
        </div>

        {PERSONAS_ON && (
          <div ref={personasRef} className="card scroll-mt-6 p-8">
            <h2 className="text-lg font-semibold text-stone-900">Try a demo persona</h2>
            <p className="mt-1 text-sm text-stone-600">
              Skip sign-up and explore in 30 seconds. You get your own private copy with sample housemates who
              reply automatically — nothing you do is seen by other testers.
            </p>
            <div className="mt-4 space-y-2">
              {PERSONAS.map((p) => (
                <button
                  key={p.key}
                  className="flex w-full items-center gap-3 rounded-xl border border-stone-200 bg-white p-3 text-left transition hover:border-brand-400 hover:bg-brand-50 disabled:opacity-60"
                  disabled={!!busy}
                  onClick={() => startPersona(p.key)}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-100 font-bold text-brand-700">{p.name[0]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-stone-900">
                      {busy === p.key ? "Setting up…" : `Try as ${p.name}`}
                      <span className="ml-2 text-xs font-normal text-stone-400">{CITIES[p.city].label.replace(" pilot", "")}</span>
                    </span>
                    <span className="block text-sm text-stone-500">{p.subtitle}</span>
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
