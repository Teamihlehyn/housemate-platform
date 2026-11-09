// Unit checks for beta gating (ENG-01, ENG-02). Runs twice — once as beta, once as
// research — because mode flags are fixed at import. Run: npm run test:unit
import { APP_ENV, HOMES_ENABLED, VERIFIED_ONLY_BROWSING } from "../lib/env";
import { canSeeEachOther } from "../lib/verification";
import { requireHomesEnabled } from "../lib/guard";
import { ApiError } from "../lib/api";

const beta = APP_ENV === "beta";
const cases: [string, boolean][] = [];
const check = (name: string, pass: boolean) => cases.push([`[${APP_ENV}] ${name}`, pass]);

function homesError(): ApiError | null {
  try {
    requireHomesEnabled();
    return null;
  } catch (e) {
    return e as ApiError;
  }
}

if (beta) {
  check("homes are off", !HOMES_ENABLED);
  const e = homesError();
  check("homes routes throw 404 NOT_FOUND", e instanceof ApiError && e.status === 404 && e.code === "NOT_FOUND");
  check("verified-only browsing is on", VERIFIED_ONLY_BROWSING);
} else {
  check("homes are on", HOMES_ENABLED);
  check("homes routes don't throw", homesError() === null);
  check("verified-only browsing is off", !VERIFIED_ONLY_BROWSING);
}

const v = VERIFIED_ONLY_BROWSING;
check("both verified see each other", canSeeEachOther({ verifiedOnly: v, viewerVerified: true, targetVerified: true }));
check("unverified viewer sees a verified person only outside beta",
  canSeeEachOther({ verifiedOnly: v, viewerVerified: false, targetVerified: true }) === !beta);
check("verified viewer sees an unverified person only outside beta",
  canSeeEachOther({ verifiedOnly: v, viewerVerified: true, targetVerified: false }) === !beta);
check("neither verified: only outside beta",
  canSeeEachOther({ verifiedOnly: v, viewerVerified: false, targetVerified: false }) === !beta);

let failed = 0;
for (const [name, pass] of cases) {
  if (!pass) failed++;
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}
console.log(failed ? `${failed} FAILED` : "ALL PASSED");
process.exit(failed ? 1 : 0);
