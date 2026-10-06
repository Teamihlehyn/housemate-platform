// Fixed prototype configuration: London & Lagos pilots, questionnaire v1, rubric v1.

export const PROTOTYPE_BANNER =
  "Prototype — sample people, simulated checks, no real bookings";

export const ALGORITHM_VERSION = "match-v1";
export const PRIVACY_VERSION = "privacy-v1";
export const RUBRIC_VERSION = "rubric-v1";
export const QUESTIONNAIRE_VERSION = "q-v1";

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

export function questionLabel(dim: Dimension) {
  return QUESTIONNAIRE.find((q) => q.id === dim)!.label;
}
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
