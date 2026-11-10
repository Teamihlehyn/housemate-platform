// Unit checks for the beta checks list (ENG-04). Run: npm run test:unit
import { toCheckList } from "../lib/credibility";
import { CHECKS_DISCLAIMER, checkRows, identityChecked, monthLabel } from "../lib/checks";

const cases: [string, boolean][] = [];
const check = (name: string, pass: boolean) => cases.push([name, pass]);

const nov = new Date("2026-11-10T23:30:00Z");
const rows = [
  { category: "email", status: "verified", checkedAt: new Date("2026-10-31T23:59:00Z") },
  { category: "identity", status: "verified", checkedAt: nov },
  { category: "phone", status: "verified", checkedAt: nov },
  { category: "reference", status: "verified", checkedAt: nov },
];

const pub = toCheckList(rows, { verifiedOnly: true });
check("public list: identity, email, phone only (no reference/additional)",
  pub.map((c) => c.category).sort().join() === "email,identity,phone");
check("months are YYYY-MM in UTC, never a timestamp",
  pub.every((c) => /^[0-9]{4}-[0-9]{2}$/.test(c.checkedMonth ?? "")) && pub.find((c) => c.category === "email")!.checkedMonth === "2026-10");
check("DTO carries no score, points or dates", pub.every((c) => Object.keys(c).sort().join() === "category,checkedMonth,status"));
check("verifiedOnly hides pending/failed checks",
  toCheckList([{ category: "identity", status: "manual_review", checkedAt: nov }], { verifiedOnly: true }).length === 0);

const own = toCheckList([{ category: "email", status: "verified", checkedAt: nov }, { category: "identity", status: "manual_review", checkedAt: nov }], { verifiedOnly: false });
check("own list shows pending identity without a month",
  own.find((c) => c.category === "identity")!.status === "pending" && own.find((c) => c.category === "identity")!.checkedMonth === null);
check("failed maps to failed", toCheckList([{ category: "identity", status: "failed", checkedAt: nov }], { verifiedOnly: false })[0].status === "failed");

check("month label", monthLabel("2026-11") === "November 2026" && monthLabel("2026-01") === "January 2026");
check("bad month label is null", monthLabel("2026-13") === null && monthLabel("2026-11-01") === null && monthLabel(null) === null);

const shown = checkRows(pub, { own: false });
const text = shown.map((r) => r.text).join(" | ") + " | " + CHECKS_DISCLAIMER;
check("another member: email + identity with month", shown.map((r) => r.text).join(" | ") ===
  "Email confirmed | Identity checked by the Peabudy team · November 2026");
check("no '/100', no score digits, no 'demo'", !/\/100/.test(text) && !/demo/i.test(text) && !/[0-9]/.test(text.replace(/November 2026/, "")));
check("phone row hidden until staff can record it (DES-02, F-08)", !shown.some((r) => r.key === "phone"));
check("disclaimer is the fixed phrase", CHECKS_DISCLAIMER === "Checks completed — not a guarantee of safety.");
check("own pending identity explains the next step",
  checkRows(own, { own: true }).some((r) => r.key === "identity" && !r.done && /video call/.test(r.text)));
check("another member never shows not-done rows", checkRows(own, { own: false }).every((r) => r.done));
check("identityChecked", identityChecked(pub) && !identityChecked(own) && !identityChecked(undefined));

let failed = 0;
for (const [name, pass] of cases) {
  if (!pass) failed++;
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}
console.log(failed ? `${failed} FAILED` : "ALL PASSED");
process.exit(failed ? 1 : 0);
