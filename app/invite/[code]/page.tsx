"use client";

// DES-21 activation: /invite/[code] → email code → straight into Discover.
// Contract (approval-first-api.md §3): GET /invites/[code] → {valid, email_hint?};
// POST /invites/[code] emails a code to the bound address; POST /auth/verify-code
// {activation_code, code, accept_privacy?} activates, publishes and signs in.

import { FormEvent, use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PublicShell from "@/components/PublicShell";
import Pea from "@/components/brand/Pea";
import { api, ApiClientError } from "@/lib/client";
import { AuthError, authPost, waitText } from "@/components/signin/authPost";
import { normaliseCode } from "@/components/apply/application";
import { IconArrowRight, IconCheck } from "@/components/icons";

type State =
  | { kind: "loading" }
  | { kind: "valid"; hint?: string }
  | { kind: "code"; hint?: string; sink?: string }
  | { kind: "invalid" }
  | { kind: "error" };

export default function ActivatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = use(params);
  const activation = normaliseCode(decodeURIComponent(raw));
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [needConsent, setNeedConsent] = useState(false);
  const [consent, setConsent] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let live = true;
    api<{ valid: boolean; email_hint?: string }>(`/invites/${encodeURIComponent(activation)}`)
      .then((d) => live && setState(d.valid ? { kind: "valid", hint: d.email_hint } : { kind: "invalid" }))
      .catch((e) => {
        if (!live) return;
        if (e instanceof ApiClientError && [404, 410, 422].includes(e.status) && e.code !== "ERROR") setState({ kind: "invalid" });
        else setState({ kind: "error" });
      });
    return () => { live = false; };
  }, [activation, attempt]);

  useEffect(() => { if (state.kind !== "loading") headingRef.current?.focus(); }, [state.kind]);

  async function sendCode() {
    setErr(null);
    setBusy(true);
    try {
      const r = await authPost<{ email_hint?: string; sink_code?: string }>(`/invites/${encodeURIComponent(activation)}`, {});
      const hint = r.email_hint ?? (state.kind === "valid" || state.kind === "code" ? state.hint : undefined);
      setState({ kind: "code", hint, sink: r.sink_code });
      if (r.sink_code) setOtp(r.sink_code);
    } catch (e) {
      if (e instanceof AuthError && e.code === "INVITE_INVALID") return setState({ kind: "invalid" });
      setErr(e instanceof AuthError && e.retryAfter ? `${e.message} ${waitText(e.retryAfter)}` : e instanceof ApiClientError ? e.message : "We couldn't send your code. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function activate(ev: FormEvent) {
    ev.preventDefault();
    setErr(null);
    if (!/^\d{6}$/.test(otp.trim())) return setErr("Enter the 6-digit code from the email.");
    if (needConsent && !consent) return setErr("Tick the box to agree to the privacy notice.");
    setBusy(true);
    try {
      const body: Record<string, unknown> = { activation_code: activation, code: otp.trim() };
      if (needConsent) body.accept_privacy = consent;
      const r = await authPost<{ redirect?: string }>("/auth/verify-code", body);
      router.push(r.redirect || "/discover");
      router.refresh();
    } catch (e) {
      if (e instanceof AuthError && e.code === "INVITE_INVALID") { setState({ kind: "invalid" }); setBusy(false); return; }
      if (e instanceof AuthError && e.code === "CONSENT_REQUIRED") setNeedConsent(true);
      setErr(e instanceof AuthError && e.retryAfter ? `${e.message} ${waitText(e.retryAfter)}` : e instanceof ApiClientError ? e.message : "We couldn't check that code. Try again.");
      setBusy(false);
    }
  }

  return (
    <PublicShell aside={<Link href="/signin" className="btn-ghost px-4">Sign in</Link>}>
      {state.kind === "loading" && (
        <div className="flex flex-col items-center pt-10 text-center" role="status">
          <Pea size={72} mood="awake" blink className="animate-bob" />
          <p className="mt-4 text-body text-ink-700">Checking your activation link…</p>
        </div>
      )}

      {(state.kind === "valid" || state.kind === "code") && (
        <div className="flex flex-col items-center pt-2 text-center">
          <div className="relative flex items-end" aria-hidden="true">
            <Pea size={88} mood="happy" className="animate-pop-in" />
            <Pea size={72} mood="wink" tone="fresh" className="-ml-4 animate-pop-in [animation-delay:120ms]" />
          </div>
          <p className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-sm font-semibold text-brand-800">
            <IconCheck size={14} strokeWidth={3} /> Application approved
          </p>
          <h1 ref={headingRef} tabIndex={-1} className="mt-3 font-display text-display text-ink focus:outline-none md:text-display-md">You&apos;re approved</h1>
          <p className="mt-3 max-w-md text-body-lg text-ink-700">
            One last step: confirm it&apos;s you with a code{state.hint ? <> sent to <span className="font-semibold text-ink" data-clarity-mask="true">{state.hint}</span></> : " from your email"}. Then your profile goes live and you can see who fits.
          </p>

          {state.kind === "valid" ? (
            <>
              {err && <p className="mt-5 w-full rounded-field border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700" role="alert">{err}</p>}
              <button type="button" className="btn-primary btn-lg mt-7 w-full sm:w-auto" onClick={sendCode} aria-busy={busy}>
                {busy ? "Sending…" : <>Email me a code <IconArrowRight size={18} /></>}
              </button>
            </>
          ) : (
            <form noValidate onSubmit={activate} className="card mt-7 w-full space-y-4 p-5 text-left sm:p-6">
              {state.sink && (
                <div className="rounded-field border border-caution-200 bg-caution-50 px-4 py-3 text-sm text-caution-800">
                  Your code (shown here because this is a test environment):{" "}
                  <span className="font-mono text-base font-bold tracking-widest">{state.sink}</span>
                </div>
              )}
              {!state.sink && <p className="text-sm text-ink-600">It&apos;s from hello@peabudy.com and expires in 10 minutes. Check junk too.</p>}
              <div>
                <label className="label" htmlFor="a-code">6-digit code</label>
                <input id="a-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="input font-mono text-lg tracking-[0.3em]" placeholder="000000"
                  value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} data-clarity-mask="true" />
              </div>
              {needConsent && (
                <label className="flex min-h-[44px] items-start gap-3 rounded-field border border-ink-100 bg-cream p-3 text-sm">
                  <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-ink" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  <span className="text-ink-700">
                    I agree to the updated <a href="/privacy" target="_blank" className="font-semibold text-brand-700 underline underline-offset-2">privacy notice</a>.
                  </span>
                </label>
              )}
              {err && <p className="rounded-field border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700" role="alert">{err}</p>}
              <button className="btn-primary btn-lg w-full" aria-busy={busy}>{busy ? "Activating…" : "Activate my account"}</button>
              <button type="button" className="btn-ghost w-full" onClick={sendCode} disabled={busy}>Send a new code</button>
            </form>
          )}

          <div className="card mt-8 w-full p-5 text-left sm:p-6">
            <h2 className="text-h3 text-ink">When you activate</h2>
            <ul className="mt-3 space-y-2.5 text-sm text-ink-700">
              <li className="flex gap-2.5"><Dot /> Your profile becomes visible to people whose plans fit yours, and you see theirs.</li>
              <li className="flex gap-2.5"><Dot /> Your profile shows that our team checked your ID on a video call.</li>
              <li className="flex gap-2.5"><Dot /> Report and block are always one tap away.</li>
            </ul>
            <p className="mt-4 rounded-field bg-cream px-3 py-2.5 text-sm text-ink-700">Checks completed — not a guarantee of safety.</p>
          </div>
        </div>
      )}

      {state.kind === "invalid" && (
        <div className="flex flex-col items-center pt-4 text-center">
          <Pea size={80} mood="sleep" dim />
          <h1 ref={headingRef} tabIndex={-1} className="mt-5 font-display text-h1 text-ink focus:outline-none md:text-h1-md">
            This activation link isn&apos;t valid any more
          </h1>
          <p className="mt-3 max-w-md text-body text-ink-700">
            If you&apos;ve already activated, sign in. Otherwise email{" "}
            <a href="mailto:hello@peabudy.com" className="font-semibold text-brand-700 underline underline-offset-2">hello@peabudy.com</a> and we&apos;ll send a new one.
          </p>
          <div className="mt-7 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href="/signin" className="btn-primary btn-lg">Sign in</Link>
            <Link href="/join/status" className="btn-secondary btn-lg">Check my application</Link>
          </div>
        </div>
      )}

      {state.kind === "error" && (
        <div className="flex flex-col items-center pt-4 text-center" role="alert">
          <Pea size={72} mood="wow" />
          <h1 ref={headingRef} tabIndex={-1} className="mt-5 font-display text-h1 text-ink focus:outline-none">We couldn&apos;t check your link</h1>
          <p className="mt-3 max-w-md text-body text-ink-700">Check your connection and try again. Your link is fine to reuse.</p>
          <button type="button" className="btn-primary btn-lg mt-6" onClick={() => { setState({ kind: "loading" }); setAttempt((n) => n + 1); }}>Try again</button>
        </div>
      )}
    </PublicShell>
  );
}

function Dot() {
  return <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-pea-500" aria-hidden="true" />;
}
