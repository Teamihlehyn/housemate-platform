"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import PublicShell, { TextLink } from "@/components/PublicShell";
import Pea from "@/components/brand/Pea";
import { api, ApiClientError } from "@/lib/client";
import { IconArrowRight, IconCheck } from "@/components/icons";

// Invite landing. Contract: GET /api/v1/invites/[code] → {valid, email_hint?}.
// Valid → warm welcome, continue to /signin?invite=CODE. Invalid/expired → kind explanation.

type State = { kind: "loading" } | { kind: "valid"; hint?: string } | { kind: "invalid" } | { kind: "error" };

export default function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = use(params);
  const code = decodeURIComponent(raw).trim();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    api<{ valid: boolean; email_hint?: string }>(`/invites/${encodeURIComponent(code)}`)
      .then((d) => live && setState(d.valid ? { kind: "valid", hint: d.email_hint } : { kind: "invalid" }))
      .catch((e) => {
        if (!live) return;
        // 404/410/422 mean the code isn't usable; anything else is a connection or server problem.
        if (e instanceof ApiClientError && [404, 410, 422].includes(e.status) && e.code !== "ERROR") setState({ kind: "invalid" });
        else setState({ kind: "error" });
      });
    return () => { live = false; };
  }, [code, attempt]);

  const signinHref = `/signin?invite=${encodeURIComponent(code)}`;

  return (
    <PublicShell aside={<Link href="/signin" className="btn-ghost px-4">Sign in</Link>}>
      {state.kind === "loading" && (
        <div className="flex flex-col items-center pt-10 text-center" role="status">
          <Pea size={72} mood="awake" blink className="animate-bob" />
          <p className="mt-4 text-body text-ink-700">Checking your invite…</p>
        </div>
      )}

      {state.kind === "valid" && (
        <div className="flex flex-col items-center pt-4 text-center">
          <div className="relative flex items-end" aria-hidden="true">
            <Pea size={88} mood="happy" className="animate-pop-in" />
            <Pea size={72} mood="wink" tone="fresh" className="-ml-4 animate-pop-in [animation-delay:120ms]" />
          </div>
          <p className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-sm font-semibold text-brand-800">
            <IconCheck size={14} strokeWidth={3} /> Invite found
          </p>
          <h1 className="mt-3 font-display text-display text-ink md:text-display-md">You&apos;re invited to Peabudy</h1>
          <p className="mt-3 max-w-md text-body-lg text-ink-700">
            Find someone whose plans fit yours, then agree rent, bills and notice in writing before anyone moves in.
          </p>
          {state.hint && (
            <p className="mt-3 text-sm text-ink-700">
              This invite is for <span className="font-semibold text-ink" data-clarity-mask="true">{state.hint}</span>. Sign in with that address.
            </p>
          )}

          <Link href={signinHref} className="btn-primary btn-lg mt-7 w-full sm:w-auto">
            Continue to sign in <IconArrowRight size={18} />
          </Link>

          <div className="card mt-8 w-full p-5 text-left sm:p-6">
            <h2 className="text-h3 text-ink">What to expect</h2>
            <ul className="mt-3 space-y-2.5 text-sm text-ink-700">
              <li className="flex gap-2.5"><Dot /> We email you a 6-digit code from hello@peabudy.com. Check junk if it&apos;s slow.</li>
              <li className="flex gap-2.5"><Dot /> You answer a few questions about your plans and living habits. It takes a few minutes.</li>
              <li className="flex gap-2.5"><Dot /> Our team checks your ID on a short video call before you can see anyone, and before anyone can see you.</li>
            </ul>
            <p className="mt-4 rounded-field bg-cream px-3 py-2.5 text-sm text-ink-700">Checks completed — not a guarantee of safety.</p>
          </div>
        </div>
      )}

      {state.kind === "invalid" && (
        <div className="flex flex-col items-center pt-4 text-center">
          <Pea size={80} mood="sleep" dim />
          <h1 className="mt-5 font-display text-h1 text-ink md:text-h1-md" tabIndex={-1} ref={(el) => el?.focus()}>
            This invite link doesn&apos;t work any more
          </h1>
          <p className="mt-3 max-w-md text-body text-ink-700">
            It may have expired, been used already, or been copied with a character missing. That happens.
          </p>
          <div className="mt-7 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href="/request-access" className="btn-primary btn-lg">Request a new invite</Link>
            <Link href="/signin" className="btn-secondary btn-lg">I&apos;m already a member</Link>
          </div>
          <p className="mt-6 max-w-md text-sm text-ink-600">
            If a friend sent you this link, you can also ask them to check it.
          </p>
        </div>
      )}

      {state.kind === "error" && (
        <div className="flex flex-col items-center pt-4 text-center" role="alert">
          <Pea size={72} mood="wow" />
          <h1 className="mt-5 font-display text-h1 text-ink">We couldn&apos;t check your invite</h1>
          <p className="mt-3 max-w-md text-body text-ink-700">Check your connection and try again. Your link is fine to reuse.</p>
          <div className="mt-6 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <button type="button" className="btn-primary btn-lg" onClick={() => { setState({ kind: "loading" }); setAttempt((n) => n + 1); }}>Try again</button>
            <Link href={signinHref} className="btn-secondary btn-lg">Go to sign in</Link>
          </div>
          <p className="mt-4 text-sm text-ink-600">No invite? <TextLink href="/request-access">Request one</TextLink></p>
        </div>
      )}
    </PublicShell>
  );
}

function Dot() {
  return <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-pea-500" aria-hidden="true" />;
}
