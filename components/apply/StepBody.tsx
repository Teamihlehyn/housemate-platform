"use client";

// One question's controls, for any screen of the profile flow. The conversational flow
// (/join, /onboarding) shows one per page with a big heading; /profile's section editors
// stack a few with `compact` headings. Same wording, same options, same values everywhere.

import { RefObject } from "react";
import { CITIES, GENDERS, GENDER_IDS, JOURNEYS, OWN_GENDER_OPTIONS, QUESTIONNAIRE, CityId } from "@/lib/constants";
import { formatMoney, monthlyEquivalentMinor } from "@/lib/money";
import { IconCheck } from "@/components/icons";
import { FieldError, HABIT_ASK, JourneyArt, MoneyInput, NameTag, OptionCard, Question, RadioRow, Reassure, Stepper } from "./fields";
import CityCard from "./CityCard";
import type { Draft, ScreenId } from "./useProfileDraft";

export default function StepBody({
  screen,
  d,
  headingRef,
  compact = false,
  idPrefix = "",
  cityBadges,
  idCheck = false,
}: {
  screen: ScreenId;
  d: Draft;
  headingRef?: RefObject<HTMLHeadingElement | null>;
  /** Smaller headings for the /profile editors. */
  compact?: boolean;
  /** Keeps ids unique when several screens are on one page. */
  idPrefix?: string;
  /** Status chip on a city card, e.g. London "Opening later" during the Lagos pilot (F4). */
  cityBadges?: Partial<Record<CityId, string>>;
  /** True in the application, where the name is checked against photo ID on the call. */
  idCheck?: boolean;
}) {
  const errors = d.errors;
  const cityCfg = d.city ? CITIES[d.city] : null;
  const id = (s: string) => `${idPrefix}${s}`;
  const qp = { refEl: headingRef, compact };
  const gap = compact ? "mt-3" : "mt-4";

  if (screen === "name")
    return (
      <>
        <Question {...qp} htmlFor={id("dn")}>What should we call you?</Question>
        {!compact && <NameTag name={d.displayName} />}
        <input
          id={id("dn")}
          className={`input ${gap} ${compact ? "" : "text-lg"}`}
          value={d.displayName}
          onChange={(e) => d.setDisplayName(e.target.value)}
          placeholder="e.g. Tolu"
          autoComplete="given-name"
          maxLength={40}
          aria-invalid={!!errors.displayName}
          aria-describedby={id("dn-help")}
          data-clarity-mask="true"
        />
        <FieldError msg={errors.displayName} />
        <Reassure id={id("dn-help")} icon="eye">
          {idCheck ? "Your first name, as it is on your photo ID: we check it on the ID call. Shown on your profile." : "Your first name. Shown on your profile."}
        </Reassure>
      </>
    );

  if (screen === "journey")
    return (
      <fieldset>
        <Question {...qp} legend>What are you looking to do?</Question>
        <div className={`${gap} space-y-3`} role="radiogroup">
          {JOURNEYS.map((j, i) => (
            <OptionCard key={j.id} checked={d.journey === j.id} onClick={() => d.setJourney(j.id)} title={j.label} help={j.help} art={<JourneyArt kind={i} />} />
          ))}
        </div>
        <FieldError msg={errors.journey} />
      </fieldset>
    );

  if (screen === "city")
    return (
      <fieldset>
        <Question {...qp} legend>Which city?</Question>
        <div className={`${gap} grid gap-4 sm:grid-cols-2`} role="radiogroup">
          {/* Open cities first: a city with a status chip (e.g. "Opening later") goes last. */}
          {(Object.keys(CITIES) as CityId[]).sort((x, y) => Number(!!cityBadges?.[x]) - Number(!!cityBadges?.[y])).map((c) => (
            <CityCard key={c} city={c} checked={d.city === c} onClick={() => d.chooseCity(c)} sub={`Rent usually per ${CITIES[c].defaultPeriod}`} badge={cityBadges?.[c]} />
          ))}
        </div>
        <FieldError msg={errors.city || errors.cityId} />
      </fieldset>
    );

  if (screen === "areas")
    return cityCfg ? (
      <fieldset>
        <Question {...qp} legend>Which areas would you live in?</Question>
        <p className="helper">Pick up to 5. You&apos;ll only see people who share at least one.</p>
        <div className={`${gap} flex flex-wrap gap-2`}>
          {cityCfg.areas.map((a) => {
            const on = d.areas.includes(a.id);
            const full = !on && d.areas.length >= 5;
            return (
              <button key={a.id} type="button" aria-pressed={on} onClick={() => d.toggleArea(a.id)} aria-disabled={full} className={`choice-chip ${full ? "opacity-60" : ""}`}>
                {on && <IconCheck size={16} strokeWidth={2.5} />}
                {a.label}
              </button>
            );
          })}
        </div>
        <p className="num mt-3 text-sm font-medium text-ink-700" aria-live="polite">{d.areas.length} of 5 chosen</p>
        <FieldError msg={errors.areas || errors.areaIds} />
      </fieldset>
    ) : (
      <p className="text-sm text-ink-700">Choose a city first.</p>
    );

  if (screen === "location")
    return (
      <>
        <Question {...qp} htmlFor={id("loc")}>
          {d.city === "london" ? "Postcode or address" : "Address"} <span className="text-ink-600">(optional)</span>
        </Question>
        <input
          id={id("loc")}
          className={`input ${gap}`}
          value={d.locationDetail}
          onChange={(e) => d.setLocationDetail(e.target.value)}
          placeholder={d.city === "london" ? "e.g. E8 3RH, or a street you have in mind" : "e.g. a street in Yaba you have in mind"}
          maxLength={200}
          aria-describedby={id("loc-help")}
          data-clarity-mask="true"
        />
        <FieldError msg={errors.locationDetail} />
        <Reassure id={id("loc-help")}>Private: only you see this. It never appears on your profile.</Reassure>
      </>
    );

  if (screen === "budget")
    return cityCfg ? (
      <fieldset>
        <Question {...qp} legend>What&apos;s your rent budget, per person?</Question>
        <div className={`${gap} inline-flex rounded-full bg-white p-1 ring-1 ring-ink-100`} role="radiogroup" aria-label="Budget period">
          {(["month", "year"] as const).map((p) => (
            <button key={p} type="button" role="radio" aria-checked={d.period === p} onClick={() => d.setPeriod(p)}
              className={`min-h-[44px] rounded-full px-5 text-sm font-semibold ${d.period === p ? "bg-ink text-cream" : "text-ink-700"}`}>
              Per {p}
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <MoneyInput id={id("rmin")} label="From" currency={cityCfg.currency} value={d.rentMin} onChange={d.setRentMin} error={errors.rentMinMinor} />
          <MoneyInput id={id("rmax")} label="Up to" currency={cityCfg.currency} value={d.rentMax} onChange={d.setRentMax} error={errors.rentMaxMinor} />
        </div>
        {d.period === "year" && parseFloat(d.rentMin) > 0 && parseFloat(d.rentMax) > 0 && (
          <p className="num mt-3 text-sm text-ink-700">
            About {formatMoney(monthlyEquivalentMinor(Math.round(parseFloat(d.rentMin) * 100), "year"), cityCfg.currency)}–
            {formatMoney(monthlyEquivalentMinor(Math.round(parseFloat(d.rentMax) * 100), "year"), cityCfg.currency)} a month.
          </p>
        )}
        <FieldError msg={errors.rentPeriod} />
        <Reassure icon="eye">People you match with see this range, so they know it fits. Matching only needs your ranges to overlap.</Reassure>
      </fieldset>
    ) : (
      <p className="text-sm text-ink-700">Choose a city first, so we know the currency.</p>
    );

  if (screen === "dates")
    return (
      <fieldset>
        <Question {...qp} legend>When can you move in?</Question>
        <div className={`${gap} inline-flex rounded-full bg-white p-1 ring-1 ring-ink-100`} role="radiogroup" aria-label="Move-in timing">
          {(["exact", "range"] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={d.moveMode === m} onClick={() => d.setMoveMode(m)}
              className={`min-h-[44px] rounded-full px-5 text-sm font-semibold ${d.moveMode === m ? "bg-ink text-cream" : "text-ink-700"}`}>
              {m === "exact" ? "Exact date" : "Date range"}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 min-[400px]:grid-cols-2">
          <div>
            <label className="label" htmlFor={id("e")}>{d.moveMode === "exact" ? "Move-in date" : "Earliest"}</label>
            <input id={id("e")} type="date" className="input" value={d.earliest} onChange={(e) => d.setEarliest(e.target.value)} aria-invalid={!!errors.earliestDate} />
            <FieldError msg={errors.earliestDate} />
          </div>
          {d.moveMode === "range" && (
            <div>
              <label className="label" htmlFor={id("l")}>Latest</label>
              <input id={id("l")} type="date" className="input" value={d.latest} onChange={(e) => d.setLatest(e.target.value)} aria-invalid={!!errors.latestDate} />
              <FieldError msg={errors.latestDate} />
            </div>
          )}
        </div>
        <FieldError msg={errors.moveMode || errors.preferredDate} />
        <p className="helper">A range gives you more matches. It must be within the next 18 months.</p>
      </fieldset>
    );

  if (screen === "stay")
    return (
      <fieldset>
        <Question {...qp} legend>How long do you want to stay?</Question>
        <div className={`${gap} grid grid-cols-2 gap-3`}>
          <Stepper id={id("sm")} label="At least" value={d.stayMin} onChange={d.setStayMin} min={1} max={24} error={errors.stayMinMonths} />
          <Stepper id={id("sx")} label="At most" value={d.stayMax} onChange={d.setStayMax} min={1} max={36} error={errors.stayMaxMonths} />
        </div>
        <p className="helper">In months. You&apos;ll match with people whose range overlaps yours.</p>
      </fieldset>
    );

  if (screen === "gender")
    return (
      <fieldset>
        <Question {...qp} legend>What&apos;s your gender?</Question>
        <div className={`${gap} space-y-2`} role="radiogroup">
          {OWN_GENDER_OPTIONS.map((o) => (
            <RadioRow key={o.id} checked={d.gender === o.id} onClick={() => d.setGender(o.id)} label={o.label} />
          ))}
        </div>
        <FieldError msg={errors.gender} />
        <Reassure>Private: used only to match you. Never shown on your profile.</Reassure>
      </fieldset>
    );

  if (screen === "genderPref")
    return (
      <fieldset>
        <Question {...qp} legend>Who are you open to living with?</Question>
        <div className={`${gap} space-y-2`}>
          {GENDERS.map((g) => (
            <RadioRow key={g.id} multi checked={d.genderAccepts.includes(g.id)} onClick={() => d.toggleGenderAccept(g.id)} label={g.plural} />
          ))}
        </div>
        <p className="mt-3 text-sm font-medium text-ink-700" aria-live="polite">
          {d.genderAccepts.length === GENDER_IDS.length
            ? "Open to anyone."
            : `Only ${GENDERS.filter((g) => d.genderAccepts.includes(g.id)).map((g) => g.plural.toLowerCase()).join(" and ")}.`}{" "}
          {d.gender === "prefer_not_to_say" && "Because you'd rather not say, you'll be matched with people who are open to living with anyone."}
        </p>
        <FieldError msg={errors.genderPreference} />
        <Reassure>Private, and it works both ways: nobody sees why someone isn&apos;t shown.</Reassure>
      </fieldset>
    );

  if (screen === "bio")
    return (
      <>
        <Question {...qp} htmlFor={id("bio")}>Tell people a bit about you</Question>
        <textarea
          id={id("bio")}
          className={`input ${gap} min-h-[160px] leading-relaxed`}
          value={d.bio}
          onChange={(e) => d.setBio(e.target.value)}
          maxLength={600}
          aria-describedby={`${id("bio-count")} ${id("bio-help")}`}
          aria-invalid={!!errors.bio}
          placeholder="Your routine, what you're looking for, and what makes you easy to live with."
          data-clarity-mask="true"
        />
        <p id={id("bio-count")} className={`num mt-1.5 text-sm font-medium ${d.bio.trim().length >= 80 ? "text-brand-700" : "text-ink-600"}`}>
          {d.bio.trim().length < 80 ? `${80 - d.bio.trim().length} more characters to go` : `✓ ${d.bio.length} / 600`}
        </p>
        <FieldError msg={errors.bio} />
        <Reassure id={id("bio-help")} icon="eye">Shown on your profile. Don&apos;t include your address or phone number.</Reassure>
      </>
    );

  if (screen.startsWith("h:")) {
    const q = QUESTIONNAIRE.find((x) => `h:${x.id}` === screen)!;
    const p = d.prefs[q.id];
    const ruledOut = q.values.filter((v) => !p.accepted.includes(v.id));
    return (
      <div>
        <fieldset>
          <Question {...qp} legend>{compact ? q.label : HABIT_ASK[q.id].q}</Question>
          {compact && <p className="helper mt-0.5">{HABIT_ASK[q.id].q}</p>}
          <div className={`${gap} space-y-2`} role="radiogroup">
            {q.values.map((v) => (
              <RadioRow key={v.id} checked={p.own === v.id} onClick={() => d.setOwn(q.id, v.id)} label={v.label} />
            ))}
          </div>
        </fieldset>
        <fieldset className={compact ? "mt-4" : "mt-6"}>
          <legend className={compact ? "text-sm font-semibold text-ink" : "text-h3 text-ink"}>{HABIT_ASK[q.id].accept}</legend>
          <p className="helper mt-0.5">Untick any answer that would be a dealbreaker.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {q.values.map((v) => (
              <button key={v.id} type="button" role="checkbox" aria-checked={p.accepted.includes(v.id)} onClick={() => d.toggleAccepted(q.id, v.id)} className="choice-chip">
                {p.accepted.includes(v.id) ? <IconCheck size={16} strokeWidth={2.5} /> : <span aria-hidden="true" className="h-4 w-4 rounded-full border-2 border-ink-400" />}
                {v.label}
              </button>
            ))}
          </div>
          <p className={`mt-3 rounded-field px-3 py-2 text-sm font-medium ${ruledOut.length ? "bg-apricot-100 text-apricot-800" : "bg-white text-ink-700 ring-1 ring-ink-100"}`} aria-live="polite">
            {ruledOut.length
              ? `Dealbreaker: you won't be matched with people who say “${ruledOut.map((v) => v.label).join("” or “")}”.`
              : "Flexible: any answer is fine with you."}
          </p>
        </fieldset>
        <FieldError msg={errors.preferences} />
      </div>
    );
  }

  return null;
}
