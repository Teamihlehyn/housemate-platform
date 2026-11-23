"use client";

// DES-30 (D-R5): "Better first matches". After submitting, while people wait for their ID call,
// they answer the six living habits and stay length here: optional, skippable, saved per
// screen (progressive profiling, like Bumble BFF's prompts after sign-up). Until answered,
// matching treats them conservatively (ENG-57). Needs the application session.

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { trackFunnel } from "@/lib/funnel";
import Logo from "@/components/brand/Logo";
import Pea from "@/components/brand/Pea";
import QuestionFlow, { FinishResult } from "@/components/apply/QuestionFlow";
import { HABIT_IDS, ScreenId, useProfileDraft } from "@/components/apply/useProfileDraft";
import { api } from "@/lib/client";

const DEFAULT_RUN: ScreenId[] = [...HABIT_IDS, "stay"];

/** DES-38: a checklist item opens a focused run: just the bio, just journey or stay, or the habits. */
function runFor(screen: string | null): { screens: ScreenId[]; key: string; label: string } {
  if (screen === "bio") return { screens: ["bio"], key: "bio", label: "Your bio" };
  if (screen === "journey") return { screens: ["journey"], key: "journey", label: "What you're looking for" };
  if (screen === "stay") return { screens: ["stay"], key: "stay", label: "How long you'll stay" };
  if (screen?.startsWith("h:")) return { screens: [...HABIT_IDS], key: "habits", label: "Living habits" };
  return { screens: DEFAULT_RUN, key: "habits", label: "Better first matches" };
}

export default function BetterMatchesPage() {
  return <Suspense fallback={null}><BetterMatches /></Suspense>;
}

function BetterMatches() {
  const router = useRouter();
  const params = useSearchParams();
  const run = runFor(params.get("screen"));
  const SCREENS = run.screens;
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
        const asked = params.get("screen") as ScreenId | null;
        setStart(asked && SCREENS.includes(asked) ? asked : SCREENS.find((s) => (s === "stay" ? me.search?.stayMinMonths == null : s.startsWith("h:") ? !done.includes(s.slice(2)) : true)) ?? SCREENS[0]);
        setState("ready");
      })
      .catch(() => setState("signedOut"));
  }, [hydrate, router]); // eslint-disable-line react-hooks/exhaustive-deps

  async function finish(): Promise<FinishResult> {
    trackFunnel("profile.item_completed", { step: run.key });
    router.push("/join/status#strength");
    return { ok: true };
  }

  return (
    <div className="min-h-[100dvh] bg-pastel">
      <header className="border-b border-ink-100/70 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 py-2">
          <Logo size="sm" />
          <Link href="/join/status#strength" className="btn-ghost px-4">Back to my status</Link>
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
            <strong className="font-semibold text-ink">{run.label}.</strong> Optional, while you wait for your call. Skip anything you like;
            you can come back to it any time.
          </p>
          <QuestionFlow
            d={d}
            mode="join"
            screens={SCREENS}
            flowLabel={run.label}
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
