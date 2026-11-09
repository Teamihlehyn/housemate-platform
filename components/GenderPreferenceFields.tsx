"use client";

import { IconLock } from "@/components/icons";
import { GENDERS, GENDER_IDS, OWN_GENDER_OPTIONS } from "@/lib/constants";

// Own gender + who you're open to living with. Private: used only for matching.
export default function GenderPreferenceFields({
  gender,
  accepts,
  onChange,
  errors = {},
  showPrivacyNote = true,
}: {
  gender: string | null;
  accepts: string[];
  onChange: (next: { gender: string | null; accepts: string[] }) => void;
  errors?: { gender?: string; genderPreference?: string };
  showPrivacyNote?: boolean;
}) {
  const everyone = GENDER_IDS.every((g) => accepts.includes(g));

  function toggle(id: string) {
    const next = accepts.includes(id) ? accepts.filter((g) => g !== id) : [...accepts, id];
    if (next.length) onChange({ gender, accepts: GENDER_IDS.filter((g) => next.includes(g)) });
  }

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="label">Your gender</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {OWN_GENDER_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={gender === o.id}
              onClick={() => onChange({ gender: o.id, accepts })}
              className="choice-chip"
            >
              {o.label}
            </button>
          ))}
        </div>
        {errors.gender && <p className="field-error">{errors.gender}</p>}
      </fieldset>

      <fieldset>
        <legend className="label">Who are you open to living with?</legend>
        <div className="flex flex-wrap gap-2">
          {GENDERS.map((g) => {
            const on = accepts.includes(g.id);
            return (
              <button
                key={g.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(g.id)}
                className="choice-chip"
              >
                {on ? "✓ " : ""}{g.plural}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-ink-600">
          {everyone
            ? "Open to anyone."
            : `Only ${GENDERS.filter((g) => accepts.includes(g.id)).map((g) => g.plural.toLowerCase()).join(" and ")}.`}{" "}
          {gender === "prefer_not_to_say" && "Because you'd rather not say, you'll be matched with people who are open to living with anyone."}
        </p>
        {errors.genderPreference && <p className="field-error">{errors.genderPreference}</p>}
      </fieldset>

      {showPrivacyNote && <p className="flex items-start gap-1.5 text-xs text-ink-600">
        <IconLock size={14} className="mt-0.5 shrink-0" />
        <span>Private — used only to match you. Never shown on your profile; matches work both ways, so nobody sees why someone isn&apos;t shown.</span>
      </p>}
    </div>
  );
}
