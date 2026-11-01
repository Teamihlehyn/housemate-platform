// Persona templates for user testing. Pure data so the sign-in page can import it.

import { CityId } from "./constants";

export type Habits = Record<string, string>;

const H = (o: Partial<Habits> = {}): Habits => ({
  cleaning: "several_times_weekly",
  quiet: "before_00",
  guests: "up_to_2_nights",
  smoking: "no",
  pets: "none",
  social: "balanced",
  ...o,
});

export interface PersonaTemplate {
  key: string;
  name: string;
  subtitle: string; // shown on the sign-in button
  city: CityId;
  journey: "find_together" | "candidate_home" | "existing_room";
  areas: string[];
  rentMinMinor: number;
  rentMaxMinor: number;
  period: "month" | "year";
  startInDays: number;
  windowDays: number;
  stayMin: number;
  stayMax: number;
  bio: string;
  habits: Habits;
  gender: "woman" | "man" | "non_binary" | "prefer_not_to_say";
  genderPreference: string[]; // who they're open to living with
  inProgress: boolean; // starts with a household already formed
}

export const PERSONAS: PersonaTemplate[] = [
  {
    key: "ben",
    name: "Ben",
    subtitle: "Student moving to Hackney, London — starting fresh",
    city: "london",
    journey: "find_together",
    areas: ["hackney", "islington"],
    rentMinMinor: 80000,
    rentMaxMinor: 110000,
    period: "month",
    startInDays: 30,
    windowDays: 30,
    stayMin: 6,
    stayMax: 12,
    bio: "Postgrad student starting in Hackney next month. Tidy, early riser, happy to share the odd dinner but I value calm study time on weeknights.",
    habits: H({ quiet: "before_22" }),
    gender: "man",
    genderPreference: ["woman", "man", "non_binary"],
    inProgress: false,
  },
  {
    key: "hana",
    name: "Hana",
    subtitle: "Women-only flatshare in London — already matched, agreeing rent split",
    city: "london",
    journey: "find_together",
    areas: ["camden", "islington"],
    rentMinMinor: 90000,
    rentMaxMinor: 125000,
    period: "month",
    startInDays: 35,
    windowDays: 30,
    stayMin: 12,
    stayMax: 24,
    bio: "Junior doctor relocating to London. Organised, quiet on weeknights, sociable at weekends. Looking for someone reliable to split a two-bed with.",
    habits: H({ cleaning: "daily", social: "mostly_private" }),
    gender: "woman",
    genderPreference: ["woman"],
    inProgress: true,
  },
  {
    key: "chidi",
    name: "Chidi",
    subtitle: "Relocating to Yaba, Lagos (annual rent) — starting fresh",
    city: "lagos",
    journey: "find_together",
    areas: ["yaba", "surulere"],
    rentMinMinor: 120000000,
    rentMaxMinor: 240000000,
    period: "year",
    startInDays: 30,
    windowDays: 30,
    stayMin: 12,
    stayMax: 24,
    bio: "Fintech analyst moving back to Lagos for a new role. Organised, non-smoker, I cook most evenings. Looking to split a calm two-bed near work.",
    habits: H(),
    gender: "man",
    genderPreference: ["woman", "man", "non_binary"],
    inProgress: false,
  },
  {
    key: "zainab",
    name: "Zainab",
    subtitle: "Already matched in Lagos — agreeing rent split and a home",
    city: "lagos",
    journey: "find_together",
    areas: ["lekki", "ikoyi"],
    rentMinMinor: 150000000,
    rentMaxMinor: 300000000,
    period: "year",
    startInDays: 40,
    windowDays: 30,
    stayMin: 12,
    stayMax: 24,
    bio: "UX writer relocating within Lagos. Neat, calm during the week, happy with the occasional guest. Want everything agreed in writing up front.",
    habits: H({ guests: "never" }),
    gender: "woman",
    genderPreference: ["woman", "non_binary"],
    inProgress: true,
  },
];
