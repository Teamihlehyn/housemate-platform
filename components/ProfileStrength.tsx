"use client";

// DES-38: "Make your profile stronger". Joining asks only the essentials; this is the friendly
// list of what's left (GET /me/profile-strength, ENG-68), shown on the status page while
// applicants wait, on Profile, and as a dismissible card on Discover. Benchmarks: LinkedIn's
// profile-strength meter, Airbnb's host-profile checklist, Hinge prompts. Never a guilt trip:
// a count, a one-line why, and a link to a focused editor that comes back here after saving.

import { useEffect, useState } from "react";
import Link from "next/link";
import Pea from "@/components/brand/Pea";
import { api } from "@/lib/client";
import { trackFunnel } from "@/lib/funnel";
import { IconArrowRight, IconCheck, IconX } from "@/components/icons";

export interface StrengthItem {
  key: string;
  label: string;
  done: boolean;
  progress: { done: number; total: number } | null;
  href: string;
  why: string;
}
export interface Strength {
  items: StrengthItem[];
  done: number;
  total: number;
}

const DISMISS_KEY = "pb_strength_dismissed";
const DISMISS_DAYS = 7;

export default function ProfileStrength({
  initial,
  from,
  dismissible = false,
  headingLevel = 2,
  className = "",
}: {
  /** Already loaded (e.g. with the application status); otherwise fetched. */
  initial?: Strength | null;
  /** Where the editors should come back to after saving. */
  from: "status" | "discover" | "profile";
  /** Discover: can be hidden for a week, then it comes back if anything's left. */
  dismissible?: boolean;
  headingLevel?: 2 | 3;
  className?: string;
}) {
  const [s, setS] = useState<Strength | null>(initial ?? null);
  const [hidden, setHidden] = useState(dismissible); // assume hidden until we've checked storage

  useEffect(() => {
    if (initial) { setS(initial); return; }
    api<Strength>("/me/profile-strength").then(setS).catch(() => setS(null));
  }, [initial]);

  useEffect(() => {
    if (!dismissible) return;
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
      setHidden(Date.now() - at < DISMISS_DAYS * 86_400_000);
    } catch {
      setHidden(false);
    }
  }, [dismissible]);

  if (!s || (dismissible && hidden)) return null;
  const complete = s.done >= s.total;
  if (complete && dismissible) return null; // nothing to ask for on Discover
  const H = headingLevel === 2 ? "h2" : "h3";
  const withFrom = (href: string) => `${href}${href.includes("?") ? "&" : "?"}from=${from}`;

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setHidden(true);
  }

  return (
    <section id="strength" aria-labelledby="strength-title" className={`card relative scroll-mt-24 p-5 sm:p-6 ${className}`}>
      {dismissible && (
        <button type="button" onClick={dismiss} className="btn-icon absolute right-2 top-2" aria-label="Hide this for a week">
          <IconX size={18} />
        </button>
      )}

      {complete ? (
        <div className="flex items-center gap-3">
          <div className="flex shrink-0 items-end" aria-hidden="true">
            <Pea size={44} mood="happy" className="animate-pop-in" />
            <Pea size={36} mood="wink" tone="fresh" className="-ml-2 animate-pop-in [animation-delay:120ms]" />
          </div>
          <div>
            <H id="strength-title" className="text-h3 text-ink">Your profile is complete</H>
            <p className="text-sm text-ink-700">Nice work. You can change any answer on your profile.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3 pr-8">
            <Pea size={44} mood="awake" blink className="shrink-0" />
            <div className="min-w-0">
              <H id="strength-title" className="text-h3 text-ink">Make your profile stronger</H>
              <p className="text-sm text-ink-700">
                {from === "status" ? "Optional, while you wait. Add these any time." : "Optional. Add these any time."}
              </p>
            </div>
          </div>

          {/* A gentle meter: the count of the person's own items, never other people. */}
          <div className="mt-4 flex items-center gap-3">
            <div className="flex flex-1 gap-1" aria-hidden="true">
              {s.items.map((i) => (
                <span key={i.key} className={`h-2 flex-1 rounded-full ${i.done ? "bg-brand-600" : i.progress && i.progress.done > 0 ? "bg-pea-300" : "bg-ink-100"}`} />
              ))}
            </div>
            <p className="num shrink-0 text-sm font-semibold text-ink">{s.done} of {s.total} done</p>
          </div>

          <ul className="mt-4 divide-y divide-ink-100">
            {s.items.map((i) => (
              <li key={i.key}>
                {i.done ? (
                  <div className="flex items-center gap-3 py-3 text-sm text-ink-600">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-600 text-white" aria-hidden="true"><IconCheck size={14} strokeWidth={3} /></span>
                    <span>{i.label}<span className="sr-only"> (done)</span></span>
                  </div>
                ) : (
                  <Link
                    href={withFrom(i.href)}
                    onClick={() => trackFunnel("profile.item_opened", { step: i.key })}
                    className="flex min-h-[56px] items-center gap-3 rounded-field py-3 hover:bg-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    <span className="h-7 w-7 shrink-0 rounded-full border-2 border-dashed border-ink-400" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-ink">
                        {i.label}
                        {i.progress && i.progress.done > 0 && <span className="num font-normal text-ink-600"> · {i.progress.done} of {i.progress.total}</span>}
                      </span>
                      <span className="block text-sm text-ink-700">{i.why}</span>
                    </span>
                    <IconArrowRight size={18} className="shrink-0 text-ink-600" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
