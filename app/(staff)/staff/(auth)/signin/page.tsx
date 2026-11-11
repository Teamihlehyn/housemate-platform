"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client";

// /staff/signin (ENG-47): email + password, then the 6-digit code from email.
// "Set up your password" and "Forgot password?" both ask for a one-time link.
type Step = "password" | "code" | "link" | "link_sent";

export default function StaffSignIn() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const submitPassword = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return setError("Enter your email and password.");
    run(async () => {
      const r = await api<{ message: string }>("/staff/auth/password", { body: { email, password } });
      setNote(r.message);
      setPassword("");
      setStep("code");
    });
  };
  const submitCode = (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) return setError("Enter the 6-digit code from your email.");
    run(async () => {
      const r = await api<{ redirect: string }>("/staff/auth/verify", { body: { email, code: code.trim() } });
      router.push(r.redirect || "/staff");
      router.refresh();
    });
  };
  const submitLink = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return setError("Enter your work email address.");
    run(async () => {
      const r = await api<{ message: string }>("/staff/auth/setup-request", { body: { email } });
      setNote(r.message);
      setStep("link_sent");
    });
  };

  const input = "input min-h-[48px] text-base";
  return (
    <div className="card space-y-5 p-5">
      <h1 className="text-xl font-bold text-ink">
        {step === "code" ? "Enter your code" : step === "link" || step === "link_sent" ? "Set or reset your password" : "Back-office sign-in"}
      </h1>
      {error && <p role="alert" className="field-error">{error}</p>}

      {step === "password" && (
        <form onSubmit={submitPassword} className="space-y-4" noValidate>
          <div>
            <label className="label" htmlFor="email">Work email</label>
            <input id="email" type="email" autoComplete="username" className={input} value={email} onChange={(e) => setEmail(e.target.value)} data-clarity-mask="true" />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <div className="flex gap-2">
              <input id="password" type={show ? "text" : "password"} autoComplete="current-password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} data-clarity-mask="true" />
              <button type="button" className="btn-ghost min-h-[48px] px-3 text-sm" onClick={() => setShow(!show)} aria-pressed={show}>{show ? "Hide" : "Show"}</button>
            </div>
          </div>
          <button type="submit" className="btn-primary min-h-[48px] w-full" disabled={busy}>Continue</button>
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <button type="button" className="btn-ghost min-h-[44px] px-2" onClick={() => { setError(null); setStep("link"); }}>Set up your password</button>
            <button type="button" className="btn-ghost min-h-[44px] px-2" onClick={() => { setError(null); setStep("link"); }}>Forgot password?</button>
          </div>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={submitCode} className="space-y-4" noValidate>
          {note && <p role="status" className="text-sm text-ink-600">{note}</p>}
          <div>
            <label className="label" htmlFor="code">6-digit code</label>
            <input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className={`${input} tracking-[0.3em]`} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} data-clarity-mask="true" />
          </div>
          <button type="submit" className="btn-primary min-h-[48px] w-full" disabled={busy}>Sign in</button>
          <button type="button" className="btn-ghost min-h-[44px] w-full text-sm" onClick={() => { setCode(""); setError(null); setStep("password"); }}>Start again</button>
        </form>
      )}

      {step === "link" && (
        <form onSubmit={submitLink} className="space-y-4" noValidate>
          <p className="text-sm text-ink-600">We'll email a link that lets you choose a new password. It works once, for 30 minutes.</p>
          <div>
            <label className="label" htmlFor="link-email">Work email</label>
            <input id="link-email" type="email" autoComplete="username" className={input} value={email} onChange={(e) => setEmail(e.target.value)} data-clarity-mask="true" />
          </div>
          <button type="submit" className="btn-primary min-h-[48px] w-full" disabled={busy}>Email me a link</button>
          <button type="button" className="btn-ghost min-h-[44px] w-full text-sm" onClick={() => { setError(null); setStep("password"); }}>Back to sign-in</button>
        </form>
      )}

      {step === "link_sent" && (
        <div className="space-y-4">
          <p role="status" className="text-sm text-ink-700">{note}</p>
          <button type="button" className="btn-secondary min-h-[48px] w-full" onClick={() => setStep("password")}>Back to sign-in</button>
        </div>
      )}
    </div>
  );
}
