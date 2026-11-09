// Fixed configuration: London & Lagos, questionnaire v1, rubric v1.

export const ALGORITHM_VERSION = "match-v1";
export const PRIVACY_VERSION = "privacy-v1";

export type CityId = "london" | "lagos";

export const CITIES: Record<
  CityId,
  { id: CityId; label: string; country: "GB" | "NG"; currency: "GBP" | "NGN"; timezone: string; defaultPeriod: "month" | "year"; areas: { id: string; label: string }[] }
> = {
  london: {
    id: "london",
    label: "London pilot",
    country: "GB",
    currency: "GBP",
    timezone: "Europe/London",
    defaultPeriod: "month",
    areas: [
      { id: "hackney", label: "Hackney" },
      { id: "islington", label: "Islington" },
      { id: "camden", label: "Camden" },
      { id: "lewisham", label: "Lewisham" },
      { id: "walthamstow", label: "Walthamstow" },
      { id: "brixton", label: "Brixton" },
    ],
  },
  lagos: {
    id: "lagos",
    label: "Lagos pilot",
    country: "NG",
    currency: "NGN",
    timezone: "Africa/Lagos",
    defaultPeriod: "year",
    areas: [
      { id: "yaba", label: "Yaba" },
      { id: "lekki", label: "Lekki" },
      { id: "ikeja", label: "Ikeja" },
      { id: "surulere", label: "Surulere" },
      { id: "gbagada", label: "Gbagada" },
      { id: "ikoyi", label: "Ikoyi" },
    ],
  },
};

export const JOURNEYS = [
  { id: "find_together", label: "Find a place together", help: "You and a future housemate search for a home from scratch." },
  { id: "candidate_home", label: "I have a place in mind", help: "You have a candidate property and want a housemate for it." },
  { id: "existing_room", label: "I have a room to offer", help: "You already live somewhere and have one room to fill." },
] as const;

export type Dimension = "cleaning" | "quiet" | "guests" | "smoking" | "pets" | "social";

export const QUESTIONNAIRE: {
  id: Dimension;
  label: string;
  values: { id: string; label: string }[];
}[] = [
  {
    id: "cleaning",
    label: "How often do you clean shared spaces?",
    values: [
      { id: "daily", label: "Daily" },
      { id: "several_times_weekly", label: "Several times a week" },
      { id: "weekly", label: "Weekly" },
    ],
  },
  {
    id: "quiet",
    label: "Weekday quiet period",
    values: [
      { id: "before_22", label: "Quiet before 10pm" },
      { id: "before_00", label: "Quiet before midnight" },
      { id: "no_fixed_time", label: "No fixed time" },
    ],
  },
  {
    id: "guests",
    label: "Overnight guests",
    values: [
      { id: "never", label: "Never" },
      { id: "up_to_2_nights", label: "Up to 2 nights" },
      { id: "more_than_2", label: "More than 2 nights" },
    ],
  },
  {
    id: "smoking",
    label: "Smoking at home",
    values: [
      { id: "no", label: "No" },
      { id: "yes", label: "Yes" },
    ],
  },
  {
    id: "pets",
    label: "Pets",
    values: [
      { id: "none", label: "No pets" },
      { id: "has_pet", label: "Has a pet" },
    ],
  },
  {
    id: "social",
    label: "Social home",
    values: [
      { id: "mostly_private", label: "Mostly private" },
      { id: "balanced", label: "Balanced" },
      { id: "mostly_social", label: "Mostly social" },
    ],
  },
];

export function answerLabel(dim: Dimension, value: string) {
  return QUESTIONNAIRE.find((q) => q.id === dim)!.values.find((v) => v.id === value)?.label ?? value;
}

// Credibility rubric v1
export const RUBRIC = {
  identity: 40,
  email: 10,
  phone: 10,
  reference: 20,
  additional: 20,
} as const;

// Safety report categories (block/report flow).
export const REPORT_CATEGORIES = [
  { id: "scam_money_request", label: "Asked for money or seems like a scam" },
  { id: "harassment", label: "Harassment or abusive messages" },
  { id: "identity_issue", label: "Not who they say they are" },
  { id: "unsafe_property", label: "Unsafe or fake property" },
  { id: "threat", label: "Threat to someone's safety" },
  { id: "other", label: "Something else" },
] as const;

// Housemate gender preference. Private: used only for matching, never shown publicly.
export const GENDERS = [
  { id: "woman", label: "Woman", plural: "Women" },
  { id: "man", label: "Man", plural: "Men" },
  { id: "non_binary", label: "Non-binary or another gender", plural: "Non-binary & other genders" },
] as const;
export const GENDER_IDS: string[] = GENDERS.map((g) => g.id);
export const OWN_GENDER_OPTIONS = [
  ...GENDERS.map((g) => ({ id: g.id as string, label: g.label as string })),
  { id: "prefer_not_to_say", label: "Prefer not to say" },
];

export function parseGenderPreference(raw: string | null | undefined): string[] {
  try {
    const v = JSON.parse(raw ?? "");
    const ok = Array.isArray(v) ? v.filter((g) => GENDER_IDS.includes(g)) : [];
    return ok.length ? ok : [...GENDER_IDS];
  } catch {
    return [...GENDER_IDS];
  }
}

// Would someone who accepts `accepts` be happy living with a person of `gender`?
// Open-to-anyone accepts everyone (including "prefer not to say"); otherwise the
// person's stated gender must be in the accepted set.
function acceptsGender(accepts: string[], gender: string | null | undefined): boolean {
  if (GENDER_IDS.every((g) => accepts.includes(g))) return true;
  return !!gender && gender !== "prefer_not_to_say" && accepts.includes(gender);
}

// Two-way check, like the living-habit dealbreakers.
export function gendersCompatible(
  a: { gender: string | null | undefined; accepts: string[] },
  b: { gender: string | null | undefined; accepts: string[] }
): boolean {
  return acceptsGender(b.accepts, a.gender) && acceptsGender(a.accepts, b.gender);
}
