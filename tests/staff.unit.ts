// Staff access comes only from ADMIN_EMAILS in beta and on Vercel (HM-10). Run: npm run test:unit
// Run with APP_ENV=beta so the allowlist is enforced.
import { effectiveRole, staffRoleAllowed } from "../lib/staff";

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

let failed = 0;
for (const [name, pass] of cases) { console.log(`${pass ? "PASS" : "FAIL"} ${name}`); if (!pass) failed++; }
if (failed) { console.log(`${failed} FAILED`); process.exit(1); }
console.log("ALL PASSED");
