"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import PublicShell, { PeaSays, TextLink } from "@/components/PublicShell";
import Pea from "@/components/brand/Pea";
import { api, ApiClientError, newIdempotencyKey } from "@/lib/client";
import { CITIES, CityId } from "@/lib/constants";
import { IconArrowRight, IconLock } from "@/components/icons";

// Invite-only beta (D15): anyone can ask for an invite. Contract:
// POST /api/v1/access-requests {name, email, city, area, move_in_month, how_heard?, note?, consent}
// → always 202 {status: "received"} (the response never says whether an email is known).

const OPEN_CITIES: CityId[] = ["lagos"];
const HOW_HEARD = [
  { id: "friend", label: "A friend" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "social", label: "Social media" },
  { id: "search", label: "Search" },
  { id: "other", label: "Somewhere else" },
];

function nextMonths(n: number) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    return {
      id: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }),
    };
  });
}

type Errors = Partial<Record<"name" | "email" | "city" | "area" | "move_in_month" | "consent" | "form", string>>;

export default function RequestAccess() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState<CityId | "">("");
  const [area, setArea] = useState("");
  const [month, setMonth] = useState("");
  const [howHeard, setHowHeard] = useState("");
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const key = useRef(newIdempotencyKey());
  const months = useMemo(() => nextMonths(12), []);
  const first = name.trim().split(/\s+/)[0];

  const clear = (k: keyof Errors) => setErrors((x) => (x[k] ? { ...x, [k]: undefined } : x));

  function validate(): Errors {
    const e: Errors = {};
    if (!name.trim()) e.name = "Tell us your first name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = "Enter an email address, like name@example.com.";
    if (!city) e.city = "Choose a city.";
    if (city && !area) e.area = "Choose an area, or “Not sure yet”.";
    if (!month) e.move_in_month = "Choose a month, or “Not sure yet”.";
    if (!consent) e.consent = "Tick this box so we can store your request.";
    return e;
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    const firstBad = Object.keys(e)[0];
    if (firstBad) {
      document.getElementById(`ra-${firstBad}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      await api("/access-requests", {
        body: {
          name: name.trim(),
          email: email.trim(),
          city,
          area,
          move_in_month: month,
          how_heard: howHeard || undefined,
          note: note.trim() || undefined,
          consent: true,
        },
        idempotencyKey: key.current,
      });
      setDone(true);
      window.scrollTo({ top: 0 });
    } catch (err) {
      const fe = (err as { fieldErrors?: Record<string, string> }).fieldErrors;
      if (fe && Object.keys(fe).length) {
        setErrors(fe as Errors);
        document.getElementById(`ra-${Object.keys(fe)[0]}`)?.focus();
      } else if (err instanceof ApiClientError && err.code !== "ERROR") {
        setErrors({ form: err.message });
      } else {
        setErrors({ form: "We couldn't send your request. Check your connection and try again. Your answers are still here." });
      }
    } finally {
      setBusy(false);
    }
  }

  if (done) return <Received first={first} city={city as CityId} />;

  const cityCfg = city ? CITIES[city] : null;
  const bubble = !first
    ? "Hi, I'm Pea. Peabudy is invite-only while we start small. Tell us a little and we'll be in touch."
    : !city
      ? `Nice to meet you, ${first}. Where are you looking?`
      : city === "lagos"
        ? "Lagos it is. We're starting there with a small group."
        : "We're starting in Lagos. Ask anyway and we'll tell you when London opens.";

  return (
    <PublicShell aside={<Link href="/signin" className="btn-ghost px-4">I have an invite</Link>}>
      <PeaSays mood={first ? "happy" : "awake"} friend={city ? "awake" : "sleep"}>
        <span aria-live="polite">{bubble}</span>
      </PeaSays>

      <h1 className="mt-6 font-display text-h1 text-ink md:text-h1-md">Request an invite</h1>
      <p className="mt-2 text-body text-ink-700">Five quick questions. It takes about a minute.</p>

      <form noValidate onSubmit={submit} className="mt-6 space-y-5">
        <div className="card space-y-5 p-5 sm:p-6">
          <Field id="name" label="Your first name" error={errors.name}>
            <input id="ra-name" className="input" value={name} onChange={(e) => { setName(e.target.value); clear("name"); }} autoComplete="given-name" maxLength={80}
              aria-invalid={!!errors.name} aria-describedby={errors.name ? "ra-name-err" : undefined} data-clarity-mask="true" />
          </Field>
          <Field id="email" label="Email address" error={errors.email} help="We'll send your invite link here.">
            <input id="ra-email" type="email" inputMode="email" className="input" value={email} onChange={(e) => { setEmail(e.target.value); clear("email"); }}
              autoComplete="email" placeholder="you@example.com" aria-invalid={!!errors.email}
              aria-describedby={`ra-email-help${errors.email ? " ra-email-err" : ""}`} data-clarity-mask="true" />
          </Field>
        </div>

        <div className="card p-5 sm:p-6">
          <p className="label" id="ra-city-label">Which city?</p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="ra-city-label" aria-describedby={errors.city ? "ra-city-err" : undefined}>
            {(["lagos", "london"] as CityId[]).map((id, i) => {
              const on = city === id;
              const open = OPEN_CITIES.includes(id);
              return (
                <button key={id} id={i === 0 ? "ra-city" : undefined} type="button" role="radio" aria-checked={on} aria-label={`${id === "lagos" ? "Lagos" : "London"}, ${open ? "open now" : "opening later"}`}
                  onClick={() => { setCity(id); setArea(""); setErrors((x) => ({ ...x, city: undefined })); }}
                  className={`flex min-h-[64px] flex-col items-start justify-center rounded-panel border px-4 py-2 text-left transition duration-quick focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${on ? "border-ink bg-ink text-cream" : "border-ink-400 bg-white text-ink hover:bg-ink-50"}`}>
                  <span className="font-semibold">{id === "lagos" ? "Lagos" : "London"}</span>
                  <span className={`text-caption ${on ? "text-cream/90" : "text-ink-600"}`}>{open ? "Open now" : "Opening later"}</span>
                </button>
              );
            })}
          </div>
          {errors.city && <p id="ra-city-err" className="field-error" role="alert">{errors.city}</p>}
          {city === "london" && (
            <p className="mt-3 rounded-field bg-sky-100 px-3 py-2.5 text-sm text-sky-800" role="status">
              We&apos;ll let you know when London opens. Your request is saved until then.
            </p>
          )}

          {cityCfg && (
            <div className="mt-5">
              <Field id="area" label={`Which part of ${city === "lagos" ? "Lagos" : "London"}?`} error={errors.area}>
                <select id="ra-area" className="input appearance-none bg-[length:16px] bg-[right_1rem_center] bg-no-repeat pr-10" value={area}
                  onChange={(e) => { setArea(e.target.value); clear("area"); }} aria-invalid={!!errors.area} aria-describedby={errors.area ? "ra-area-err" : undefined}
                  style={{ backgroundImage: CHEVRON }}>
                  <option value="">Choose an area</option>
                  {cityCfg.areas.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                  <option value="not_sure">Not sure yet</option>
                </select>
              </Field>
            </div>
          )}
        </div>

        <div className="card space-y-5 p-5 sm:p-6">
          <Field id="move_in_month" label="When would you like to move?" error={errors.move_in_month}>
            <select id="ra-move_in_month" className="input appearance-none bg-[length:16px] bg-[right_1rem_center] bg-no-repeat pr-10" value={month}
              onChange={(e) => { setMonth(e.target.value); clear("move_in_month"); }} aria-invalid={!!errors.move_in_month}
              aria-describedby={errors.move_in_month ? "ra-move_in_month-err" : undefined} style={{ backgroundImage: CHEVRON }}>
              <option value="">Choose a month</option>
              {months.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              <option value="not_sure">Not sure yet</option>
            </select>
          </Field>

          <fieldset>
            <legend className="label">How did you hear about us? <span className="font-normal text-ink-600">(optional)</span></legend>
            <div className="flex flex-wrap gap-2">
              {HOW_HEARD.map((h) => (
                <button key={h.id} type="button" aria-pressed={howHeard === h.id} className="choice-chip" onClick={() => setHowHeard(howHeard === h.id ? "" : h.id)}>
                  {howHeard === h.id && <span aria-hidden="true">✓</span>}
                  {h.label}
                </button>
              ))}
            </div>
          </fieldset>

          <Field id="note" label="Anything you'd like us to know?" optional help="For example, who you're hoping to live with. Please don't include ID numbers or your address.">
            <textarea id="ra-note" className="input min-h-[96px]" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)}
              aria-describedby="ra-note-help" data-clarity-mask="true" />
          </Field>
        </div>

        <label className={`flex min-h-[44px] items-start gap-3 rounded-field border p-3.5 text-sm ${errors.consent ? "border-danger-200 bg-danger-50" : "border-ink-100 bg-white"}`}>
          <input id="ra-consent" type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-ink" checked={consent}
            onChange={(e) => { setConsent(e.target.checked); setErrors((x) => ({ ...x, consent: undefined })); }}
            aria-describedby={errors.consent ? "ra-consent-err" : undefined} />
          <span className="text-ink-700">
            I agree that Peabudy can use these answers to decide who to invite and to email me about it, as described in the{" "}
            <a href="/privacy" target="_blank" className="font-semibold text-brand-700 underline underline-offset-2">privacy notice</a>.
            {errors.consent && <span id="ra-consent-err" className="mt-1 block font-medium text-danger-700" role="alert">{errors.consent}</span>}
          </span>
        </label>

        {errors.form && <p className="rounded-field border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700" role="alert">{errors.form}</p>}

        <button type="submit" className="btn-primary btn-lg w-full" aria-busy={busy}>
          {busy ? "Sending…" : <>Request my invite <IconArrowRight size={18} /></>}
        </button>
        <p className="flex items-start justify-center gap-1.5 text-center text-caption text-ink-600">
          <IconLock size={14} className="mt-0.5 shrink-0" />
          We only use this to review your request and send your invite.
        </p>
      </form>
    </PublicShell>
  );
}

const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%234a4740' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

function Field({ id, label, error, help, optional, children }: { id: string; label: string; error?: string; help?: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={`ra-${id}`}>
        {label} {optional && <span className="font-normal text-ink-600">(optional)</span>}
      </label>
      {children}
      {help && <p id={`ra-${id}-help`} className="helper">{help}</p>}
      {error && <p id={`ra-${id}-err`} className="field-error" role="alert">{error}</p>}
    </div>
  );
}

function Received({ first, city }: { first: string; city: CityId }) {
  const london = city === "london";
  return (
    <PublicShell>
      <div className="flex flex-col items-center pt-4 text-center">
        <div className="flex items-end" aria-hidden="true">
          <Pea size={84} mood="happy" className="animate-pop-in" />
          <Pea size={68} mood="wink" tone="fresh" className="-ml-3 animate-pop-in [animation-delay:120ms]" />
        </div>
        <h1 className="mt-5 font-display text-h1 text-ink md:text-h1-md" tabIndex={-1} ref={(el) => el?.focus()}>
          Thanks{first ? `, ${first}` : ""}. We&apos;ve got your request.
        </h1>
        <p className="mt-3 max-w-md text-body-lg text-ink-700">
          {london
            ? "We're starting in Lagos, and we'll keep London requests for when we open there. We read every request."
            : "We read every request. If it's a fit, we'll email you an invite link, usually within 2 days."}
        </p>
      </div>

      <div className="card mt-8 p-5 sm:p-6">
        <h2 className="text-h3 text-ink">What happens next</h2>
        <ol className="mt-3 space-y-3 text-sm text-ink-700">
          {[
            london ? "We keep your request until London opens." : "A person on our team reads your request.",
            "If we can invite you, your personal invite link comes from hello@peabudy.com. It works for 14 days. Check your junk folder too.",
            "With the link, you sign in, set up your profile and book a short video call so we can check your ID before you see anyone.",
          ].map((t, i) => (
            <li key={i} className="flex gap-3">
              <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full bg-pea-100 text-sm font-bold text-ink" aria-hidden="true">{i + 1}</span>
              <span className="pt-1">{t}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 rounded-field bg-cream px-3 py-2.5 text-sm text-ink-700">
          Peabudy never asks for money, and nobody from our team will ask for a fee to speed things up.
        </p>
      </div>

      <div className="mt-6 flex flex-col items-center gap-1 text-sm text-ink-700">
        <TextLink href="/">Back to the home page</TextLink>
        <span>Already have an invite? <TextLink href="/signin">Sign in</TextLink></span>
      </div>
    </PublicShell>
  );
}
