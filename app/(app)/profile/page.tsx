"use client";

// Your profile, and where users change their answers (approval-first: /onboarding sends
// published users here). Each section edits with the same question components as /join,
// one section at a time, saved through the same PATCH /me/profile and /me/search calls.
// The display name is locked once it has been checked against photo ID (nameLocked).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/client";
import { formatMoney } from "@/lib/money";
import { formatDateRange } from "@/lib/dates";
import { CITIES, GENDERS, GENDER_IDS, JOURNEYS, OWN_GENDER_OPTIONS, QUESTIONNAIRE, answerLabel } from "@/lib/constants";
import { ChecksCard } from "@/components/ChecksCard";
import StepBody from "@/components/apply/StepBody";
import { HABIT_IDS, ScreenId, useProfileDraft } from "@/components/apply/useProfileDraft";
import { CITY_VISUALS } from "@/components/apply/CityCard";
import { IconLock } from "@/components/icons";

const IS_BETA = process.env.NEXT_PUBLIC_APP_ENV === "beta";

type SectionKey = "about" | "where" | "money" | "habits" | "private";

export default function Profile() {
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState<SectionKey | null>(null);
  const d = useProfileDraft();
  const { hydrate } = d;

  const load = useCallback(
    () => api<any>("/me").then((m) => { setMe(m); hydrate(m); }).finally(() => setLoading(false)),
    [hydrate],
  );
  useEffect(() => { load(); }, [load]);

  async function status(action: string) {
    setMsg(null);
    try { await api("/me/search/status", { body: { action } }); await load(); }
    catch (e) { setMsg({ ok: false, text: e instanceof ApiClientError ? e.message : "We couldn't change that. Try again." }); }
  }

  if (loading) return <div className="skeleton h-64" aria-busy="true" aria-label="Loading your profile" />;
  if (!me) return null;

  const s = me.search;
  const city = s?.cityId ? CITIES[s.cityId as keyof typeof CITIES] : null;
  const published = me.profile?.publicationStatus === "published";
  const nameLocked = me.nameLocked === true;

  if (!published) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <h1 className="font-display text-h1 text-ink">Finish setting up your profile</h1>
        <p className="mt-2 text-sm text-ink-600">You haven&apos;t published yet.</p>
        <Link href="/onboarding" className="btn-primary mt-4">Continue onboarding</Link>
      </div>
    );
  }

  const accepts: string[] = s.genderPreference ?? [...GENDER_IDS];
  const areaLabels = s.areas.map((a: string) => city?.areas.find((x) => x.id === a)?.label).join(", ");
  const visual = s.cityId ? CITY_VISUALS[s.cityId as keyof typeof CITY_VISUALS] : null;

  function edit(k: SectionKey) {
    setMsg(null);
    d.setErrors({});
    hydrate(me); // start from what's saved
    setEditing(k);
  }
  function cancel() {
    d.setErrors({});
    hydrate(me);
    setEditing(null);
  }
  async function save(screens: ScreenId[], okText: string) {
    const r = await d.save(screens);
    if (r.ok) {
      setEditing(null);
      setMsg({ ok: true, text: okText });
      await load();
      return;
    }
    if (r.message) setMsg({ ok: false, text: r.message });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-h1 text-ink">Your profile</h1>
        <span className={`chip ${s.status === "active" ? "bg-brand-100 text-brand-800" : "bg-ink-100 text-ink-700"}`}>
          {s.status === "active" ? "Search on" : s.status === "paused" ? "Search paused" : `Search ${s.status}`}
        </span>
      </div>

      {msg && (
        <div role={msg.ok ? "status" : "alert"} className={`mb-4 rounded-field border px-4 py-2.5 text-sm ${msg.ok ? "border-brand-200 bg-brand-50 text-brand-800" : "border-danger-200 bg-danger-50 text-danger-700"}`}>
          {msg.text}
        </div>
      )}

      {/* Header card: what other people see first */}
      <div className="card overflow-hidden">
        {visual && (
          <div className="relative h-24 sm:h-28" aria-hidden="true">
            <img src={visual.src} alt="" className="h-full w-full object-cover" style={{ objectPosition: visual.position }} loading="lazy" decoding="async" />
            <span className="absolute inset-0 bg-gradient-to-t from-[rgb(20_19_16/0.5)] to-transparent" />
          </div>
        )}
        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-100 text-lg font-bold text-brand-700 ${visual ? "-mt-12 ring-4 ring-white" : ""}`}>{me.profile.avatarInitials}</span>
            <div className="min-w-0">
              <h2 className="text-h2 text-ink" data-clarity-mask="true">{me.displayName}</h2>
              <p className="text-sm text-ink-600">{city?.label.replace(/ pilot$/, "")} · {areaLabels}</p>
            </div>
          </div>
          <p className="mt-4 whitespace-pre-line text-ink-700" data-clarity-mask="true">{me.profile.bio}</p>
        </div>
      </div>

      {/* Beta: completed checks, no number (ENG-04). Demo modes keep the labelled breakdown. */}
      {IS_BETA ? (
        <ChecksCard checks={me.credibility.checks ?? []} own as="h3" />
      ) : (
        <div className="card mt-4 p-5 sm:p-6">
          <h3 className="font-semibold text-ink">Demo credibility: {me.credibility.score}/100</h3>
          <p className="text-xs text-ink-600">Checks completed — not a guarantee of safety.</p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {me.credibility.components.map((c: any) => (
              <li key={c.category} className="flex justify-between border-b border-ink-100 pb-1.5">
                <span className="capitalize text-ink-600">{c.category === "additional" ? "Additional evidence" : c.category}</span>
                <span className={c.earned > 0 ? "font-medium text-ink" : "text-ink-600"}>{c.earned}/{c.available}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="mt-8 text-h2 text-ink">Your answers</h2>
      <p className="mt-1 text-sm text-ink-600">Changes to dates, budget, areas or habits update who you match with straight away.</p>

      <Section
        title="About you"
        open={editing === "about"}
        onEdit={() => edit("about")}
        onCancel={cancel}
        onSave={() => save(nameLocked ? ["journey", "bio"] : ["name", "journey", "bio"], "Saved. Your profile is updated.")}
        busy={d.saveState === "saving"}
        rows={[
          ["Name", me.displayName],
          ["Looking to", JOURNEYS.find((j) => j.id === me.profile.journey)?.label ?? "—"],
          ["Bio", me.profile.bio ? `${me.profile.bio.slice(0, 80)}${me.profile.bio.length > 80 ? "…" : ""}` : "—"],
        ]}
      >
        {nameLocked ? (
          <div>
            <p className="label">Name</p>
            <p className="flex items-start gap-2 rounded-field bg-cream px-4 py-3 text-sm text-ink-700">
              <IconLock size={16} className="mt-0.5 shrink-0 text-ink-600" />
              <span>
                <strong className="font-semibold text-ink" data-clarity-mask="true">{me.displayName}</strong>. Checked with your photo ID, so it can&apos;t be changed here. If it&apos;s wrong, email{" "}
                <a href="mailto:hello@peabudy.com" className="font-semibold text-brand-700 underline underline-offset-2">hello@peabudy.com</a>.
              </span>
            </p>
          </div>
        ) : (
          <StepBody screen="name" d={d} compact idPrefix="p-" />
        )}
        <StepBody screen="journey" d={d} compact idPrefix="p-" />
        <StepBody screen="bio" d={d} compact idPrefix="p-" />
      </Section>

      <Section
        title="Where"
        open={editing === "where"}
        onEdit={() => edit("where")}
        onCancel={cancel}
        onSave={() => save(["areas", "location"], "Saved. Your matches now use these areas.")}
        busy={d.saveState === "saving"}
        rows={[
          ["City", city?.label.replace(/ pilot$/, "") ?? "—"],
          ["Areas", areaLabels || "—"],
          ["Address (private)", s.locationDetail ? "Added" : "Not added"],
        ]}
      >
        <p className="rounded-field bg-cream px-4 py-3 text-sm text-ink-700">
          City: <strong className="font-semibold text-ink">{city?.label.replace(/ pilot$/, "")}</strong>. To move to another city, email{" "}
          <a href="mailto:hello@peabudy.com" className="font-semibold text-brand-700 underline underline-offset-2">hello@peabudy.com</a>.
        </p>
        <StepBody screen="areas" d={d} compact idPrefix="p-" />
        <StepBody screen="location" d={d} compact idPrefix="p-" />
      </Section>

      <Section
        title="Money and dates"
        open={editing === "money"}
        onEdit={() => edit("money")}
        onCancel={cancel}
        onSave={() => save(["budget", "dates", "stay"], "Saved. Your matches now use these dates and budget.")}
        busy={d.saveState === "saving"}
        rows={[
          ["Budget", `${formatMoney(s.rentMinMinor, s.currency)}–${formatMoney(s.rentMaxMinor, s.currency)} per ${s.rentPeriod === "year" ? "year" : "month"}`],
          ["Move-in", s.earliestDate ? formatDateRange(s.earliestDate, s.latestDate) : "Flexible"],
          ["Stay", `${s.stayMinMonths}–${s.stayMaxMonths} months`],
        ]}
      >
        <StepBody screen="budget" d={d} compact idPrefix="p-" />
        <StepBody screen="dates" d={d} compact idPrefix="p-" />
        <StepBody screen="stay" d={d} compact idPrefix="p-" />
      </Section>

      <Section
        title="Living habits"
        open={editing === "habits"}
        onEdit={() => edit("habits")}
        onCancel={cancel}
        onSave={() => save(HABIT_IDS, "Saved. Your matches now use these habits.")}
        busy={d.saveState === "saving"}
        rows={QUESTIONNAIRE.map((q) => {
          const p = s.preferences.find((x: any) => x.dimension === q.id);
          const flexible = p && p.acceptedValues.length === q.values.length;
          return [q.label, p ? `${answerLabel(q.id, p.ownAnswer)}${flexible ? "" : " · has a dealbreaker"}` : "—"] as [string, string];
        })}
      >
        {HABIT_IDS.map((h) => (
          <div key={h} className="border-t border-ink-100 pt-5 first:border-0 first:pt-0">
            <StepBody screen={h} d={d} compact idPrefix="p-" />
          </div>
        ))}
      </Section>

      <Section
        title="Housemate gender"
        note="Private: only used to match you, never shown on your profile."
        open={editing === "private"}
        onEdit={() => edit("private")}
        onCancel={cancel}
        onSave={() => save(["gender", "genderPref"], "Saved. Your matches now reflect your housemate gender preference.")}
        busy={d.saveState === "saving"}
        rows={[
          ["Your gender", OWN_GENDER_OPTIONS.find((o) => o.id === s.gender)?.label ?? "Not set"],
          ["Open to living with", GENDER_IDS.every((g) => accepts.includes(g)) ? "Anyone" : GENDERS.filter((g) => accepts.includes(g.id)).map((g) => g.plural).join(", ")],
        ]}
      >
        <StepBody screen="gender" d={d} compact idPrefix="p-" />
        <StepBody screen="genderPref" d={d} compact idPrefix="p-" />
      </Section>

      <div className="mt-6 flex flex-wrap gap-2">
        {s.status === "active" && <button className="btn-secondary" onClick={() => status("pause")}>Pause search</button>}
        {s.status === "paused" && <button className="btn-primary" onClick={() => status("resume")}>Resume search</button>}
        <Link href="/settings" className="btn-secondary">Settings &amp; privacy</Link>
      </div>
    </div>
  );
}

function Section({
  title, note, rows, open, onEdit, onCancel, onSave, busy, children,
}: {
  title: string;
  note?: string;
  rows: [string, string][];
  open: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  busy: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="card mt-4 p-5 sm:p-6" aria-label={title}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-h3 text-ink">{title}</h3>
          {note && <p className="text-xs text-ink-600">{note}</p>}
        </div>
        {!open && (
          <button type="button" className="btn-secondary shrink-0 px-4" onClick={onEdit}>
            Edit<span className="sr-only"> {title.toLowerCase()}</span>
          </button>
        )}
      </div>
      {open ? (
        <form
          className="mt-4 space-y-6"
          noValidate
          onSubmit={(e) => { e.preventDefault(); onSave(); }}
          ref={(el) => { if (el && !el.dataset.focused) { el.dataset.focused = "1"; (el.querySelector("input, textarea, button") as HTMLElement | null)?.focus(); } }}
        >
          {children}
          <div className="flex flex-col gap-2 border-t border-ink-100 pt-4 sm:flex-row">
            <button className="btn-primary" aria-busy={busy}>{busy ? "Saving…" : "Save changes"}</button>
            <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
          </div>
        </form>
      ) : (
        <dl className="mt-3 grid gap-x-6 sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-ink-100 py-2 text-sm">
              <dt className="shrink-0 text-ink-600">{k}</dt>
              <dd className="min-w-0 text-right font-medium text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
