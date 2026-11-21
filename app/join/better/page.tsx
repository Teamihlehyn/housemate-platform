"use client";

// DES-30 (D-R5): "Better first matches". After submitting, while people wait for their ID call,
// they answer the six living habits and stay length here: optional, skippable, saved per
// screen (progressive profiling, like Bumble BFF's prompts after sign-up). Until answered,
// matching treats them conservatively (ENG-57). Needs the application session.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/brand/Logo";
import Pea from "@/components/brand/Pea";
import QuestionFlow, { FinishResult } from "@/components/apply/QuestionFlow";
import { HABIT_IDS, ScreenId, useProfileDraft } from "@/components/apply/useProfileDraft";
import { api } from "@/lib/client";

const SCREENS: ScreenId[] = [...HABIT_IDS, "stay"];

export default function BetterMatches() {
  const router = useRouter();
  const d = useProfileDraft();
  const { hydrate } = d;
  const [state, setState] = useState<"loading" | "ready" | "signedOut">("loading");
  const [start, setStart] = useState<ScreenId | undefined>(undefined);

  useEffect(() => {
    api<any>("/me")
      .then((me) => {
        if (me.sessionScope !== "application") return router.replace("/discover");
        hydrate(me);
        const done: string[] = (me.search?.preferences ?? []).filter((p: { state?: string }) => p.state !== "unanswered").map((p: { dimension: string }) => p.dimension);
        setStart(SCREENS.find((s) => (s === "stay" ? me.search?.stayMinMonths == null : !done.includes(s.slice(2)))) ?? SCREENS[0]);
        setState("ready");
      })
      .catch(() => setState("signedOut"));
  }, [hydrate, router]);

  async function finish(): Promise<FinishResult> {
    router.push("/join/status?better=1");
    return { ok: true };
  }

  return (
    <div className="min-h-[100dvh] bg-pastel">
      <header className="border-b border-ink-100/70 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 py-2">
          <Logo size="sm" />
          <Link href="/join/status" className="btn-ghost px-4">Finish later</Link>
        </div>
      </header>
      {state === "loading" && (
        <div className="flex flex-col items-center pt-10 text-center" role="status">
          <Pea size={72} mood="awake" blink className="animate-bob" />
          <p className="mt-4 text-body text-ink-700">One moment…</p>
        </div>
      )}
      {state === "signedOut" && (
        <main className="mx-auto max-w-xl px-4 pt-10 text-center">
          <h1 className="font-display text-h1 text-ink">Sign in to carry on</h1>
          <p className="mt-2 text-body text-ink-700">Enter your email on the application page and we&apos;ll send you a code.</p>
          <Link href="/join" className="btn-primary btn-lg mt-6">Continue with my email</Link>
        </main>
      )}
      {state === "ready" && (
        <>
          <p className="mx-auto max-w-xl px-4 pt-4 text-sm text-ink-700 md:px-8">
            <strong className="font-semibold text-ink">Better first matches.</strong> Optional, while you wait for your call. Your answers help us
            match you more precisely. Skip any you like.
          </p>
          <QuestionFlow
            d={d}
            mode="join"
            screens={SCREENS}
            flowLabel="Better first matches"
            skipAll
            initialScreen={start}
            finishLabel="Done"
            finishBusyLabel="Saving…"
            onFinish={finish}
            minHeightClass="min-h-[calc(100dvh-120px)]"
          />
        </>
      )}
    </div>
  );
}
