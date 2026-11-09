// Unit checks for the two-way housemate gender rule. Run: npm run test:unit
import { gendersCompatible as ok, parseGenderPreference as parse } from "../lib/constants";

const ALL = ["woman", "man", "non_binary"];
const cases: [string, boolean, boolean][] = [
  ["two people open to anyone", ok({ gender: "man", accepts: ALL }, { gender: "woman", accepts: ALL }), true],
  ["women-only woman + woman open to anyone", ok({ gender: "woman", accepts: ["woman"] }, { gender: "woman", accepts: ALL }), true],
  ["women-only woman + man open to anyone", ok({ gender: "woman", accepts: ["woman"] }, { gender: "man", accepts: ALL }), false],
  ["woman open to anyone + man who wants men only", ok({ gender: "woman", accepts: ALL }, { gender: "man", accepts: ["man"] }), false],
  ["prefer-not-to-say + someone open to anyone", ok({ gender: "prefer_not_to_say", accepts: ALL }, { gender: "man", accepts: ALL }), true],
  ["prefer-not-to-say + women-only", ok({ gender: "prefer_not_to_say", accepts: ALL }, { gender: "woman", accepts: ["woman"] }), false],
  ["unset gender (older account) + open to anyone", ok({ gender: null, accepts: ALL }, { gender: "woman", accepts: ALL }), true],
  ["unset gender + women-only", ok({ gender: null, accepts: ALL }, { gender: "woman", accepts: ["woman"] }), false],
  ["non-binary + women & non-binary", ok({ gender: "non_binary", accepts: ALL }, { gender: "woman", accepts: ["woman", "non_binary"] }), true],
  ["parse: empty → everyone", parse("[]").length === 3, true],
  ["parse: junk → everyone", parse("not json").length === 3, true],
  ["parse: drops unknown values", JSON.stringify(parse('["woman","alien"]')) === '["woman"]', true],
];

let failed = 0;
for (const [name, got, want] of cases) {
  const pass = got === want;
  if (!pass) failed++;
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}
console.log(failed ? `${failed} FAILED` : "ALL PASSED");
process.exit(failed ? 1 : 0);
