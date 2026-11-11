// Back-office security alerts (ENG-48). Run: npm run test:unit
import { alertRecipients, alertTime, deviceHint } from "../lib/staffAlerts";
import { staffAlertEmail } from "../lib/emails";

const cases: [string, boolean][] = [];
const check = (name: string, pass: boolean) => cases.push([name, pass]);

const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const androidChrome = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const winEdge = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0";
const macFirefox = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:127.0) Gecko/20100101 Firefox/127.0";
check("iPhone Safari", deviceHint(iphone) === "Safari on iOS");
check("Android Chrome", deviceHint(androidChrome) === "Chrome on Android");
check("Windows Edge", deviceHint(winEdge) === "Edge on Windows");
check("Mac Firefox", deviceHint(macFirefox) === "Firefox on macOS");
check("no versions or details leak", !/\d/.test(deviceHint(iphone)) && !/\d/.test(deviceHint(winEdge)));
check("missing UA", deviceHint(null) === "an unknown browser on an unknown system");

const t = alertTime(new Date("2026-11-19T13:30:00Z"));
check("time in both pilot zones", t.includes("13:30 (London)") && t.includes("14:30 (Lagos)"), );

check("every admin plus the staff address, once each",
  JSON.stringify(alertRecipients("Ops@x.co", ["boss@x.co", "ops@x.co"])) === '["boss@x.co","ops@x.co"]'
  && JSON.stringify(alertRecipients("v@x.co", ["boss@x.co"])) === '["boss@x.co","v@x.co"]');

const set = staffAlertEmail({ kind: "password_set", masked: "op•••@x.co", time: t, device: null, signin_url: "https://x.test/staff/signin" });
const sin = staffAlertEmail({ kind: "signin", masked: "op•••@x.co", time: t, device: "Chrome on Android", signin_url: "https://x.test/staff/signin" });
check("password-set alert: masked address, time, sign-in link, what to do", set.text.includes("op•••@x.co") && set.text.includes("(Lagos)") && set.text.includes("https://x.test/staff/signin") && /reset the password/.test(set.text));
check("sign-in alert: device hint, no IP", sin.text.includes("Chrome on Android") && !/\b\d{1,3}(\.\d{1,3}){3}\b/.test(sin.text));
check("alerts never carry a token or a code", ![set, sin].some((m) => /token=|\b\d{6}\b/.test(m.subject + m.text + m.html)));
check("subjects don't look like the set-up or code emails", !/back-office password|sign-in code/.test(set.subject + sin.subject));

let failed = 0;
for (const [name, pass] of cases) {
  if (!pass) failed++;
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}
console.log(failed ? `${failed} FAILED` : "ALL PASSED");
process.exit(failed ? 1 : 0);
