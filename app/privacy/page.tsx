import Link from "next/link";

export const metadata = { title: "Privacy notice — Housemate" };

export default function Privacy() {
  const sections: [string, string][] = [
    ["Who we are", "Housemate is an early-access service that helps people find compatible housemates and coordinate a shared move. This notice explains what personal data we collect and how we use it. It is the data controller for the information you provide."],
    ["What we collect", "Account and contact details (email, phone), your profile and search preferences (areas, budget, move-in dates, living habits, bio), messages you send to other members, and the outcome of identity verification (a yes/no result — we do not store copies of your identity documents). We do not ask for religion, ethnicity, sexual orientation, health, criminal history or income on your public profile."],
    ["How identity verification works", "During this pilot, identity is confirmed by our team through a short live check. We record only that the check passed or failed and the date — we do not keep your ID document or selfie."],
    ["Why we use it (lawful basis)", "To provide the service you asked for (performance of a contract), to keep members safe (legitimate interests), and with your consent for optional items. You can withdraw consent at any time."],
    ["Who can see what", "Other members see only your public profile: display name, areas, budget, move-in window, bio, selected habits and your verification badge. Your legal identity, contacts and exact address are never shown on profile cards."],
    ["How long we keep it", "We keep your data while your account is active and delete or minimise it after a retention period once you leave or delete your account. Verification results are kept only as long as needed to run the service."],
    ["Your rights", "You can access and export your data, correct it, pause your search, and request deletion at any time from Settings. Depending on your location you may also have rights under UK GDPR or Nigeria's NDPR, including the right to complain to a regulator."],
    ["Contact", "For any privacy question or request, contact the team at the email you were onboarded with. We respond to rights requests without undue delay."],
  ];
  return (
    <div className="min-h-screen font-sans">
      <header className="border-b border-ink/10 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" className="font-display font-semibold text-brand-700">← Housemate</Link>
          <Link href="/signin" className="btn-primary">Get started</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-3xl font-normal tracking-tightest text-ink">Privacy notice</h1>
        <p className="mt-2 text-sm text-ink/50">Early-access pilot · version privacy-v1</p>
        <div className="mt-8 space-y-6">
          {sections.map(([t, d]) => (
            <section key={t}>
              <h2 className="font-semibold text-ink">{t}</h2>
              <p className="mt-1.5 text-ink/70">{d}</p>
            </section>
          ))}
        </div>
        <div className="mt-10 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          This is a starting template for the pilot and should be reviewed and finalised with qualified data-protection advice before wider launch.
        </div>
      </main>
    </div>
  );
}
