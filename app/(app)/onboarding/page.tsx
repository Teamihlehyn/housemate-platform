"use client";

// In-app onboarding (demo modes). The questions live in components/apply and are shared with
// /join (the beta application) and the /profile editors. Users with a published profile go
// to /profile (approval-first contract §4); applicants never get here (the layout sends them
// to /join). Same data contract: PATCH /me/profile and /me/search per screen, then publish.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client";
import { QUESTIONNAIRE } from "@/lib/constants";
import Pea from "@/components/brand/Pea";
import { IconArrowRight, IconCheck } from "@/components/icons";
import QuestionFlow, { FinishResult } from "@/components/apply/QuestionFlow";
import { HABIT_ASK } from "@/components/apply/fields";
import { screenForMissing, useProfileDraft } from "@/components/apply/useProfileDraft";

const IS_BETA = process.env.NEXT_PUBLIC_APP_ENV === "beta";
const IS_RESEARCH = process.env.NEXT_PUBLIC_APP_ENV === "research";

interface Candidate {
  userId: string;
  displayName: string;
  avatarInitials: string | null;
  cityId: string;
  areas: string[];
  reasons: string[];
}

export default function Onboarding() {
  const router = useRouter();
  const d = useProfileDraft();
  const { hydrate } = d;
  const [ready, setReady] = useState(false);
  const [published, setPublished] = useState<{ score: number; pending: boolean } | null>(null);
  const [matches, setMatches] = useState<Candidate[] | null>(null);
  // DES-13: optional, unticked survey opt-in, saved with publish (PATCH /me/preferences).
  const [surveyOptIn, setSurveyOptIn] = useState(false);
  const [surveySaved, setSurveySaved] = useState(false);
  const [surveyFailed, setSurveyFailed] = useState(false);

  useEffect(() => {
    api<any>("/me").then((me) => {
      if (me.profile?.publicationStatus === "published" && (me.accountStatus ?? "active") === "active") {
        router.replace("/profile");
        return;
      }
      hydrate(me);
      if ((me.preferences?.survey_opt_in ?? me.survey_opt_in) === true) { setSurveyOptIn(true); setSurveySaved(true); }
      setReady(true);
    }).catch(() => setReady(true));
  }, [router, hydrate]);

  async function publish(): Promise<FinishResult> {
    if (surveyOptIn !== surveySaved) {
      // Never block publishing on this optional choice; say so on the next screen if it failed.
      try {
        await api("/me/preferences", { method: "PATCH", body: { survey_opt_in: surveyOptIn, source: "onboarding" } });
        setSurveySaved(surveyOptIn);
        setSurveyFailed(false);
      } catch {
        setSurveyFailed(true);
      }
    }
    try {
      const data = await api<{ credibility: { score: number }; pendingIdentity?: boolean }>("/me/search/publish", { body: {} });
      setPublished({ score: data.credibility.score, pending: !!data.pendingIdentity });
      if (!data.pendingIdentity) {
        api<{ candidates: Candidate[] }>("/recommendations")
          .then((r) => setMatches(r.candidates))
          .catch(() => setMatches([]));
      }
      return { ok: true };
    } catch (e) {
      if (e instanceof ApiClientError) return { ok: false, message: e.message, screen: screenForMissing(e.fieldErrors, e.message) };
      return { ok: false, message: "We couldn't publish your profile. Check your connection and try again." };
    }
  }

  if (published) {
    return <Done name={d.displayName.trim().split(/\s+/)[0] || ""} published={published} matches={matches} surveyFailed={surveyFailed} />;
  }

  return (
    <div data-no-bottom-nav className="-mx-4 -my-6 min-h-[calc(100dvh-92px)] bg-pastel md:mx-auto md:my-0 md:max-w-xl md:rounded-sheet md:min-h-0">
      {!ready ? (
        <div className="mx-auto max-w-xl space-y-4 px-4 pt-10" aria-busy="true" aria-label="Loading your answers">
          <div className="skeleton h-10" />
          <div className="skeleton h-40" />
        </div>
      ) : (
        <QuestionFlow
          d={d}
          mode="onboarding"
          finishLabel="Publish my profile"
          finishBusyLabel="Publishing…"
          onFinish={publish}
          reviewNote={
            <p className="mt-4 text-sm text-ink-700">
              {IS_BETA
                ? "When you publish, our team checks your identity before other people can see you."
                : "Publishing runs a demo identity check, so your checks show as “Demo verified”. Your profile becomes visible to people who match."}
            </p>
          }
          reviewExtras={
            <label className="mt-5 flex min-h-[44px] cursor-pointer items-start gap-3 rounded-field border border-ink-100 bg-white p-3.5 text-sm">
              <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-ink" checked={surveyOptIn} onChange={(e) => setSurveyOptIn(e.target.checked)} />
              <span className="text-ink-700">
                Email me a short survey about my experience. Optional. About 4 minutes, sent once with at most one reminder. Stop any time in Settings or from the email.
              </span>
            </label>
          }
        />
      )}
    </div>
  );
}

