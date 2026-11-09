// Unit checks for sign-in helpers (ENG-06). Run: npm run test:unit
import { clientIp, codesMatch, generateLoginCode, hashIp, isReconsent, needsConsent } from "../lib/auth";
import { demoModeFor, resolveAppEnv } from "../lib/env";

const cases: [string, boolean][] = [];
const check = (name: string, pass: boolean) => cases.push([name, pass]);

// Codes: 1,000 draws, all six-digit strings in range, not all the same.
const codes = Array.from({ length: 1000 }, generateLoginCode);
check("1,000 codes are all 6-digit strings", codes.every((c) => /^[0-9]{6}$/.test(c)));
check("1,000 codes are all between 100000 and 999999", codes.every((c) => +c >= 100000 && +c <= 999999));
check("codes vary", new Set(codes).size > 900);

const V2 = "privacy-v2";
const never = { privacyConsentAt: null, privacyConsentVersion: null };
const onV1 = { privacyConsentAt: new Date("2026-10-06"), privacyConsentVersion: "privacy-v1" };
const onV2 = { privacyConsentAt: new Date("2026-11-10"), privacyConsentVersion: V2 };

check("new account must consent", needsConsent(null, V2, true));
check("never consented must consent", needsConsent(never, V2, true));
check("consented to older version must re-consent", needsConsent(onV1, V2, true));
check("consented to current version needn't", !needsConsent(onV2, V2, true));
check("consent not required here (dev/staging)", !needsConsent(onV1, V2, false));
check("older version counts as re-consent", isReconsent(onV1, V2));
check("new account isn't a re-consent", !isReconsent(null, V2));
check("never consented isn't a re-consent", !isReconsent(never, V2));
check("current version isn't a re-consent", !isReconsent(onV2, V2));

// Constant-time compare (HM-03).
check("matching codes match", codesMatch("123456", "123456"));
check("wrong code doesn't match", !codesMatch("123456", "123457"));
check("different length doesn't match (and doesn't throw)", !codesMatch("123456", "1234567") && !codesMatch("123456", ""));

// IP hashing (HM-08).
const hdr = (h: Record<string, string>) => ({ headers: { get: (n: string) => h[n.toLowerCase()] ?? null } });
check("client IP is the first forwarded address", clientIp(hdr({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })) === "203.0.113.7");
check("client IP falls back to unknown", clientIp(hdr({})) === "unknown");
check("IP hash is stable and doesn't contain the IP", hashIp("203.0.113.7") === hashIp("203.0.113.7") && !hashIp("203.0.113.7").includes("203"));

// Mode resolution fails closed (HM-05).
const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };
check("production: unset APP_ENV refuses to start", throws(() => resolveAppEnv({ VERCEL_ENV: "production" })));
check("production: mistyped APP_ENV refuses to start", throws(() => resolveAppEnv({ VERCEL_ENV: "production", APP_ENV: "Beta", NEXT_PUBLIC_APP_ENV: "Beta" })));
check("production: NEXT_PUBLIC_APP_ENV must match", throws(() => resolveAppEnv({ VERCEL_ENV: "production", APP_ENV: "beta", NEXT_PUBLIC_APP_ENV: "research" })));
check("production: beta + beta is fine", resolveAppEnv({ VERCEL_ENV: "production", APP_ENV: "beta", NEXT_PUBLIC_APP_ENV: "beta" }).mode === "beta");
const unset = resolveAppEnv({ VERCEL_ENV: "preview" });
check("elsewhere: unset APP_ENV runs as development, not explicit", unset.mode === "development" && !unset.explicit);
check("unset APP_ENV never shows on-screen codes", !demoModeFor(unset.mode, unset.explicit, undefined));
check("explicit research shows on-screen codes", demoModeFor("research", true, undefined));
check("DEMO_MODE=false turns them off", !demoModeFor("staging", true, "false"));
check("beta never shows on-screen codes", !demoModeFor("beta", true, "true"));

let failed = 0;
for (const [name, pass] of cases) {
  if (!pass) failed++;
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}
console.log(failed ? `${failed} FAILED` : "ALL PASSED");
process.exit(failed ? 1 : 0);
