// Central, environment-aware configuration.
//
// APP_ENV drives behaviour across the three environments:
//   development  — local; seeded demo data, demo login sink, prototype banner.
//   staging      — cloud QA mirror; seeded demo data, demo login sink.
//   beta         — real users; NO demo sink, real email delivery required.
//
// DEMO_MODE can be forced off in dev/staging but is ALWAYS off in beta.

export type AppEnv = "development" | "staging" | "beta";

export const APP_ENV: AppEnv =
  (process.env.APP_ENV as AppEnv) ||
  (process.env.NODE_ENV === "production" ? "staging" : "development");

export const IS_BETA = APP_ENV === "beta";
export const IS_STAGING = APP_ENV === "staging";
export const IS_DEV = APP_ENV === "development";

// Demo features (seeded personas, demo login sink) — never in beta.
export const DEMO_MODE = IS_BETA ? false : process.env.DEMO_MODE !== "false";

// Real email delivery is required whenever the demo sink is off.
export const EMAIL_DELIVERY = !DEMO_MODE;

// Honest banner per environment. Verification/property partners are still
// simulated everywhere until real vendors are integrated (a production gate),
// so even beta says so plainly.
export const BANNER =
  IS_BETA
    ? "Beta — identity and property checks are still simulated; not for real tenancy decisions yet."
    : "Prototype — sample people, simulated checks, no real bookings";

export const ENV_LABEL = APP_ENV;