function Done({ name, published, matches, surveyFailed }: { name: string; published: { score: number; pending: boolean }; matches: Candidate[] | null; surveyFailed?: boolean }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);

  return (
    <div data-no-bottom-nav className="-mx-4 -my-6 min-h-[calc(100dvh-92px)] bg-pastel px-4 pb-24 pt-8 md:mx-auto md:my-0 md:max-w-xl md:rounded-sheet md:px-8 md:pb-10">
      <div className="flex justify-center gap-0.5" aria-hidden="true">
        {QUESTIONNAIRE.map((q, i) => (
          <span key={q.id} className="animate-pop-in" style={{ animationDelay: `${i * 70}ms` }}>
            <Pea size={44} tone={HABIT_ASK[q.id].tone} mood={i % 2 ? "happy" : "wow"} className="animate-bob" />
          </span>
        ))}
      </div>

      {surveyFailed && (
        <p role="status" className="mx-auto mt-4 max-w-md rounded-field border border-caution-200 bg-caution-50 px-3 py-2 text-center text-sm text-caution-800">
          We couldn&apos;t save your survey email choice. You can set it in <Link href="/settings" className="font-semibold underline underline-offset-2">Settings</Link>.
        </p>
      )}
      {published.pending ? (
        <div className="mt-6 text-center">
          <h1 ref={headingRef} tabIndex={-1} className="font-display text-display text-ink focus:outline-none">Profile submitted</h1>
          <p className="mx-auto mt-3 max-w-md text-ink-700">
            Our team will check your identity with a short call before you appear to other people. We&apos;ll email you to arrange it. You can look around in the meantime.
          </p>
          <Link href="/discover" className="btn-primary btn-lg mt-6 w-full sm:w-auto">Look around <IconArrowRight size={18} /></Link>
        </div>
      ) : (
        <>
          <div className="mt-6 text-center">
            <h1 ref={headingRef} tabIndex={-1} className="font-display text-display text-ink focus:outline-none">
              Your profile is ready{name ? `, ${name}` : ""}
            </h1>
            <p className="mx-auto mt-3 max-w-md text-ink-700">
              You&apos;re visible to people whose plans fit yours. Demo checks: <strong className="num">{published.score}/100</strong>.
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-ink-600">Checks completed — not a guarantee of safety.</p>
          </div>

          <section aria-labelledby="first-matches" className="mt-8">
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="first-matches" className="text-h2 text-ink">Your first matches</h2>
              {matches && matches.length > 0 && (
                <span className="num text-sm font-medium text-ink-700">{matches.length} {matches.length === 1 ? "person fits" : "people fit"} right now</span>
              )}
            </div>
            {IS_RESEARCH && matches && matches.length > 0 && (
              <p className="mt-1 text-sm text-ink-600">Everyone here is a sample housemate created for your test. They reply automatically.</p>
            )}

            {matches === null ? (
              <div className="mt-4 space-y-3" aria-busy="true" aria-label="Loading your matches">
                {[0, 1, 2].map((i) => <div key={i} className="skeleton h-24" />)}
              </div>
            ) : matches.length === 0 ? (
              <div className="mt-4 rounded-card bg-white p-5 text-center ring-1 ring-ink-100">
                <p className="font-semibold text-ink">No one fits all your must-haves yet</p>
                <p className="mt-1 text-sm text-ink-700">Discover shows which of your filters are the narrowest, so you can widen one.</p>
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {matches.slice(0, 3).map((m, i) => (
                  <li key={m.userId} className="animate-rise-in" style={{ animationDelay: `${200 + i * 120}ms` }}>
                    <Link href={`/members/${m.userId}`} className="flex items-center gap-3 rounded-card bg-white p-4 ring-1 ring-ink-100 transition duration-quick hover:ring-ink-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full font-bold ${["bg-lilac-100 text-lilac-800", "bg-sky-100 text-sky-800", "bg-apricot-100 text-apricot-800"][i % 3]}`}>
                        {m.avatarInitials}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-ink">{m.displayName}</span>
                          {IS_RESEARCH && <span className="chip-sample">Sample</span>}
                        </span>
                        <span className="mt-0.5 flex items-start gap-1.5 text-sm text-ink-700">
                          <span className="mt-0.5 text-brand-600"><IconCheck size={14} strokeWidth={2.5} /></span>
                          <span className="line-clamp-2">{m.reasons[0] ?? "Your plans fit"}</span>
                        </span>
                      </span>
                      <IconArrowRight size={18} className="shrink-0 text-ink-600" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/discover" className="btn-primary btn-lg mt-6 w-full">
              {matches && matches.length > 0 ? "See all my matches" : "Go to Discover"} <IconArrowRight size={18} />
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
