// Back-office sign-in helpers (ENG-47). Run: npm run test:unit
import { hashPassword, newToken, passwordProblem, plausibleToken, sha256, verifyPassword, PASSWORD_MIN } from "../lib/staffAuth";

const cases: [string, boolean][] = [];
const check = (name: string, pass: boolean) => cases.push([name, pass]);

(async () => {
  const h = await hashPassword("a long enough passphrase 42");
  check("hash is scrypt with parameters, salt and key, never the password", /^scrypt\$32768\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/.test(h) && !h.includes("passphrase"));
  check("the right password verifies", await verifyPassword("a long enough passphrase 42", h));
  check("a wrong password doesn't", !(await verifyPassword("a long enough passphrase 43", h)));
  check("two hashes of one password differ (salted)", h !== (await hashPassword("a long enough passphrase 42")));
  check("malformed stored hashes are simply 'no'", !(await verifyPassword("x", "bcrypt$whatever")) && !(await verifyPassword("x", "")));

  check(`under ${PASSWORD_MIN} characters is refused`, passwordProblem("short pass", "a@x.co") !== null);
  check("very common passwords are refused", passwordProblem("Password1234", "a@x.co") !== null && passwordProblem("qwertyuiop12", "a@x.co") !== null);
  check("one repeated character is refused", passwordProblem("aaaaaaaaaaaaaa", "a@x.co") !== null);
  check("containing the email name is refused", passwordProblem("opslead-2026-backoffice", "opslead@example.com") !== null);
  check("a long, unusual passphrase is fine", passwordProblem("green kettle on a lagos tuesday", "ops@example.com") === null);
  check("non-strings are refused", passwordProblem(undefined, "a@x.co") !== null && passwordProblem(123456789012, "a@x.co") !== null);

  const t = newToken();
  check("tokens: 32 random bytes, only the SHA-256 kept", plausibleToken(t.token) && t.hash === sha256(t.token) && t.hash !== t.token && newToken().token !== t.token);
  check("junk isn't a token", !plausibleToken("abc") && !plausibleToken(null) && !plausibleToken("x".repeat(43) + "/"));

  let failed = 0;
  for (const [name, pass] of cases) {
    if (!pass) failed++;
    console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
  }
  console.log(failed ? `${failed} FAILED` : "ALL PASSED");
  process.exit(failed ? 1 : 0);
})();
