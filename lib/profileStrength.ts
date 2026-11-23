import { QUESTIONNAIRE } from "./constants";

// Profile strength (ENG-68): what's left to make a profile stronger, owner-only. Joining asks
// only the essentials; everything here can be done later, from the status page (applicants) or
// the profile (users). Pure; unit-tested in tests/round1.unit.ts.

export const BIO_GOOD = 40; // a bio this long counts as done (it's optional, never required)

export interface StrengthInput {
  bio: string | null;
  journey: string | null;
  stayAnswered: boolean;
  habits: { dimension: string; own: string | null; state: string }[];
}

export interface StrengthItem {
  key: "bio" | "habits" | "stay" | "journey";
  label: string;
  done: boolean;
  progress: { done: number; total: number } | null;
  href: string;
  screen: string; // the first screen id to open (useProfileDraft ids)
  why: string;
  weight: number;
}

export function profileStrength(u: StrengthInput, opts: { applicant: boolean }) {
  const answered = QUESTIONNAIRE.filter((q) => {
    const h = u.habits.find((x) => x.dimension === q.id);
    return !!h?.own && h.state !== "unanswered";
  });
  const firstMissingHabit = QUESTIONNAIRE.find((q) => !answered.includes(q));
  const where = (screen: string) => (opts.applicant ? `/join/better?screen=${encodeURIComponent(screen)}` : `/profile?edit=${encodeURIComponent(screen)}`);
  const items: StrengthItem[] = [
    {
      key: "bio",
      label: "Write a short bio",
      done: (u.bio ?? "").trim().length >= BIO_GOOD,
      progress: null,
      href: where("bio"),
      screen: "bio",
      why: "Other users read it before saying hello. A few lines about you and your routine is plenty.",
      weight: 30,
    },
    {
      key: "habits",
      label: "Answer the six living-habit questions",
      done: answered.length === QUESTIONNAIRE.length,
      progress: { done: answered.length, total: QUESTIONNAIRE.length },
      href: where(firstMissingHabit ? `h:${firstMissingHabit.id}` : `h:${QUESTIONNAIRE[0].id}`),
      screen: firstMissingHabit ? `h:${firstMissingHabit.id}` : `h:${QUESTIONNAIRE[0].id}`,
      why: "We only match people whose habits suit each other, so your first matches are more precise.",
      weight: 40,
    },
    {
      key: "stay",
      label: "Say how long you want to stay",
      done: u.stayAnswered,
      progress: null,
      href: where("stay"),
      screen: "stay",
      why: "Until you answer, we treat you as open to any length.",
      weight: 15,
    },
    {
      key: "journey",
      label: "Say what you're looking for",
      done: !!u.journey,
      progress: null,
      href: where("journey"),
      screen: "journey",
      why: "Whether you're finding a place together, have one in mind, or have a room to offer.",
      weight: 15,
    },
  ];
  const total = items.reduce((n, i) => n + i.weight, 0);
  const earned = items.reduce((n, i) => n + (i.done ? i.weight : i.progress ? Math.floor((i.weight * i.progress.done) / i.progress.total) : 0), 0);
  return {
    items,
    done: items.filter((i) => i.done).length,
    total: items.length,
    percent: Math.round((earned / total) * 100),
  };
}
