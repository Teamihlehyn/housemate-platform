// HM-54: contact-detail detector (detection only; not enforced anywhere yet).
import { findContactDetails, hasContactDetails } from "../lib/contactDetails";

const cases: [string, boolean][] = [];
const check = (name: string, pass: boolean) => cases.push([name, pass]);
const kinds = (t: string) => findContactDetails(t).join(",");

// Phones
for (const t of ["Call 08031234567", "my number 0803 123 4567", "+234 803 123 4567", "234-803-123-4567", "0703.123.4567", "07700 900123", "+44 7700 900123", "+44 (0)7700 900 123", "0044 7700 900123", "020 7946 0958"]) {
  check(`phone: ${t}`, kinds(t).includes("phone"));
}
// Emails
for (const t of ["ada@example.com", "ada (at) example (dot) com", "ADA[at]gmail[dot]com", "ada at gmail dot com"]) {
  check(`email: ${t}`, kinds(t).includes("email"));
}
// URLs and links
for (const t of ["see https://example.com/me", "www.mysite.ng", "wa.me/2348031234567", "ada.link/me", "t.me/ada"]) {
  check(`url: ${t}`, kinds(t).includes("url"));
}
// Handles and app words
check("handle: @ada_lagos", kinds("find me @ada_lagos").includes("handle"));
for (const t of ["WhatsApp me", "on whatsapp", "telegram only", "cashapp me", "Cash App", "DM me on insta", "snapchat"]) {
  check(`app word: ${t}`, kinds(t).includes("messaging_app"));
}
// Not contact details
for (const t of [
  "I'm a nurse, 29, tidy and quiet. I cook jollof on Sundays.",
  "Budget ₦2,500,000 a year, moving in March 2027.",
  "I've lived in Yaba for 3 years and work 9 to 5.",
  "Rent 1200 per month, 12 months minimum, 2 cats.",
  "",
]) {
  check(`clean: "${t.slice(0, 40)}"`, !hasContactDetails(t));
}
check("null is clean", findContactDetails(null).length === 0);
check("returns kinds, never the matched text", findContactDetails("ada@example.com 08031234567").every((k) => !k.includes("@") && !/\d/.test(k)));

let failed = 0;
for (const [name, pass] of cases) {
  if (!pass) failed++;
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
}
console.log(failed ? `${failed} FAILED` : "ALL PASSED");
process.exit(failed ? 1 : 0);
