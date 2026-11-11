"use client";

// DES-21: application status. Reached from the application session (same device) or the E1
// magic link (/join/status?t=…, read-only). Never through sign-in.
// Contract: docs/engineering/approval-first-api.md §1 (GET /applications/status, withdraw,
// /me/export, /me/delete). Every state has one clear next step; none implies "safe" or "matched".

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import PublicShell, { TextLink } from "@/components/PublicShell";
import Pea, { PeaMood } from "@/components/brand/Pea";
import { api, ApiClientError } from "@/lib/client";
import { Application, CITY_NAME, callTime, longDate, normaliseCode } from "@/components/apply/application";
import { IconArrowRight, IconCalendar, IconCheck, IconLock } from "@/components/icons";

type Load = { kind: "loading" } | { kind: "ok"; app: Application } | { kind: "signedOut" } | { kind: "badLink" } | { kind: "error" };

export default function StatusPage() {
  return (
    <Suspense fallback={<PublicShell><Spinner /></PublicShell>}>
      <Status />
    </Suspense>
  );
}

function Status() {
  const router = useRouter();
  const token = useSearchParams().get("t");
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [confirm, setConfirm] = useState<null | "withdraw" | "delete">(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [activation, setActivation] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ application: Application }>(`/applications/status${token ? `?t=${encodeURIComponent(token)}` : ""}`);
      setState({ kind: "ok", app: r.application });
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 401) setState({ kind: "signedOut" });
      else if (e instanceof ApiClientError && e.status === 404) setState(token ? { kind: "badLink" } : { kind: "signedOut" });
      else setState({ kind: "error" });
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);
  // Focus the heading whenever the state changes (including after withdrawing).
  const focusKey = state.kind === "ok" ? state.app.status : state.kind;
  useEffect(() => { if (focusKey !== "loading") headingRef.current?.focus(); }, [focusKey]);

  async function withdraw() {
    setBusy("withdraw"); setMsg(null);
    try {
      const r = await api<{ application: Application }>("/applications/withdraw", { body: {} });
      setConfirm(null);
      setState({ kind: "ok", app: r.application });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiClientError && e.code !== "ERROR" ? e.message : "We couldn't withdraw it. Check your connection and try again." });
    } finally { setBusy(null); }
  }

  async function exportData() {
    setBusy("export"); setMsg(null);
    try {
      const d = await api<{ export: unknown }>("/me/export");
      const blob = new Blob([JSON.stringify(d.export, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "peabudy-application.json"; a.click();
      URL.revokeObjectURL(url);
      setMsg({ ok: true, text: "Your data has been downloaded." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiClientError && e.code !== "ERROR" ? e.message : "We couldn't prepare your data. Try again." });
    } finally { setBusy(null); }
  }

  async function del() {
    setBusy("delete"); setMsg(null);
    try {
      await api("/me/delete", { body: {} });
      router.push("/?deleted=1");
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiClientError && e.code !== "ERROR" ? e.message : "We couldn't delete it. Check your connection and try again." });
      setBusy(null);
    }
  }

  async function startAgain() {
    // Reopening needs the email code again (contract §1: verify reopens the same application).
    try { await api("/auth/logout", { body: {} }); } catch {}
    router.push("/join");
    router.refresh();
  }

  async function signOut() {
    try { await api("/auth/logout", { body: {} }); } catch {}
    router.push("/");
    router.refresh();
  }

  if (state.kind === "loading") return <PublicShell><Spinner /></PublicShell>;

  if (state.kind === "signedOut" || state.kind === "badLink") {
    return (
      <PublicShell aside={<Link href="/signin" className="btn-ghost px-4">Sign in</Link>}>
        <div className="card flex flex-col items-center p-6 text-center sm:p-10">
          <Pea size={72} mood={state.kind === "badLink" ? "sleep" : "awake"} dim={state.kind === "badLink"} blink />
          <h1 ref={headingRef} tabIndex={-1} className="mt-4 font-display text-h1 text-ink focus:outline-none">
            {state.kind === "badLink" ? "This status link doesn't work any more" : "Check your application"}
          </h1>
          <p className="mt-2 max-w-sm text-body text-ink-700">
            {state.kind === "badLink"
              ? "It may be from an older email. Enter your email address on the application page and we'll send you a code to see where things are."
              : "Use the link in the email we sent when you applied, or enter your email address and we'll send you a code."}
          </p>
          <Link href="/join" className="btn-primary btn-lg mt-6 w-full sm:w-auto">Continue with my email <IconArrowRight size={18} /></Link>
        </div>
      </PublicShell>
    );
  }

  if (state.kind === "error") {
    return (
      <PublicShell>
        <div className="card flex flex-col items-center p-6 text-center sm:p-10" role="alert">
          <Pea size={72} mood="wow" />
          <h1 ref={headingRef} tabIndex={-1} className="mt-4 font-display text-h1 text-ink focus:outline-none">We couldn&apos;t load your status</h1>
          <p className="mt-2 max-w-sm text-body text-ink-700">Check your connection and try again. Nothing about your application has changed.</p>
          <button type="button" className="btn-primary btn-lg mt-6" onClick={() => { setState({ kind: "loading" }); void load(); }}>Try again</button>
        </div>
      </PublicShell>
    );
  }

  const app = state.app;
  const city = CITY_NAME[app.city ?? ""] ?? "your city";
  const v = view(app, city);
  const session = !app.read_only;

  return (
    <PublicShell aside={session ? <button type="button" onClick={signOut} className="btn-ghost px-4">Sign out</button> : <Link href="/signin" className="btn-ghost px-4">Sign in</Link>}>
      <div className="flex flex-col items-center text-center">
        <Pea size={80} mood={v.mood} dim={v.mood === "sleep"} blink={v.mood === "awake"} />
        <p className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${v.chipClass}`}>
          {v.chipIcon}{v.chip}
        </p>
        <h1 ref={headingRef} tabIndex={-1} className="mt-3 font-display text-h1 text-ink focus:outline-none md:text-h1-md">{v.title}</h1>
        <p className="mt-3 max-w-md text-body-lg text-ink-700">{v.body}</p>
        {app.status === "call_booked" && app.call_at && (
          <p className="mt-4 inline-flex items-center gap-2 rounded-field bg-white px-4 py-3 text-left text-body font-semibold text-ink ring-1 ring-ink-100">
            <IconCalendar size={20} className="shrink-0 text-brand-700" />
            {callTime(app.call_at, app.city)}
          </p>
        )}
      </div>

      {/* The one main next step */}
      <div className="mt-6 flex flex-col items-center gap-2">
        {app.status === "draft" && session && <Link href="/join" className="btn-primary btn-lg w-full sm:w-auto">Continue my application <IconArrowRight size={18} /></Link>}
        {app.status === "draft" && !session && <Link href="/join" className="btn-primary btn-lg w-full sm:w-auto">Continue with my email <IconArrowRight size={18} /></Link>}
        {(app.status === "withdrawn" || (app.status === "declined" && app.reapply_after && new Date(app.reapply_after) <= new Date())) && (
          <button type="button" onClick={startAgain} className="btn-primary btn-lg w-full sm:w-auto">Apply again</button>
        )}
      </div>

      {app.status === "approved" && (
        <form
          className="card mt-6 p-5 text-left sm:p-6"
          onSubmit={(e) => { e.preventDefault(); const c = normaliseCode(activation); if (c) router.push(`/invite/${encodeURIComponent(c)}`); }}
        >
          <label className="label" htmlFor="st-act">Have your activation code?</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input id="st-act" className="input font-mono uppercase tracking-wider" value={activation} onChange={(e) => setActivation(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={64} />
            <button className="btn-primary shrink-0">Activate</button>
          </div>
          <p className="helper">It&apos;s in the email “You&apos;re approved: activate your Peabudy account”. The link in that email works too.</p>
        </form>
      )}

      {v.steps && (
        <div className="card mt-6 p-5 sm:p-6">
          <h2 className="text-h3 text-ink">Where things are</h2>
          <ol className="mt-3 space-y-3 text-sm text-ink-700">
            {v.steps.map(([t, s], i) => (
              <li key={t} className="flex items-center gap-3">
                <span className={`num grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${s === "done" ? "bg-ink text-cream" : s === "now" ? "bg-pea-300 text-ink ring-2 ring-ink" : "bg-ink-50 text-ink-600"}`} aria-hidden="true">
                  {s === "done" ? <IconCheck size={14} strokeWidth={3} /> : i + 1}
                </span>
                <span className={s === "now" ? "font-semibold text-ink" : ""}>
                  {t}
                  <span className="sr-only">{s === "done" ? " (done)" : s === "now" ? " (now)" : " (to come)"}</span>
                </span>
              </li>
            ))}
          </ol>
          {app.submitted_at && <p className="mt-4 text-caption text-ink-600">Sent on {longDate(app.submitted_at)}.</p>}
        </div>
      )}

      {app.status === "call_booked" && (
        <div className="card mt-4 p-5 sm:p-6">
          <h2 className="text-h3 text-ink">How the ID call works</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-700">
            <li className="flex gap-2.5"><Dot /> About 10 minutes on video with one person from our team.</li>
            <li className="flex gap-2.5"><Dot /> Have a photo ID ready: a passport, driver&apos;s licence or national ID card. You must be 18 or over.</li>
            <li className="flex gap-2.5"><Dot /> We don&apos;t record the call or keep a copy of your ID.</li>
          </ul>
          <p className="mt-3 text-sm text-ink-700">Need a different time? Reply to the email that booked it.</p>
        </div>
      )}

      <p className="mt-6 rounded-field bg-cream px-4 py-3 text-sm text-ink-700">
        Peabudy never asks for money. Nobody from our team will ask for a fee to speed up your application.
      </p>

      {/* Manage */}
      {session ? (
        <div className="card mt-6 divide-y divide-ink-100">
          {msg && (
            <p role={msg.ok ? "status" : "alert"} className={`px-5 py-3 text-sm ${msg.ok ? "text-brand-800" : "font-medium text-danger-700"}`}>{msg.text}</p>
          )}
          {app.can_edit && (
            <Row title="Change my answers" desc={app.status === "draft" ? "Pick up where you left off." : "You can change them until the review starts."}>
              <Link href={app.status === "draft" ? "/join" : "/join?edit=1"} className="btn-secondary">Edit my answers</Link>
            </Row>
          )}
          <Row title="Download my data" desc="Everything we hold about your application, as a file.">
            <button className="btn-secondary" disabled={busy === "export"} onClick={exportData}>{busy === "export" ? "Preparing…" : "Download"}</button>
          </Row>
          {app.can_withdraw && (
            <Confirmable
              open={confirm === "withdraw"}
              title="Withdraw my application"
              desc="We stop reviewing it. Any activation code stops working."
              action="Withdraw"
              confirmText="Withdraw your application? You can apply again later with the same email."
              busy={busy === "withdraw"}
              onOpen={() => setConfirm("withdraw")}
              onCancel={() => setConfirm(null)}
              onConfirm={withdraw}
            />
          )}
          <Confirmable
            open={confirm === "delete"}
            title="Delete my application"
            desc="Withdraws it and removes your answers under our retention policy."
            action="Delete"
            confirmText="Delete your application and answers? This can't be undone here."
            danger
            busy={busy === "delete"}
            onOpen={() => setConfirm("delete")}
            onCancel={() => setConfirm(null)}
            onConfirm={del}
          />
        </div>
      ) : (
        <div className="card mt-6 p-5 sm:p-6">
          <p className="flex items-start gap-2 text-sm text-ink-700">
            <IconLock size={16} className="mt-0.5 shrink-0 text-ink-600" />
            <span>This link only shows your status. To change your answers, withdraw or delete your application, sign in with a code we email to you.</span>
          </p>
          <Link href="/join" className="btn-secondary mt-4 w-full sm:w-auto">Sign in to change your answers</Link>
        </div>
      )}
    </PublicShell>
  );
}

/* ---------------------------------- states ---------------------------------- */

type StepState = "done" | "now" | "next";

function view(app: Application, city: string): {
  chip: string; chipClass: string; chipIcon?: React.ReactNode; title: string; body: string; mood: PeaMood; steps?: [string, StepState][];
} {
  const neutral = "bg-ink-50 text-ink-700";
  const good = "bg-brand-100 text-brand-800";
  const tick = <IconCheck size={14} strokeWidth={3} />;
  const track = (now: number): [string, StepState][] =>
    ["Application sent", "We book your video ID call", "The ID call, then our decision", "You activate your account"].map((t, i) => [t, i < now ? "done" : i === now ? "now" : "next"]);

  switch (app.status) {
    case "draft":
      return { chip: "Not sent yet", chipClass: neutral, title: "Your application isn't sent yet", body: "Your answers are saved. Finish the questions and send it when you're ready. Unsent applications are deleted 30 days after your last change.", mood: "awake" };
    case "submitted":
    case "in_review":
      return { chip: "Application received", chipClass: good, chipIcon: tick, title: "We've got your application", body: "We'll email you within a day to book a 10-minute video ID call.", mood: "happy", steps: track(1) };
    case "call_booked":
      return { chip: "ID call booked", chipClass: good, chipIcon: tick, title: "Your ID call is booked", body: "We'll see your photo ID on a short video call. After that, we'll email you the outcome.", mood: "happy", steps: track(2) };
    case "approved":
      return { chip: "Approved", chipClass: good, chipIcon: tick, title: "You're approved. Check your email for your invite.", body: "It's from hello@peabudy.com, with a link to activate your account. Check your junk folder too. The link works for 14 days.", mood: "happy", steps: track(3) };
    case "waitlisted":
      return { chip: `${city} opens later`, chipClass: "bg-sky-100 text-sky-800", title: `We're holding your application until ${city} opens`, body: `We're starting in Lagos. We'll email you when ${city} opens and book your ID call then. You don't need to do anything now.`, mood: "awake" };
    case "declined":
      return {
        chip: "Not this time", chipClass: neutral, title: "We can't offer you a place right now",
        body: app.reapply_after ? `You're welcome to apply again from ${longDate(app.reapply_after)}.` : "You're welcome to apply again later.",
        mood: "sleep",
      };
    case "withdrawn":
      return { chip: "Withdrawn", chipClass: neutral, title: "You withdrew your application", body: "We've stopped reviewing it. You can apply again with the same email, and your earlier answers will be there.", mood: "sleep" };
  }
}

