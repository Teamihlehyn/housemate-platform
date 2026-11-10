// Unit checks for sign-in helpers (ENG-06). Run: npm run test:unit
import {
  MAX_CODES_PER_EMAIL_HOUR, MAX_EMAILED_CODES_PER_HOUR, MAX_EMAILED_CODES_PER_IP_HOUR,
  BUSY_MESSAGE, clientIp, codesMatch, decideCodeRequest, generateLoginCode, hashIp, ipBucket, ipHashSalt, isReconsent, needsConsent,
} from "../lib/auth";
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
check("IP hash is stable and doesn't contain the IP", hashIp("203.0.113.7") === hashIp("203.0.113.7") && !hashIp("203.0.113.7")!.includes("203"));

// IPv6 grouped by /64 (HM-08).
check("IPv4 is its own bucket", ipBucket("203.0.113.7") === "203.0.113.7" && ipBucket("203.0.113.8") !== ipBucket("203.0.113.7"));
check("IPv6 in the same /64 share a bucket",
  ipBucket("2001:db8:1:2:aaaa:bbbb:cccc:dddd") === ipBucket("2001:db8:1:2::1") &&
  ipBucket("2001:0db8:0001:0002:0:0:0:ffff") === "2001:db8:1:2::/64");
check("IPv6 in different /64s don't", ipBucket("2001:db8:1:2::1") !== ipBucket("2001:db8:1:3::1"));
check("IPv6 case and zero-padding don't matter", ipBucket("2001:DB8:0:0::1") === ipBucket("2001:db8::2"));
check("bracketed IPv6 and zone IDs are handled", ipBucket("[2001:db8:1:2::9]") === "2001:db8:1:2::/64" && ipBucket("fe80::1%en0") === "fe80:0:0:0::/64");
check("IPv4-mapped IPv6 counts as the IPv4 address", ipBucket("::ffff:203.0.113.7") === "203.0.113.7" && ipBucket("::ffff:cb00:7107") === "203.0.113.7");
check("rotating the interface ID doesn't dodge the cap", hashIp("2001:db8:5:6::1") === hashIp("2001:db8:5:6:ffff:ffff:ffff:ffff"));
check("junk input doesn't throw", ipBucket("unknown") === "unknown" && ipBucket("1:2:3") === "1:2:3" && ipBucket("::1:2:3:4:5:6:7:8:9") !== "");

// IP_HASH_SALT (HM-23): no public fallback in any Vercel deployment.
check("deployed without a salt: IPs aren't recorded", ipHashSalt({ VERCEL_ENV: "production" }) === null && ipHashSalt({ VERCEL_ENV: "preview" }) === null);
check("deployed with a short salt: treated as missing", ipHashSalt({ VERCEL_ENV: "production", IP_HASH_SALT: "short" }) === null);
check("deployed with a real salt: used", ipHashSalt({ VERCEL_ENV: "production", IP_HASH_SALT: "a".repeat(64) }) === "a".repeat(64));
check("local without a salt: a local-only salt", typeof ipHashSalt({}) === "string");
check("no salt → no hash", hashIp("203.0.113.7", null) === null);
check("the old public default salt is gone", ipHashSalt({}) !== "peabudy-ip-v1");
check("different salts give different hashes", hashIp("203.0.113.7", "x".repeat(16)) !== hashIp("203.0.113.7", "y".repeat(16)));

// Code request caps (HM-08).
const base = { emailedCode: true, isStaff: false, fromEmail: 0, fromIp: 0, sitewide: 0 };
check("under every cap: send", decideCodeRequest(base) === "send");
check("per-email cap: 429 for everyone",
  decideCodeRequest({ ...base, fromEmail: MAX_CODES_PER_EMAIL_HOUR }) === "email_limited" &&
  decideCodeRequest({ ...base, isStaff: true, fromEmail: MAX_CODES_PER_EMAIL_HOUR }) === "email_limited" &&
  decideCodeRequest({ ...base, emailedCode: false, fromEmail: MAX_CODES_PER_EMAIL_HOUR }) === "email_limited");
check("per-IP cap: 429, staff included", decideCodeRequest({ ...base, fromIp: MAX_EMAILED_CODES_PER_IP_HOUR }) === "ip_limited" &&
  decideCodeRequest({ ...base, isStaff: true, fromIp: MAX_EMAILED_CODES_PER_IP_HOUR }) === "ip_limited");
check("site-wide cap (HM-26): members get an honest 429, nothing sent", decideCodeRequest({ ...base, sitewide: MAX_EMAILED_CODES_PER_HOUR }) === "sitewide_limited");
check("site-wide cap (HM-26): staff get the same 429 but their code is sent",
  decideCodeRequest({ ...base, isStaff: true, sitewide: MAX_EMAILED_CODES_PER_HOUR + 50 }) === "send_sitewide_limited");
check("just under the site-wide cap: send", decideCodeRequest({ ...base, sitewide: MAX_EMAILED_CODES_PER_HOUR - 1 }) === "send");

// Invite-only sign-up (D15).
check("new address, no invite: INVITE_REQUIRED", decideCodeRequest({ ...base, newAccount: "required" }) === "invite_required");
check("new address, bad invite: INVITE_INVALID", decideCodeRequest({ ...base, newAccount: "invalid" }) === "invite_invalid");
check("new address, good invite: send", decideCodeRequest({ ...base, newAccount: "ok" }) === "send");
check("existing account (gate null): send", decideCodeRequest({ ...base, newAccount: null }) === "send");
check("sign-ups paused beats a good invite", decideCodeRequest({ ...base, newAccount: "paused" }) === "signups_paused");
check("the per-IP cap applies before the invite check (so probing is capped)",
  decideCodeRequest({ ...base, fromIp: MAX_EMAILED_CODES_PER_IP_HOUR, newAccount: "required" }) === "ip_limited");
check("an invite refusal is the same whatever the site-wide count",
  decideCodeRequest({ ...base, sitewide: MAX_EMAILED_CODES_PER_HOUR, newAccount: "required" }) === "invite_required");
check("busy message is the agreed copy", BUSY_MESSAGE === "We're getting a lot of sign-in requests right now. Try again in an hour.");
check("on-screen codes ignore the IP and site-wide caps",
  decideCodeRequest({ ...base, emailedCode: false, fromIp: 99, sitewide: 9999 }) === "send");

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
