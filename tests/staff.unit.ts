// Staff access comes only from ADMIN_EMAILS in beta and on Vercel (HM-10). Run: npm run test:unit
// Run with APP_ENV=beta so the allowlist is enforced.
import { effectiveRole, listedRole, roleAtSignIn, staffRoleAllowed } from "../lib/staff";

const cases: [string, boolean][] = [];
const check = (name: string, pass: boolean) => cases.push([name, pass]);

process.env.ADMIN_EMAILS = " Founder@Example.com , ops@example.com";
check("listed admin keeps admin", effectiveRole({ role: "admin", email: "founder@example.com" }) === "admin");
check("listing is case- and space-insensitive", staffRoleAllowed("FOUNDER@example.com "));
check("stored admin NOT in ADMIN_EMAILS is treated as member",
  effectiveRole({ role: "admin", email: "someone-else@example.com" }) === "member");
check("stored verifier not listed is treated as member",
  effectiveRole({ role: "verifier", email: "v@example.com" }) === "member");
check("members stay members", effectiveRole({ role: "member", email: "founder@example.com" }) === "member");
check("missing email never gets staff", !staffRoleAllowed(null));
process.env.ADMIN_EMAILS = "";
check("empty ADMIN_EMAILS grants nobody staff",
  effectiveRole({ role: "admin", email: "founder@example.com" }) === "member");

// STAFF_EMAILS for verifiers and moderators (ENG-42).
process.env.ADMIN_EMAILS = "boss@example.com";
process.env.STAFF_EMAILS = "Vee@example.com:verifier, mo@example.com:moderator, bad@example.com:admin, junk";
check("listed verifier keeps verifier", effectiveRole({ role: "verifier", email: "vee@example.com" }) === "verifier");
check("listed moderator keeps moderator", effectiveRole({ role: "moderator", email: "mo@example.com" }) === "moderator");
check("the listed role wins over a stored higher role", effectiveRole({ role: "admin", email: "mo@example.com" }) === "moderator");
check("STAFF_EMAILS can't grant admin", listedRole("bad@example.com") === null && effectiveRole({ role: "admin", email: "bad@example.com" }) === "member");
check("a listed address with a member role stays member until sign-in syncs it",
  effectiveRole({ role: "member", email: "vee@example.com" }) === "member" && roleAtSignIn({ role: "member", email: "vee@example.com" }) === "verifier");
check("sign-in removes an unlisted stored admin", roleAtSignIn({ role: "admin", email: "gone@example.com" }) === "member");
check("sign-in grants ADMIN_EMAILS admin", roleAtSignIn({ role: "member", email: "boss@example.com" }) === "admin");
check("sign-in leaves a correct role alone", roleAtSignIn({ role: "verifier", email: "vee@example.com" }) === null && roleAtSignIn({ role: "member", email: "x@example.com" }) === null);
check("ADMIN_EMAILS beats STAFF_EMAILS", (process.env.STAFF_EMAILS = "boss@example.com:moderator", listedRole("boss@example.com") === "admin"));
process.env.STAFF_EMAILS = "";

let failed = 0;
for (const [name, pass] of cases) { console.log(`${pass ? "PASS" : "FAIL"} ${name}`); if (!pass) failed++; }
if (failed) { console.log(`${failed} FAILED`); process.exit(1); }
console.log("ALL PASSED");
