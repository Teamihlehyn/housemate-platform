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

export type AppEnv = "development" | "staging" | "research" | "beta";

export const APP_ENV: AppEnv =
  (process.env.APP_ENV as AppEnv) ||
  (process.env.NODE_ENV === "production" ? "staging" : "development");

export const IS_BETA = APP_ENV === "beta";
export const IS_RESEARCH = APP_ENV === "research";
export const IS_STAGING = APP_ENV === "staging";
export const IS_DEV = APP_ENV === "development";

// Demo features (personas, on-screen login codes) — never in beta.
export const DEMO_MODE = IS_BETA ? false : process.env.DEMO_MODE !== "false";

// Real email delivery is required whenever on-screen codes are off.
export const EMAIL_DELIVERY = !DEMO_MODE;

// In research, every new account gets its own private world of sample housemates,
// so concurrent testers never collide and every task can be completed solo.
export const SANDBOX_ON_SIGNUP = IS_RESEARCH;

// Privacy consent is required wherever real people use the site.
export const CONSENT_REQUIRED = IS_BETA || IS_RESEARCH;

// One honest message per environment.
export const BANNER = IS_BETA
  ? "Early access — identity is verified by our team; property listings and viewings are guided examples."
  : "Prototype: all people, checks and homes are samples.";

export const ENV_LABEL = APP_ENV;
