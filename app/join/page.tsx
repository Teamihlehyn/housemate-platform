"use client";

// DES-20: "Apply to join". Email code first (proves the address, lets the draft save as you
// go), then the conversational questions shared with onboarding, then submit.
// Contract: docs/engineering/approval-first-api.md §1.

import { FormEvent, Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Logo from "@/components/brand/Logo";
import Pea from "@/components/brand/Pea";
import { PeaSays, TextLink } from "@/components/PublicShell";
import WaitingRoom, { formatCountdown, useCountdown } from "@/components/signin/WaitingRoom";
import { AuthError, authPost, readWait, waitText, writeWait } from "@/components/signin/authPost";
import QuestionFlow, { FinishResult } from "@/components/apply/QuestionFlow";
import { resumeScreen, screenForMissing, ScreenId, useProfileDraft } from "@/components/apply/useProfileDraft";
import { Application, CITY_NAME } from "@/components/apply/application";
import { api, ApiClientError } from "@/lib/client";
import { IconArrowRight, IconCheck, IconLock } from "@/components/icons";

const WAIT_KEY = "pb_join_wait";
const LONDON_BADGE = "Opening later — we'll hold your application";

type Stage = "loading" | "email" | "code" | "unavailable" | "questions" | "paused" | "received";

export default function JoinPage() {
  return (
    <Suspense fallback={<Shell><Loading /></Shell>}>
      <Join />
    </Suspense>
  );
}

function Join() {
  const router = useRouter();
  const params = useSearchParams();
  const editing = params.get("edit") === "1";
  const d = useProfileDraft();
  const { hydrate } = d;

  const [stage, setStage] = useState<Stage>("loading");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState("");
  const [sinkCode, setSinkCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; paused?: boolean } | null>(null);
  const [fieldErr, setFieldErr] = useState<{ email?: string; consent?: string; code?: string }>({});
  const [resent, setResent] = useState(false);
  const [resume, setResume] = useState<ScreenId | undefined>(undefined);
  const [surveyOptIn, setSurveyOptIn] = useState(false);
  const [result, setResult] = useState<Application | null>(null);
  const [wait, setWait] = useState<{ until: number; message: string } | null>(null);
  const waitLeft = useCountdown(wait?.until ?? null);
  const waiting = !!wait && waitLeft > 0;
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Load the application session if there is one; otherwise start at the email step.
  const enter = useCallback(async () => {
    try {
      const me = await api<any>("/me");
      // Not an applicant: send staff and users where their own session belongs.
      if (me.sessionScope === "staff" || me.sessionScope === "member" || (!me.application && me.accountStatus === "active")) {
        router.replace(me.sessionScope === "staff" ? "/staff" : "/discover");
        return;
      }
      const app: Application | null = me.application ?? null;
      if (app && app.status !== "draft" && !(editing && app.can_edit)) {
        router.replace("/join/status");
        return;
      }
      hydrate(me);
      if ((me.preferences?.survey_opt_in ?? me.survey_opt_in) === true) setSurveyOptIn(true);
      setResume(editing ? "review" : resumeScreen(me));
      setStage("questions");
    } catch {
      setStage("email");
    }
  }, [router, hydrate, editing]);

  useEffect(() => {
    void enter();
    const w = readWait(WAIT_KEY);
    if (w) setWait(w);
  }, [enter]);
  useEffect(() => { if (wait && waitLeft <= 0) writeWait(WAIT_KEY, null); }, [wait, waitLeft]);

  // Focus the heading when the stage changes, so screen readers hear where they are.
  useEffect(() => { if (stage !== "loading" && stage !== "questions") headingRef.current?.focus(); }, [stage]);

  function limited(e: unknown): boolean {
    if (!(e instanceof AuthError) || e.code !== "RATE_LIMITED" || !e.retryAfter) return false;
    // A long wait is the site-wide busy limit (HM-26): give it the waiting room.
    const w = { until: Date.now() + e.retryAfter * 1000, message: e.message };
    setWait(w);
    writeWait(WAIT_KEY, w);
    return true;
  }

  async function start(ev?: FormEvent, again = false) {
    ev?.preventDefault();
    setError(null);
    setFieldErr({});
    if (waiting) return;
    const fe: typeof fieldErr = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) fe.email = "Enter your email address, like name@example.com.";
    if (!consent) fe.consent = "Tick this box so we can keep your application.";
    if (fe.email || fe.consent) {
      setFieldErr(fe);
      document.getElementById(fe.email ? "j-email" : "j-consent")?.focus();
      return;
    }
    setBusy(true);
    try {
      const r = await authPost<{ sink_code?: string }>("/applications/start", { email: email.trim(), consent_privacy: true });
      setSinkCode(r.sink_code ?? null);
      setCode(r.sink_code ?? "");
      setResent(again);
      setStage("code");
    } catch (e) {
      if (limited(e)) return;
      if (e instanceof AuthError && e.code === "FORBIDDEN") return setError({ message: e.message, paused: true });
      if (e instanceof AuthError && e.fieldErrors && Object.keys(e.fieldErrors).length) {
        return setFieldErr({ email: e.fieldErrors.email, consent: e.fieldErrors.consent_privacy });
      }
      setError({ message: e instanceof AuthError && e.retryAfter ? `${e.message} ${waitText(e.retryAfter)}` : e instanceof ApiClientError ? e.message : "Something went wrong. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  async function verify(ev: FormEvent) {
    ev.preventDefault();
    setError(null);
    setFieldErr({});
    if (!/^\d{6}$/.test(code.trim())) return setFieldErr({ code: "Enter the 6-digit code from the email." });
    setBusy(true);
    try {
      const r = await authPost<{ outcome: "application" | "member" | "unavailable"; application?: Application; redirect?: string; user?: { redirect?: string } }>("/applications/verify", { email: email.trim(), code: code.trim() });
      const dest = r.redirect ?? r.user?.redirect;
      if (r.outcome === "member") {
        router.push(dest || "/discover");
        router.refresh();
        return;
      }
      if (r.outcome === "unavailable") return setStage("unavailable");
      if (r.application && r.application.status !== "draft") {
        router.push(dest || "/join/status");
        return;
      }
      await enter();
    } catch (e) {
      if (e instanceof AuthError && e.code === "FORBIDDEN") return setError({ message: e.message, paused: true });
      const msg = e instanceof AuthError && e.retryAfter ? `${e.message} ${waitText(e.retryAfter)}` : e instanceof ApiClientError ? e.message : "We couldn't check that code. Try again.";
      if (e instanceof AuthError && (e.code === "INVALID_CODE" || e.code === "CODE_EXPIRED")) setFieldErr({ code: msg });
      else setError({ message: msg });
    } finally {
      setBusy(false);
    }
  }

  async function submit(): Promise<FinishResult> {
    if (editing) {
      // Submitted applications save per screen; nothing more to send.
      router.push("/join/status");
      return { ok: true };
    }
    try {
      const r = await api<{ application: Application }>("/applications/submit", { body: { survey_opt_in: surveyOptIn } });
      setResult(r.application);
      setStage("received");
      window.scrollTo({ top: 0 });
      return { ok: true };
    } catch (e) {
      if (e instanceof ApiClientError) {
        if (e.code === "STATE_CONFLICT") { router.push("/join/status"); return { ok: true }; }
        return { ok: false, message: e.message, screen: e.code === "UNDECIDED_DATES" ? "dates" : screenForMissing(e.fieldErrors, e.message) };
      }
      return { ok: false, message: "We couldn't send your application. Your answers are saved. Check your connection and try again." };
    }
  }

  /* --------------------------------- screens -------------------------------- */

  if (stage === "loading") return <Shell><Loading /></Shell>;

  if (stage === "questions") {
    return (
      <Shell aside={<button type="button" className="btn-ghost px-4" onClick={() => setStage("paused")}>Finish later</button>} flush>
        <QuestionFlow
          d={d}
          mode="join"
          editing={editing}
          initialScreen={resume}
          finishLabel={editing ? "Back to my status" : "Send my application"}
          finishBusyLabel={editing ? "Saving…" : "Sending…"}
          onFinish={submit}
          minHeightClass="min-h-[calc(100dvh-61px)]"
          cityBadges={{ london: LONDON_BADGE }}
          cityNote={(c) =>
            c === "london" ? (
              <p className="mt-4 rounded-field bg-sky-100 px-3 py-2.5 text-sm text-sky-800" role="status">
                We&apos;re starting in Lagos. You can still apply: we&apos;ll hold your application, email you when London opens and book your ID call then.
              </p>
            ) : null
          }
          reviewNote={<ReviewNote editing={editing} />}
          reviewExtras={
            !editing && (
              <label className="mt-4 flex min-h-[44px] cursor-pointer items-start gap-3 rounded-field border border-ink-100 bg-white p-3.5 text-sm">
                <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-ink" checked={surveyOptIn} onChange={(e) => setSurveyOptIn(e.target.checked)} />
                <span className="text-ink-700">
                  Email me a short survey about my experience. Optional. About 4 minutes, sent once with at most one reminder. Stop any time in Settings or from the email.
                </span>
              </label>
            )
          }
        />
      </Shell>
    );
  }

  if (stage === "paused") {
    return (
      <Shell>
        <div className="flex flex-col items-center pt-4 text-center">
          <Pea size={80} mood="happy" />
          <h1 ref={headingRef} tabIndex={-1} className="mt-5 font-display text-h1 text-ink focus:outline-none md:text-h1-md">Your answers are saved</h1>
          <p className="mt-3 max-w-md text-body text-ink-700">
            Come back to <strong className="font-semibold text-ink">peabudy.com/join</strong> on any device and enter the same email address. We&apos;ll send a code and you&apos;ll carry on where you left off.
          </p>
          <p className="mt-2 max-w-md text-sm text-ink-600">Unsent applications are deleted 30 days after your last change.</p>
          <button type="button" className="btn-primary btn-lg mt-7 w-full sm:w-auto" onClick={() => setStage("questions")}>
            Carry on now <IconArrowRight size={18} />
          </button>
          <Link href="/" className="btn-ghost mt-2">Go to the home page</Link>
        </div>
      </Shell>
    );
  }

  if (stage === "received" && result) return <Received app={result} name={d.displayName.trim().split(/\s+/)[0] || ""} headingRef={headingRef} />;

  if (stage === "unavailable") {
    return (
      <Shell>
        <div className="card flex flex-col items-center p-6 text-center sm:p-10">
          <Pea size={72} mood="sleep" dim />
          <h1 ref={headingRef} tabIndex={-1} className="mt-4 font-display text-h1 text-ink focus:outline-none">We can&apos;t take an application from this address</h1>
          <p className="mt-2 max-w-sm text-body text-ink-700">
            If you think that&apos;s a mistake, email <a className="font-semibold text-brand-700 underline underline-offset-2" href="mailto:hello@peabudy.com">hello@peabudy.com</a>.
          </p>
          <Link href="/" className="btn-secondary btn-lg mt-6">Go to the home page</Link>
        </div>
      </Shell>
    );
  }

  if (stage === "code") {
    return (
      <Shell aside={<Link href="/signin" className="btn-ghost px-4">Sign in</Link>}>
        <PeaSays mood="wow" friend="awake">Check your inbox. The code is from hello@peabudy.com.</PeaSays>
        <h1 ref={headingRef} tabIndex={-1} className="mt-6 font-display text-h1 text-ink focus:outline-none md:text-h1-md">Enter your code</h1>
        <p className="mt-2 text-body text-ink-700">
          {sinkCode ? "Your code for " : "We've sent a 6-digit code to "}
          <span className="font-semibold text-ink" data-clarity-mask="true">{email.trim()}</span>. It expires in 10 minutes.
        </p>
        {!sinkCode && <p className="mt-1 text-sm text-ink-600">It can take a minute. Check your junk or spam folder too.</p>}

        <form noValidate onSubmit={verify} className="card mt-6 space-y-4 p-5 sm:p-6">
          {sinkCode && (
            <div className="rounded-field border border-caution-200 bg-caution-50 px-4 py-3 text-sm text-caution-800">
              Your code (shown here because this is a test environment):{" "}
              <span className="font-mono text-base font-bold tracking-widest">{sinkCode}</span>
            </div>
          )}
          <div>
            <label className="label" htmlFor="j-code">6-digit code</label>
            <input
              id="j-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="input font-mono text-lg tracking-[0.3em]"
              placeholder="000000"
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setFieldErr({}); }}
              aria-invalid={!!fieldErr.code}
              aria-describedby={fieldErr.code ? "j-code-err" : undefined}
              data-clarity-mask="true"
            />
            {fieldErr.code && <p id="j-code-err" className="field-error" role="alert">{fieldErr.code}</p>}
          </div>
          {error && <ErrorBox error={error} />}
          {resent && !error && <p className="text-sm text-brand-800" role="status">We&apos;ve sent a new code. Use the newest one.</p>}
          <button className="btn-primary btn-lg w-full" aria-busy={busy}>{busy ? "Checking…" : <>Continue <IconArrowRight size={18} /></>}</button>
          <div className="flex flex-col items-center gap-0 sm:flex-row sm:justify-center sm:gap-2">
            <button type="button" className="btn-ghost" onClick={() => start(undefined, true)} disabled={busy}>Send a new code</button>
            <button type="button" className="btn-ghost" onClick={() => { setStage("email"); setCode(""); setSinkCode(null); setError(null); setResent(false); }}>Use a different email</button>
          </div>
        </form>
      </Shell>
    );
  }

  /* email (first) */
  return (
    <Shell aside={<Link href="/signin" className="btn-ghost px-4">Sign in</Link>}>
      <PeaSays mood="happy" friend="awake">Hi, I&apos;m Pea, and this is Bud. Joining Peabudy is an application, and a person on our team reads every one.</PeaSays>

      <h1 ref={headingRef} tabIndex={-1} className="mt-6 font-display text-h1 text-ink focus:outline-none md:text-h1-md">Apply to join Peabudy</h1>
      <ol className="mt-4 space-y-3 text-body-sm text-ink-700">
        {[
          ["Confirm your email", "We send a 6-digit code, so your answers can save as you go."],
          ["Tell us your plans", "Dates, budget, areas, living habits and a short bio. One question at a time."],
          ["A short video ID call", "About 10 minutes with our team, to see your photo ID. Then we email your invite."],
        ].map(([t, s], i) => (
          <li key={t} className="flex gap-3">
            <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full bg-pea-100 text-sm font-bold text-ink" aria-hidden="true">{i + 1}</span>
            <span><strong className="font-semibold text-ink">{t}.</strong> {s}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 rounded-field bg-white px-3 py-2.5 text-sm text-ink-700 ring-1 ring-ink-100">
        We&apos;re open in <strong className="font-semibold text-ink">Lagos</strong>. London applications are welcome too: we hold them until London opens.
      </p>

      <form noValidate onSubmit={start} className="card mt-6 space-y-4 p-5 sm:p-6">
        <div>
          <label className="label" htmlFor="j-email">Email address</label>
          <input
            id="j-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            className="input"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setFieldErr((f) => ({ ...f, email: undefined })); }}
            aria-invalid={!!fieldErr.email}
            aria-describedby={fieldErr.email ? "j-email-err" : undefined}
            data-clarity-mask="true"
          />
          {fieldErr.email && <p id="j-email-err" className="field-error" role="alert">{fieldErr.email}</p>}
        </div>
        <label className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-field border p-3 text-sm ${fieldErr.consent ? "border-danger-200 bg-danger-50" : "border-ink-100 bg-cream"}`}>
          <input
            id="j-consent"
            type="checkbox"
            className="mt-0.5 h-5 w-5 shrink-0 accent-ink"
            checked={consent}
            onChange={(e) => { setConsent(e.target.checked); setFieldErr((f) => ({ ...f, consent: undefined })); }}
            aria-describedby={fieldErr.consent ? "j-consent-err" : undefined}
          />
          <span className="text-ink-700">
            I agree that Peabudy can use my answers to review my application, as described in the{" "}
            <a href="/privacy" target="_blank" className="font-semibold text-brand-700 underline underline-offset-2">privacy notice</a>.
            {fieldErr.consent && <span id="j-consent-err" className="mt-1 block font-medium text-danger-700" role="alert">{fieldErr.consent}</span>}
          </span>
        </label>

        {wait ? <WaitingRoom until={wait.until} message={wait.message} applyLink={false} /> : error && <ErrorBox error={error} />}

        <button
          className="btn-primary btn-lg w-full aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
          aria-busy={busy}
          aria-disabled={waiting || undefined}
        >
          {busy ? "Sending…" : waiting ? <span className="num">Try again in {formatCountdown(waitLeft)}</span> : <>Email me a code <IconArrowRight size={18} /></>}
        </button>
        <p className="flex items-start justify-center gap-1.5 text-center text-caption text-ink-600">
          <IconLock size={14} className="mt-0.5 shrink-0" />
          You must be 18 or over. Peabudy never asks for money.
        </p>
      </form>

      <p className="mt-6 text-center text-sm text-ink-700">
        Already approved? <TextLink href="/signin">Sign in</TextLink>
      </p>
    </Shell>
  );
}

/* ---------------------------------- pieces ---------------------------------- */

function Shell({ children, aside, flush = false }: { children: React.ReactNode; aside?: React.ReactNode; flush?: boolean }) {
  return (
    <div className="min-h-[100dvh] bg-pastel">
      <header className="border-b border-ink-100/70 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 py-2">
          <Logo size="sm" />
          {aside}
        </div>
      </header>
      {flush ? children : (
        <main className="mx-auto w-full max-w-xl px-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-6 sm:pt-10">{children}</main>
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex flex-col items-center pt-10 text-center" role="status">
      <Pea size={72} mood="awake" blink className="animate-bob" />
      <p className="mt-4 text-body text-ink-700">One moment…</p>
    </div>
  );
}

function ErrorBox({ error }: { error: { message: string; paused?: boolean } }) {
  if (error.paused) {
    return (
      <div className="flex gap-3 rounded-field border border-caution-200 bg-caution-50 p-3.5 text-sm text-caution-800" role="alert">
        <Pea size={40} mood="sleep" className="shrink-0" />
        <div>
          <p className="font-semibold">Applications are paused for a few days</p>
          <p className="mt-0.5">{error.message} Approved users can still <Link href="/signin" className="font-semibold underline underline-offset-2">sign in</Link>.</p>
        </div>
      </div>
    );
  }
  return <p className="rounded-field border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700" role="alert">{error.message}</p>;
}

function ReviewNote({ editing }: { editing: boolean }) {
  return (
    <div className="mt-4 space-y-2 text-sm text-ink-700">
      {editing ? (
        <p className="rounded-field bg-brand-50 px-3 py-2.5 text-brand-800">Every change saves as you go. Your application stays in the queue in the same place.</p>
      ) : (
        <p>
          <strong className="font-semibold text-ink">What happens next:</strong> a person on our team reads your application, then emails you to book a short video call to see your photo ID. Nobody sees your profile until you&apos;re approved and activate your account.
        </p>
      )}
      <p className="flex items-start gap-2">
        <IconLock size={16} className="mt-0.5 shrink-0 text-ink-600" />
        <span>Your gender, who you&apos;d live with and any address stay private. A reviewer only opens them if needed, and that&apos;s logged.</span>
      </p>
    </div>
  );
}

function Received({ app, name, headingRef }: { app: Application; name: string; headingRef: React.RefObject<HTMLHeadingElement | null> }) {
  const held = app.status === "waitlisted";
  const city = CITY_NAME[app.city ?? ""] ?? "your city";
  const steps = held
    ? [
        ["Application sent", true],
        [`${city} opens`, false],
        ["Short video ID call", false],
        ["You're approved and activate", false],
      ]
    : [
        ["Application sent", true],
        ["We email you to book a video ID call", false],
        ["About 10 minutes on video, with your photo ID", false],
        ["You're approved and activate", false],
      ];
  return (
    <Shell>
      <div className="flex flex-col items-center pt-2 text-center">
        <div className="flex items-end" aria-hidden="true">
          <Pea size={84} mood="happy" className="animate-pop-in" />
          <Pea size={68} mood="wink" tone="fresh" className="-ml-3 animate-pop-in [animation-delay:120ms]" />
        </div>
        <p className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-sm font-semibold text-brand-800">
          <IconCheck size={14} strokeWidth={3} /> {held ? "Application held" : "Application received"}
        </p>
        <h1 ref={headingRef} tabIndex={-1} className="mt-3 font-display text-h1 text-ink focus:outline-none md:text-h1-md">
          {held ? `Thanks${name ? `, ${name}` : ""}. ${city} opens later.` : `Thanks${name ? `, ${name}` : ""}. We've got your application.`}
        </h1>
        <p className="mt-3 max-w-md text-body-lg text-ink-700">
          {held
            ? `We're starting in Lagos. We'll hold your application and email you when ${city} opens. There's no ID call until then.`
            : "We'll email you within a day to book a 10-minute video ID call."}
        </p>
      </div>

      <div className="card mt-8 p-5 sm:p-6">
        <h2 className="text-h3 text-ink">What happens next</h2>
        <ol className="mt-3 space-y-3 text-sm text-ink-700">
          {steps.map(([t, done], i) => (
            <li key={t as string} className="flex items-center gap-3">
              <span className={`num grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${done ? "bg-ink text-cream" : "bg-pea-100 text-ink"}`} aria-hidden="true">
                {done ? <IconCheck size={14} strokeWidth={3} /> : i + 1}
              </span>
              <span>{t}{done && <span className="sr-only"> (done)</span>}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 rounded-field bg-cream px-3 py-2.5 text-sm text-ink-700">
          We&apos;ve emailed you a link to check your status any time. Peabudy never asks for money, and nobody from our team will ask for a fee.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href="/join/status" className="btn-primary btn-lg">See my status</Link>
        <Link href="/" className="btn-secondary btn-lg">Back to the home page</Link>
      </div>
    </Shell>
  );
}
