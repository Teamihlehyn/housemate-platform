"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/brand/Logo";
import Pea from "@/components/brand/Pea";
import WaitingRoom, { formatCountdown, useCountdown } from "@/components/signin/WaitingRoom";
import { api, ApiClientError } from "@/lib/client";
import { AuthError, authPost, readWait as readWaitKey, waitText, writeWait as writeWaitKey } from "@/components/signin/authPost";
import { normaliseCode } from "@/components/apply/application";
import { CITIES } from "@/lib/constants";
import { PERSONAS } from "@/lib/personas";

const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV;
const IS_BETA = APP_ENV === "beta";
const PERSONAS_ON = !IS_BETA;
// Beta is approval-first: sign-in is for approved users only; new people apply at /join.
const MEMBERS_ONLY = IS_BETA;
const CONSENT_REQUIRED = IS_BETA || APP_ENV === "research";
const SEND_ERRORS = ["EMAIL_SEND_FAILED", "EMAIL_NOT_CONFIGURED"];
const LIMIT_ERRORS = ["RATE_LIMITED", "TOO_MANY_ATTEMPTS"];
const WAIT_KEY = "pb_signin_wait";
// Approval-first (contract §2): every address gets this same answer; only approved users get a code.
const NEUTRAL_SENT = "If you have an approved Peabudy account, we've sent a code. New here? Apply to join.";

const readWait = () => readWaitKey(WAIT_KEY);
const writeWait = (v: { until: number; message: string } | null) => writeWaitKey(WAIT_KEY, v);

