"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiClientError } from "@/lib/client";

// /staff/setup?token=… (ENG-47): choose a back-office password from the emailed one-time link.
const MIN = 12;

function strength(pw: string): { label: string; tone: string } {
  let score = 0;
  if (pw.length >= MIN) score++;
  if (pw.length >= 16) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw) || /\s/.test(pw)) score++;
  if (pw.length < MIN) return { label: `Too short: at least ${MIN} characters`, tone: "text-danger-700" };
  if (score <= 2) return { label: "Fair: a longer phrase is stronger", tone: "text-caution-800" };
  return { label: "Strong", tone: "text-brand-800" };
}

function Setup() {
  const router = useRouter();
  // Read the token once, then take it out of the address bar and history (ENG-47 review).
  const fromUrl = useSearchParams().get("token") ?? "";
  const [token] = useState(fromUrl);
  useEffect(() => {
    if (fromUrl) window.history.replaceState(null, "", "/staff/setup");
  }, [fromUrl]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const s = strength(password);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < MIN) return setError(`Use at least ${MIN} characters.`);
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      await api("/staff/auth/setup", { body: { token, password } });
      setDone(true);
      setPassword("");
      setConfirm("");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="card space-y-3 p-5">
        <h1 className="text-xl font-bold text-ink">This link isn't complete</h1>
        <p className="text-sm text-ink-600">Open the link from your email again, or ask for a new one on the back-office sign-in page.</p>
        <a className="btn-secondary min-h-[48px] w-full" href="/staff/signin">Go to back-office sign-in</a>
      </div>
    );
  }
  if (done) {
    return (
      <div className="card space-y-3 p-5">
        <h1 className="text-xl font-bold text-ink">Password set</h1>
        <p role="status" className="text-sm text-ink-600">Sign in with your email and new password. We'll email you a code to finish.</p>
        <button className="btn-primary min-h-[48px] w-full" onClick={() => router.push("/staff/signin")}>Go to sign-in</button>
      </div>
    );
  }
  const input = "input min-h-[48px] text-base";
  return (
    <form onSubmit={submit} className="card space-y-4 p-5" noValidate>
      <h1 className="text-xl font-bold text-ink">Choose your back-office password</h1>
      <p className="text-sm text-ink-600">At least {MIN} characters. A few unrelated words make a strong, memorable password.</p>
      {error && <p role="alert" className="field-error">{error}</p>}
      <div>
        <label className="label" htmlFor="new-password">New password</label>
        <div className="flex gap-2">
          <input id="new-password" type={show ? "text" : "password"} autoComplete="new-password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby="pw-strength" data-clarity-mask="true" />
          <button type="button" className="btn-ghost min-h-[48px] px-3 text-sm" onClick={() => setShow(!show)} aria-pressed={show}>{show ? "Hide" : "Show"}</button>
        </div>
        {password && <p id="pw-strength" className={`mt-1 text-sm ${s.tone}`}>{s.label}</p>}
      </div>
      <div>
        <label className="label" htmlFor="confirm-password">Type it again</label>
        <input id="confirm-password" type={show ? "text" : "password"} autoComplete="new-password" className={input} value={confirm} onChange={(e) => setConfirm(e.target.value)} data-clarity-mask="true" />
      </div>
      <button type="submit" className="btn-primary min-h-[48px] w-full" disabled={busy}>Set password</button>
    </form>
  );
}

export default function StaffSetupPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-ink-100" />}>
      <Setup />
    </Suspense>
  );
}
