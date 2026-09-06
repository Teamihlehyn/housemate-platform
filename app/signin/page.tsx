"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/client";

const PERSONAS = [
  { email: "amara@demo.housemate.test", name: "Amara (London, find together)" },
  { email: "ben@demo.housemate.test", name: "Ben (London, find together)" },
  { email: "chidi@demo.housemate.test", name: "Chidi (Lagos, has a place)" },
  { email: "damola@demo.housemate.test", name: "Damola (Lagos, find together)" },
  { email: "femi@demo.housemate.test", name: "Femi (Lagos, room to offer)" },
  { email: "grace@demo.housemate.test", name: "Grace (Lagos, find together)" },
];

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sinkCode, setSinkCode] = useState<string | null>(null);
  const [stage, setStage] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestCode(targetEmail: string) {
    setError(null);
    setBusy(true);
    try {
      const data = await api<{ sink_code?: string }>("/auth/request-code", {
        body: { email: targetEmail },
      });
      setEmail(targetEmail);
      setStage("code");
      if (data.sink_code) {
        setSinkCode(data.sink_code);
        setCode(data.sink_code);
      }
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not send a code.");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setError(null);
    setBusy(true);
    try {
      const data = await api<{ is_new: boolean }>("/auth/verify-code", { body: { email, code } });
      router.push(data.is_new ? "/onboarding" : "/discover");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not verify.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <Link href="/" className="font-bold text-brand-700">← Housemate</Link>
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-8 px-4 py-12 md:grid-cols-2">
        <div className="card p-8">
          <h1 className="text-2xl font-bold text-stone-900">Sign in or create an account</h1>
          <p className="mt-2 text-sm text-stone-600">
            We&apos;ll email you a 6-digit code. In this prototype the code appears in the demo sink
            below — no real inbox needed.
          </p>

          {stage === "email" ? (
            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (email) requestCode(email);
              }}
            >
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
                />
              </div>
              {error && <p className="field-error" role="alert">{error}</p>}
              <button className="btn-primary w-full" disabled={busy || !email}>
                {busy ? "Sending…" : "Send code"}
              </button>
            </form>
          ) : (
            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                verify();
              }}
            >
              <p className="text-sm text-stone-600">
                Code sent to <span className="font-medium text-stone-900">{email}</span>.
              </p>
              {sinkCode && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <span className="font-medium">Demo sink:</span> your code is{" "}
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
                />
              </div>
              {error && <p className="field-error" role="alert">{error}</p>}
              <button className="btn-primary w-full" disabled={busy || code.length < 6}>
                {busy ? "Verifying…" : "Verify and continue"}
              </button>
              <button
                type="button"
                className="btn-ghost w-full"
                onClick={() => {
                  setStage("email");
                  setCode("");
                  setSinkCode(null);
                }}
              >
                Use a different email
              </button>
            </form>
          )}
        </div>

        <div className="card p-8">
          <h2 className="font-semibold text-stone-900">Jump in with a seeded persona</h2>
          <p className="mt-2 text-sm text-stone-600">
            These accounts are already published with matches ready. One click sends their code so you
            can explore the full journey.
          </p>
          <div className="mt-4 space-y-2">
            {PERSONAS.map((p) => (
              <button
                key={p.email}
                className="btn-secondary w-full justify-start text-left"
                disabled={busy}
                onClick={() => requestCode(p.email)}
              >
                <span className="font-medium">{p.name}</span>
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs text-stone-500">
            Tip: sign in as <strong>Amara</strong> and <strong>Ben</strong> in two browser windows to
            play both sides of a London household.
          </p>
        </div>
      </main>
    </div>
  );
}