type Err = { message: string; sendFailed?: boolean };

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [activation, setActivation] = useState("");
  const [showActivation, setShowActivation] = useState(false);
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [sinkCode, setSinkCode] = useState<string | null>(null);
  const [stage, setStage] = useState<"email" | "code">("email");
  const [error, setError] = useState<Err | null>(null);
  const [consentError, setConsentError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<{ step: "code" | "verify"; at: number } | null>(null);
  // HM-26: site-wide sign-in limit. Survives a reload in this tab.
  const [wait, setWait] = useState<{ until: number; message: string } | null>(null);
  const waitLeft = useCountdown(wait?.until ?? null);
  const waiting = !!wait && waitLeft > 0;
  const personasRef = useRef<HTMLDivElement>(null);
  const consentRef = useRef<HTMLLabelElement>(null);

  useEffect(() => {
    // Old invite links (?invite=CODE) now go to activation.
    const q = new URLSearchParams(window.location.search).get("invite");
    if (q) router.replace(`/invite/${encodeURIComponent(normaliseCode(q).slice(0, 64))}`);
    const w = readWait();
    if (w) setWait(w);
  }, [router]);

  // When the wait ends, clear it so the button works again.
  useEffect(() => {
    if (wait && waitLeft <= 0) writeWait(null);
  }, [wait, waitLeft]);

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
    if (waiting) return; // the waiting room explains; the button says when
    setWait(null);
    if (!email.trim()) return setError({ message: "Enter your email address." });
    if (!MEMBERS_ONLY && needConsent()) return;
    if (stillLocked("code")) return;
    setBusy("code");
    try {
      const data = await authPost<{ sink_code?: string; message?: string }>("/auth/request-code", { email });
      setSentMessage(MEMBERS_ONLY ? data.message || NEUTRAL_SENT : null);
      setStage("code");
      if (data.sink_code) {
        setSinkCode(data.sink_code);
        setCode(data.sink_code);
      }
    } catch (e) {
      // HM-26: the site-wide limit gets the waiting room, with a real countdown.
      if (e instanceof AuthError && e.code === "RATE_LIMITED" && e.retryAfter) {
        const w = { until: Date.now() + e.retryAfter * 1000, message: e.message };
        setWait(w);
        writeWait(w);
        return;
      }
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
      const data = await authPost<{ is_new: boolean; redirect?: string }>("/auth/verify-code", { email, code, accept_privacy: consent });
      // The server says where this person belongs (staff → /staff, users → /discover). New demo
      // accounts still start with onboarding.
      const dest = data.redirect || "/discover";
      router.push(data.is_new && dest !== "/staff" ? "/onboarding" : dest);
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

  const title = MEMBERS_ONLY ? "Sign in to Peabudy" : "Sign in or join Peabudy";

  return (
    <div className="min-h-[100dvh] bg-pastel">
      <header className="border-b border-ink-100/70 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 py-2">
          <Logo size="sm" />
          {MEMBERS_ONLY && <Link href="/join" className="btn-ghost px-4">Apply to join</Link>}
        </div>
      </header>
      <main className={`mx-auto grid items-start gap-5 px-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-6 md:gap-8 md:pt-10 ${PERSONAS_ON ? "max-w-5xl md:grid-cols-2" : "max-w-xl"}`}>
        <div className="card p-5 sm:p-8">
          <div className="mb-4 flex items-end gap-2" aria-hidden="true">
            <Pea size={48} mood="happy" blink />
            <Pea size={40} mood="awake" tone="fresh" blink />
          </div>
          <h1 className="font-display text-h1 text-ink md:text-h1-md">{title}</h1>
          <p className="mt-2 text-sm text-ink-600">
            {MEMBERS_ONLY
              ? "For approved users. We'll email you a 6-digit code from hello@peabudy.com. It expires in 10 minutes."
              : "Enter any email and your 6-digit code appears right here on screen — no inbox needed."}
          </p>

          {/* Consent applies to both email sign-in and demo personas. Users gave it when they
              applied, so in beta the box only appears if the notice changed (CONSENT_REQUIRED). */}
          {(!MEMBERS_ONLY || consentError) && (
          <label
            ref={consentRef}
            className={`mt-6 flex items-start gap-3 min-h-[44px] rounded-field border p-3 text-sm ${consentError ? "border-danger-200 bg-danger-50" : "border-ink-100 bg-cream"}`}
          >
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 shrink-0 accent-ink"
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
              {consentError && <span className="mt-1 block text-xs font-medium text-danger-700" role="alert">Tick this box to continue.</span>}
            </span>
          </label>
          )}

          {stage === "email" ? (
            <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); requestCode(); }}>
              <div>
                <label className="label" htmlFor="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  className="input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  data-clarity-mask="true"
                />
              </div>

              {wait ? (
                <WaitingRoom until={wait.until} message={wait.message} />
              ) : (
                <ErrorBox error={error} onPersonas={() => personasRef.current?.scrollIntoView({ behavior: "smooth" })} />
              )}

              <button
                className="btn-primary w-full aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
                disabled={busy === "code"}
                aria-disabled={waiting || undefined}
                aria-busy={busy === "code"}
                data-waiting={waiting || undefined}
              >
                {busy === "code"
                  ? "Sending…"
                  : waiting
                    ? <span className="num">Try again in {formatCountdown(waitLeft)}</span>
                    : IS_BETA ? "Email me a code" : "Get my code"}
              </button>
              {MEMBERS_ONLY && !waiting && (
                <div className="space-y-1 text-center text-sm text-ink-600">
                  <p>
                    New here?{" "}
                    <Link href="/join" className="inline-flex min-h-[44px] items-center font-semibold text-brand-700 underline underline-offset-4">Apply to join</Link>
                  </p>
                  {!showActivation ? (
                    <button type="button" className="inline-flex min-h-[44px] items-center font-semibold text-brand-700 underline underline-offset-4" onClick={() => setShowActivation(true)}>
                      Have an activation code?
                    </button>
                  ) : (
                    <ActivationBox value={activation} onChange={setActivation} onGo={() => { const c = normaliseCode(activation); if (c) router.push(`/invite/${encodeURIComponent(c)}`); }} />
                  )}
                </div>
              )}
            </form>
          ) : (
            <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); verify(); }}>
              {sentMessage ? (
                <div className="rounded-field bg-cream px-4 py-3 text-sm text-ink-700" role="status">
                  {/* The founder's fixed wording, identical for every address (HM-28). */}
                  <p>If you have an approved Peabudy account, we&apos;ve sent a code. New here? <Link href="/join" className="font-semibold text-brand-700 underline underline-offset-2">Apply to join</Link>.</p>
                </div>
              ) : (
                <p className="text-sm text-ink-600">
                  {sinkCode ? "Your code for" : "Code sent to"} <span className="font-medium text-ink" data-clarity-mask="true">{email}</span>
                </p>
              )}
              {sinkCode && (
                <div className="rounded-field border border-caution-200 bg-caution-50 px-4 py-3 text-sm text-caution-800">
                  Your code (shown here for testing):{" "}
                  <span className="font-mono text-base font-bold tracking-widest">{sinkCode}</span>
                </div>
              )}
              {!sinkCode && IS_BETA && (
                <p className="text-sm text-ink-600">It can take a minute. Check your junk or spam folder too.</p>
              )}
              <div>
                <label className="label" htmlFor="code">6-digit code</label>
                <input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
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

function ErrorBox({ error, onPersonas }: { error: Err | null; onPersonas: () => void }) {
  if (!error) return null;
  return (
    <div className="rounded-field border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700" role="alert">
      <p>{error.message}</p>
      {error.sendFailed && PERSONAS_ON && (
        <button type="button" className="btn-secondary mt-2 w-full" onClick={onPersonas}>Use a demo persona instead</button>
      )}
    </div>
  );
}

function ActivationBox({ value, onChange, onGo }: { value: string; onChange: (v: string) => void; onGo: () => void }) {
  return (
    <div className="mt-2 rounded-field border border-ink-100 bg-cream p-3 text-left">
      <label className="label" htmlFor="act">Activation code</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input id="act" className="input font-mono uppercase tracking-wider" value={value} onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onGo(); } }}
          autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={64} />
        <button type="button" className="btn-secondary shrink-0" onClick={onGo}>Continue</button>
      </div>
      <p className="helper">It&apos;s in your “You&apos;re approved” email.</p>
    </div>
  );
}
