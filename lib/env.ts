// Central, environment-aware configuration.
//
// APP_ENV drives behaviour:
//   development  — local; seeded demo data, on-screen login codes.
//   staging      — cloud QA; seeded demo data, on-screen login codes.
//   research     — user-testing prototype; on-screen codes, demo personas, and every
//                  tester gets a private world of sample housemates that respond.
//   beta         — real users; NO on-screen codes, real email, manual identity review.
//
// DEMO_MODE can be forced off outside beta but is ALWAYS off in beta.
// Server-only: client components read process.env.NEXT_PUBLIC_APP_ENV instead.

export type AppEnv = "development" | "staging" | "research" | "beta";
const MODES: readonly AppEnv[] = ["development", "staging", "research", "beta"];

// Fails closed (security review HM-05). A missing or mistyped APP_ENV must never turn
// on-screen login codes on, because then anyone can sign in as anyone:
//   - On the production deployment (VERCEL_ENV=production), APP_ENV must be one of the
//     four literal values and NEXT_PUBLIC_APP_ENV must equal it, or the server refuses
//     to start (the build fails, so the previous deployment stays live).
//   - Anywhere else, an unset or unknown value runs as "development" with demo features
//     OFF (`explicit: false`), so sign-in needs real email.
export function resolveAppEnv(env: Record<string, string | undefined>): { mode: AppEnv; explicit: boolean } {
  const raw = env.APP_ENV;
  const valid = MODES.includes(raw as AppEnv);
  if (env.VERCEL_ENV === "production") {
    if (!valid) throw new Error(`APP_ENV must be one of ${MODES.join(", ")} in production.`);
    if (env.NEXT_PUBLIC_APP_ENV !== raw) throw new Error("NEXT_PUBLIC_APP_ENV must equal APP_ENV in production.");
  }
  return valid ? { mode: raw as AppEnv, explicit: true } : { mode: "development", explicit: false };
}

// On-screen codes and personas only where the mode was set explicitly to a demo mode
// and DEMO_MODE isn't "false". Never in beta.
export function demoModeFor(mode: AppEnv, explicit: boolean, demoModeVar: string | undefined): boolean {
  return explicit && mode !== "beta" && demoModeVar !== "false";
}

const resolved = resolveAppEnv({
  APP_ENV: process.env.APP_ENV,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  VERCEL_ENV: process.env.VERCEL_ENV,
});

export const APP_ENV: AppEnv = resolved.mode;

export const IS_BETA = APP_ENV === "beta";
export const IS_RESEARCH = APP_ENV === "research";

// Demo features (personas, on-screen login codes) — never in beta, never by accident.
export const DEMO_MODE = demoModeFor(APP_ENV, resolved.explicit, process.env.DEMO_MODE);

// In research, every new account gets its own private world of sample housemates,
// so concurrent testers never collide and every task can be completed solo.
export const SANDBOX_ON_SIGNUP = IS_RESEARCH;

// Beta keeps only the written agreement: homes, shortlists, viewings, the application
// and move-in run on sample homes and demo partners, so they are switched off (ENG-01).
export const HOMES_ENABLED = !IS_BETA;

// Beta: people only see each other once the team has checked both identities (ENG-02).
export const VERIFIED_ONLY_BROWSING = IS_BETA;

// Privacy consent is required wherever real people use the site.
export const CONSENT_REQUIRED = IS_BETA || IS_RESEARCH;

// One honest message per environment.
export const BANNER = IS_BETA
  ? "Early access — identity is verified by our team; property listings and viewings are guided examples."
  : "Prototype: all people, checks and homes are samples.";


// Microsoft Clarity project ID, or null when it must not load. Off in beta until the
// consent banner ships (D8, ENG-14); the layout should render Clarity only when set.
export const CLARITY_ID: string | null =
  !IS_BETA && /^[a-z0-9]+$/i.test(process.env.NEXT_PUBLIC_CLARITY_ID || "")
    ? (process.env.NEXT_PUBLIC_CLARITY_ID as string)
    : null;
