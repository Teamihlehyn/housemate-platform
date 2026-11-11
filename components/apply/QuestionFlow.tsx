"use client";

// The conversational profile flow: one question per screen, asked by Pea, with a section
// progress bar and a visible autosave state. Shared by /join (the application) and the
// in-app /onboarding (demo modes). Each Continue saves that screen, so a dropped connection
// or a closed tab never loses more than the question in front of you.

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Pea, { PeaMood } from "@/components/brand/Pea";
import { IconArrowRight, IconBack } from "@/components/icons";
import { CITIES, GENDERS, GENDER_IDS, JOURNEYS, OWN_GENDER_OPTIONS, QUESTIONNAIRE, CityId, answerLabel } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { formatDateRange } from "@/lib/dates";
import StepBody from "./StepBody";
import { HabitPod, SaveStatus } from "./fields";
import { Draft, HABIT_IDS, SCREENS, SECTIONS, ScreenId } from "./useProfileDraft";

export type FinishResult = { ok: true } | { ok: false; screen?: ScreenId; message?: string };

export default function QuestionFlow({
  d,
  mode,
  initialScreen,
  finishLabel,
  finishBusyLabel,
  onFinish,
  reviewNote,
  reviewExtras,
  cityBadges,
  cityNote,
  minHeightClass = "min-h-[calc(100dvh-92px)]",
  editing = false,
}: {
  d: Draft;
  mode: "join" | "onboarding";
  initialScreen?: ScreenId;
  finishLabel: string;
  finishBusyLabel: string;
  onFinish: () => Promise<FinishResult>;
  reviewNote?: React.ReactNode;
  reviewExtras?: React.ReactNode;
  cityBadges?: Partial<Record<CityId, string>>;
  cityNote?: (city: CityId | "") => React.ReactNode;
  minHeightClass?: string;
  /** Changing an application that's already sent (it stays in the queue). */
  editing?: boolean;
}) {
  const [idx, setIdx] = useState(() => Math.max(0, initialScreen ? SCREENS.indexOf(initialScreen) : 0));
  const [busy, setBusy] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const screen = SCREENS[idx];
  const cityCfg = d.city ? CITIES[d.city] : null;
  const firstName = d.displayName.trim().split(/\s+/)[0] || "";
  const section = SECTIONS.findIndex((sec) => sec.screens.includes(screen));
  const habitIdx = HABIT_IDS.indexOf(screen);
  const join = mode === "join";

  // A late resume (GET /me arrives after first paint) can move us to where they left off.
  useEffect(() => {
    if (initialScreen) setIdx(Math.max(0, SCREENS.indexOf(initialScreen)));
  }, [initialScreen]);

  // Move focus to the new question so screen readers announce it.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    headingRef.current?.focus();
    window.scrollTo({ top: 0 });
  }, [idx]);

  // Leaving the tab (phone locked, app switched): quietly save what's on screen if it's valid.
  const latest = useRef({ screen, d });
  latest.current = { screen, d };
  useEffect(() => {
    function onHide() {
      if (document.visibilityState !== "hidden") return;
      const { screen: s, d: dd } = latest.current;
      if (s !== "review" && Object.keys(dd.validate(s)).length === 0) void dd.save([s], { quiet: true });
    }
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  function go(target: ScreenId | undefined) {
    if (target && SCREENS.includes(target)) setIdx(SCREENS.indexOf(target));
  }

  async function next(e?: FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setTopError(null);
    setBusy(true);
    try {
      if (screen === "review") {
        const r = await onFinish();
        if (!r.ok) {
          if (r.message) setTopError(r.message);
          go(r.screen);
        }
        return;
      }
      const r = await d.save([screen]);
      if (r.ok) setIdx((i) => Math.min(SCREENS.length - 1, i + 1));
      else {
        if (r.message) setTopError(r.message);
        if (r.screen && r.screen !== screen) go(r.screen);
      }
    } finally {
      setBusy(false);
    }
  }

  function back() {
    d.setErrors({});
    setTopError(null);
    // Keep a changed answer even when going back, if it's complete.
    if (screen !== "review" && Object.keys(d.validate(screen)).length === 0) void d.save([screen], { quiet: true });
    setIdx((i) => Math.max(0, i - 1));
  }

  const canSkip =
    (screen === "location" && !d.locationDetail.trim()) ||
    (screen === "genderPref" && d.genderAccepts.length === GENDER_IDS.length);

  /* ------------------------------ what Pea says ----------------------------- */
  const talk = useMemo((): { line: string; mood: PeaMood } => {
    const hi = firstName ? `, ${firstName}` : "";
    switch (screen) {
      case "name":
        return join
          ? { line: `Hi, I'm Pea. Let's put your application together: ${SCREENS.length - 1} short questions, and every answer saves as you go.`, mood: "awake" }
          : { line: "Hi, I'm Pea. I'll help you find someone whose plans fit yours.", mood: "awake" };
      case "journey": return { line: `Lovely to meet you${hi}. Let's start with the big picture.`, mood: "happy" };
      case "city": return { line: "Where are you planning to live?", mood: "awake" };
      case "areas": return { line: `${cityCfg ? cityCfg.label.replace(/ pilot$/, "") : "Nice"}. Let's narrow it down.`, mood: "happy" };
      case "location": return { line: "Got a street or postcode in mind? Totally optional.", mood: "awake" };
      case "budget": return { line: "Now the money bit. No judgement, just numbers.", mood: "awake" };
      case "dates": return { line: "Timing matters most. We only match people whose dates overlap.", mood: "awake" };
      case "stay": return { line: "Roughly is fine. You can change it later.", mood: "happy" };
      case "gender": return { line: "A couple of private questions. Only the matching uses these.", mood: "awake" };
      case "genderPref": return { line: "This works both ways, and nobody sees why someone isn't shown.", mood: "awake" };
      case "bio": return { line: `Last one${hi}. A few lines help people say hello.`, mood: "happy" };
      case "review":
        return editing
          ? { line: "Change anything you like. Each answer saves as you go.", mood: "happy" }
          : join
          ? { line: "That's everything. Check it over, then send it to our team.", mood: "happy" }
          : { line: "Looking good. Here's what people will match you on.", mood: "happy" };
      default:
        return {
          line: habitIdx === 0
            ? "Six quick questions about living together. Each answer wakes up a pea."
            : `${d.answered.length} of 6 peas awake. Keep going.`,
          mood: habitIdx % 2 ? "wow" : "awake",
        };
    }
  }, [screen, firstName, cityCfg, habitIdx, d.answered.length, join, editing]);

  const ctaLabel = screen === "review" ? (busy ? finishBusyLabel : finishLabel) : busy ? "Saving…" : "Continue";

  // Review rows: label, value, the screen that edits it.
  const money = (v: string) => (cityCfg && v ? formatMoney(Math.round(parseFloat(v) * 100), cityCfg.currency) : "");
  const habitsLine = QUESTIONNAIRE.filter((q) => d.answered.includes(q.id)).map((q) => answerLabel(q.id, d.prefs[q.id].own)).join(" · ");
  const rows: [string, string, ScreenId, boolean?][] = [
    ["Name", d.displayName, "name"],
    ["Looking to", JOURNEYS.find((j) => j.id === d.journey)?.label ?? "", "journey"],
    ["Areas", d.city ? `${d.city === "london" ? "London" : "Lagos"} · ${d.areas.map((a) => cityCfg?.areas.find((x) => x.id === a)?.label).join(", ")}` : "", "areas"],
    ["Budget", d.rentMin && d.rentMax ? `${money(d.rentMin)}–${money(d.rentMax)} per ${d.period}` : "", "budget"],
    ["Move-in", d.earliest ? formatDateRange(d.earliest, d.moveMode === "range" && d.latest ? d.latest : d.earliest) : "", "dates"],
    ["Stay", d.stayMin && d.stayMax ? `${d.stayMin}–${d.stayMax} months` : "", "stay"],
    ["Living habits", d.answered.length === 6 ? habitsLine : `${d.answered.length} of 6 answered`, "h:cleaning"],
    ["About you", d.bio.trim() ? d.bio.trim() : "", "bio"],
    ["Your gender (private)", OWN_GENDER_OPTIONS.find((o) => o.id === d.gender)?.label ?? "", "gender", true],
    ["Open to living with (private)", d.genderAccepts.length === GENDER_IDS.length ? "Anyone" : GENDERS.filter((g) => d.genderAccepts.includes(g.id)).map((g) => g.plural).join(", "), "genderPref", true],
  ];

  return (
    <form onSubmit={next} noValidate className={`mx-auto flex max-w-xl flex-col px-4 pt-3 md:min-h-[640px] md:px-8 md:pt-6 ${minHeightClass}`}>
      {/* Top row: Back · progress · Skip */}
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={back} disabled={idx === 0 || busy} className="btn-ghost -ml-2 px-3 disabled:invisible">
          <IconBack size={20} /> Back
        </button>
        <p className="num text-center text-caption text-ink-600" aria-live="polite">
          {SECTIONS[section]?.label} · {idx + 1} of {SCREENS.length}
        </p>
        <button type="button" onClick={() => next()} className={`btn-ghost -mr-2 px-3 ${canSkip ? "" : "invisible"}`} tabIndex={canSkip ? 0 : -1} aria-hidden={!canSkip}>
          Skip
        </button>
      </div>
      <div className="mt-1 grid grid-cols-5 gap-1.5" aria-hidden="true">
        {SECTIONS.map((sec, i) => (
          <span key={sec.label} className={`h-1.5 rounded-full ${i < section ? "bg-ink" : i === section ? "bg-pea-500" : "bg-ink-100"}`} />
        ))}
      </div>
      <div className="mt-1.5 flex justify-end">
        <SaveStatus state={d.saveState} />
      </div>

      <div key={screen} className="flex-1 animate-rise-in pb-6">
        {/* Pea asks */}
        <div className="mt-3 flex items-start gap-2.5">
          <Pea size={52} mood={talk.mood} blink className="shrink-0" />
          <p className="mt-1 min-w-0 rounded-panel rounded-tl-md bg-white px-4 py-2.5 text-sm font-medium text-ink shadow-e1 ring-1 ring-ink-100">
            {talk.line}
          </p>
        </div>

        {habitIdx >= 0 && <HabitPod answered={d.answered} current={QUESTIONNAIRE[habitIdx].id} />}

        {topError && (
          <div className="mt-5 rounded-field border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700" role="alert">
            {topError}
          </div>
        )}

        <div className="mt-6">
          {screen !== "review" ? (
            <>
              <StepBody screen={screen} d={d} headingRef={headingRef} cityBadges={cityBadges} idCheck={join} />
              {screen === "city" && cityNote?.(d.city)}
            </>
          ) : (
            <>
              <h1 ref={headingRef} tabIndex={-1} className="font-display text-display text-ink focus:outline-none md:text-[2.25rem] md:leading-[2.5rem]">
                {editing ? "Your application" : join ? "Check your application" : "Ready to go live?"}
              </h1>
              <dl className="mt-4 divide-y divide-ink-100 rounded-card bg-white px-4 ring-1 ring-ink-100">
                {rows.filter((r) => join || !r[3]).map(([k, val, target]) => (
                  <div key={k} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <dt className="text-caption text-ink-600">{k}</dt>
                      <dd className={`text-sm font-medium ${val ? "text-ink" : "text-danger-700"} ${target === "bio" ? "line-clamp-2" : "truncate"}`} data-clarity-mask={target === "bio" || target === "name" ? "true" : undefined}>
                        {val || "Not answered yet"}
                      </dd>
                    </div>
                    <button type="button" onClick={() => go(target)} className="btn-ghost shrink-0 px-3 text-sm">
                      Edit<span className="sr-only"> {k}</span>
                    </button>
                  </div>
                ))}
              </dl>
              {reviewNote}
              {reviewExtras}
            </>
          )}
        </div>
      </div>

      {/* Sticky Continue */}
      <div className="sticky bottom-0 -mx-4 mt-auto bg-gradient-to-t from-paper via-paper/95 to-paper/0 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4 md:static md:mx-0 md:bg-none md:px-0 md:pb-8">
        <button type="submit" className="btn-primary btn-lg w-full" aria-busy={busy}>
          {ctaLabel} {!busy && <IconArrowRight size={18} />}
        </button>
      </div>
    </form>
  );
}