/* ---------------------------------- pieces ---------------------------------- */

function Spinner() {
  return (
    <div className="flex flex-col items-center pt-10 text-center" role="status">
      <Pea size={72} mood="awake" blink className="animate-bob" />
      <p className="mt-4 text-body text-ink-700">Checking your application…</p>
    </div>
  );
}

function Dot() {
  return <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-pea-500" aria-hidden="true" />;
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

/** Destructive actions confirm inline (no window.confirm), so the question is real text. */
function Confirmable({ open, title, desc, action, confirmText, danger, busy, onOpen, onCancel, onConfirm }: {
  open: boolean; title: string; desc: string; action: string; confirmText: string; danger?: boolean; busy: boolean;
  onOpen: () => void; onCancel: () => void; onConfirm: () => void;
}) {
  if (!open)
    return (
      <Row title={title} desc={desc}>
        <button className={danger ? "btn-danger" : "btn-secondary"} onClick={onOpen}>{action}</button>
      </Row>
    );
  return (
    <div className="bg-cream p-5" role="group" aria-label={title}>
      <p className="font-medium text-ink" tabIndex={-1} ref={(el) => el?.focus()}>{confirmText}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button className={danger ? "btn-danger" : "btn-primary"} onClick={onConfirm} aria-busy={busy} disabled={busy}>
          {busy ? "Working…" : `Yes, ${action.toLowerCase()}`}
        </button>
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
