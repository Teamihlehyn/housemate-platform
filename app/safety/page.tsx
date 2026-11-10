import Link from "next/link";
import Logo from "@/components/brand/Logo";
import { IS_BETA } from "@/lib/env";

export default function Safety() {
  // Beta copy from DES-01 #14–16: no score, no "demo", no prototype wording (ENG-04).
  const points = IS_BETA ? [
    ["Evidence, not guarantees", "We show which checks someone has completed. It's never a promise that they're safe."],
    ["How we check identity", "Before anyone can see other members or be seen, someone from our team checks their photo ID on a short video call. We record only that the check passed and when. We don't keep a copy of your ID."],
    ["Your private data stays private", "Legal identity, contacts, exact addresses and evidence are never shown on profile cards. Precise current location is never shown on a map."],
    ["You're in control", "Block anyone instantly — it's bilateral and silent. Report separately if needed. Blocking someone ends interactions and any shared household immediately."],
    ["Server-enforced permissions", "Every access is checked on the server. A hidden button is never authorisation. Staff cannot read private chats."],
    ["No money through Peabudy", "We never take payments or deposits, and your agreement isn't a tenancy. Never pay anyone before you've seen a home in person and checked who the landlord is."],
  ] : [
    ["Evidence, not guarantees", "The credibility score reflects which checks are complete. It is never a promise that someone is safe. We always show the evidence breakdown alongside the number."],
    ["Simulated checks are labelled", "Every verification badge reads \"Demo verified\" and every listing reads \"Sample availability\". Pending or failed checks never look successful."],
    ["Your private data stays private", "Legal identity, contacts, exact addresses and evidence are never shown on profile cards. Precise current location is never shown on a map."],
    ["You're in control", "Block anyone instantly — it's bilateral and silent. Report separately if needed. Blocking someone ends interactions and any shared household immediately."],
    ["Server-enforced permissions", "Every access is checked on the server. A hidden button is never authorisation. Staff cannot read private chats or edit scores."],
    ["No real money", "There are no payments, deposits or binding agreements. A rental handoff is a demo — \"no home is reserved\"."],
  ];
  return (
    <div className="min-h-screen">
      <header className="border-b border-ink-100 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Logo size="sm" />
          <Link href="/signin" className="btn-primary">Get started</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold text-ink">Our safety approach</h1>
        <p className="mt-3 text-ink-600">
          Peabudy is designed to help you assess strangers and coordinate a move with clear,
          honest information. Here is how we think about trust and safety {IS_BETA ? "in early access" : "in this prototype"}.
        </p>
        <div className="mt-8 space-y-5">
          {points.map(([t, d]) => (
            <div key={t} className="card p-6">
              <h2 className="font-semibold text-ink">{t}</h2>
              <p className="mt-2 text-sm text-ink-600">{d}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {IS_BETA
            ? "We read every report, usually within 24 hours. We're not an emergency service: if you're in danger, call 999 in the UK or 112 in Nigeria."
            : "Prototype support is simulated and is not an emergency service. In a real emergency, contact your local emergency services."}
        </div>
      </main>
    </div>
  );
}
