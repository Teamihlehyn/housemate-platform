import { PrismaClient } from "@prisma/client";
import { QUESTIONNAIRE, RUBRIC } from "../lib/constants";

const prisma = new PrismaClient();

const TEST_TODAY = process.env.TEST_TODAY || new Date().toISOString().slice(0, 10);
function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

type Habits = Record<string, string>;

interface MemberSeed {
  email: string;
  name: string;
  city: "london" | "lagos";
  journey: string;
  areas: string[];
  currency: "GBP" | "NGN";
  rentMinMinor: number;
  rentMaxMinor: number;
  period: "month" | "year";
  earliest: string;
  latest: string;
  stayMin: number;
  stayMax: number;
  bio: string;
  habits: Habits;
  role?: string;
}

// A "default" balanced habit set. Individual members override for variety.
const H = (o: Partial<Habits> = {}): Habits => ({
  cleaning: "several_times_weekly",
  quiet: "before_00",
  guests: "up_to_2_nights",
  smoking: "no",
  pets: "none",
  social: "balanced",
  ...o,
});

const members: MemberSeed[] = [
  // ---- London hero pair (T01): two students, compatible ----
  {
    email: "amara@demo.housemate.test",
    name: "Amara Okoye",
    city: "london",
    journey: "find_together",
    areas: ["hackney", "islington"],
    currency: "GBP",
    rentMinMinor: 80000,
    rentMaxMinor: 110000,
    period: "month",
    earliest: addMonths(TEST_TODAY, 1),
    latest: addMonths(TEST_TODAY, 2),
    stayMin: 6,
    stayMax: 12,
    bio: "MSc student starting in autumn. Tidy, friendly, love cooking on weekends and quiet weekday evenings for study.",
    habits: H({ cleaning: "several_times_weekly", quiet: "before_22", social: "balanced" }),
  },
  {
    email: "ben@demo.housemate.test",
    name: "Ben Carter",
    city: "london",
    journey: "find_together",
    areas: ["hackney", "camden"],
    currency: "GBP",
    rentMinMinor: 85000,
    rentMaxMinor: 115000,
    period: "month",
    earliest: addMonths(TEST_TODAY, 1),
    latest: addDays(addMonths(TEST_TODAY, 2), 10),
    stayMin: 6,
    stayMax: 12,
    bio: "Postgrad researcher relocating to London. Early riser, keep things clean, happy to share the odd dinner but value calm study time.",
    habits: H({ cleaning: "several_times_weekly", quiet: "before_22", social: "balanced" }),
  },
  // ---- London filler ----
  { email: "priya@demo.housemate.test", name: "Priya Sharma", city: "london", journey: "find_together", areas: ["islington", "camden"], currency: "GBP", rentMinMinor: 90000, rentMaxMinor: 130000, period: "month", earliest: addMonths(TEST_TODAY, 1), latest: addMonths(TEST_TODAY, 3), stayMin: 12, stayMax: 24, bio: "Product designer, sociable but respect quiet time. Looking for a bright flat with good transport links.", habits: H({ social: "mostly_social", guests: "up_to_2_nights" }) },
  { email: "tomiwa@demo.housemate.test", name: "Tomiwa Adeyemi", city: "london", journey: "find_together", areas: ["lewisham", "brixton"], currency: "GBP", rentMinMinor: 70000, rentMaxMinor: 95000, period: "month", earliest: addMonths(TEST_TODAY, 2), latest: addMonths(TEST_TODAY, 4), stayMin: 6, stayMax: 18, bio: "Software engineer, remote most days. Cook a lot, keep the kitchen spotless. Non-smoker, no pets.", habits: H({ cleaning: "daily", social: "mostly_private" }) },
  { email: "sofia@demo.housemate.test", name: "Sofia Rossi", city: "london", journey: "candidate_home", areas: ["hackney", "walthamstow"], currency: "GBP", rentMinMinor: 82000, rentMaxMinor: 108000, period: "month", earliest: addMonths(TEST_TODAY, 1), latest: addMonths(TEST_TODAY, 2), stayMin: 6, stayMax: 12, bio: "Nurse on rotating shifts. Considerate about noise, tidy, love a houseplant or two.", habits: H({ quiet: "before_22", pets: "none" }) },
  { email: "leon@demo.housemate.test", name: "Leon Wright", city: "london", journey: "find_together", areas: ["camden", "islington"], currency: "GBP", rentMinMinor: 100000, rentMaxMinor: 140000, period: "month", earliest: addMonths(TEST_TODAY, 2), latest: addMonths(TEST_TODAY, 5), stayMin: 12, stayMax: 24, bio: "Musician and part-time teacher. Sociable household please — I love a shared meal and film nights.", habits: H({ social: "mostly_social", guests: "more_than_2", quiet: "no_fixed_time" }) },
  { email: "hana@demo.housemate.test", name: "Hana Kim", city: "london", journey: "find_together", areas: ["hackney", "islington"], currency: "GBP", rentMinMinor: 88000, rentMaxMinor: 118000, period: "month", earliest: addMonths(TEST_TODAY, 1), latest: addMonths(TEST_TODAY, 2), stayMin: 6, stayMax: 12, bio: "PhD candidate, calm and organised. Prefer a private-ish home with tidy shared spaces.", habits: H({ cleaning: "daily", quiet: "before_22", social: "mostly_private" }) },
  { email: "marcus@demo.housemate.test", name: "Marcus Bell", city: "london", journey: "find_together", areas: ["lewisham", "brixton"], currency: "GBP", rentMinMinor: 65000, rentMaxMinor: 90000, period: "month", earliest: addMonths(TEST_TODAY, 3), latest: addMonths(TEST_TODAY, 5), stayMin: 6, stayMax: 12, bio: "Junior architect. Easy-going, clean, non-smoker. Happy in a balanced household.", habits: H() },
  { email: "yara@demo.housemate.test", name: "Yara Haddad", city: "london", journey: "find_together", areas: ["walthamstow", "hackney"], currency: "GBP", rentMinMinor: 78000, rentMaxMinor: 104000, period: "month", earliest: addMonths(TEST_TODAY, 1), latest: addMonths(TEST_TODAY, 3), stayMin: 12, stayMax: 24, bio: "Charity worker, warm and tidy. Have a small cat — looking for a pet-friendly housemate.", habits: H({ pets: "has_pet" }) },
  { email: "oscar@demo.housemate.test", name: "Oscar Nilsson", city: "london", journey: "find_together", areas: ["camden", "islington"], currency: "GBP", rentMinMinor: 95000, rentMaxMinor: 125000, period: "month", earliest: addMonths(TEST_TODAY, 2), latest: addMonths(TEST_TODAY, 4), stayMin: 12, stayMax: 24, bio: "Data analyst, gym in the mornings. Tidy, quiet weekdays, sociable weekends.", habits: H({ quiet: "before_22" }) },
  { email: "isla@demo.housemate.test", name: "Isla Fraser", city: "london", journey: "find_together", areas: ["brixton", "lewisham"], currency: "GBP", rentMinMinor: 72000, rentMaxMinor: 98000, period: "month", earliest: addMonths(TEST_TODAY, 1), latest: addMonths(TEST_TODAY, 2), stayMin: 6, stayMax: 12, bio: "Grad teaching assistant. Friendly and clean, enjoy the occasional guest but keep weeknights calm.", habits: H({ quiet: "before_22", cleaning: "several_times_weekly" }) },
  { email: "devon@demo.housemate.test", name: "Devon Clarke", city: "london", journey: "find_together", areas: ["hackney", "walthamstow"], currency: "GBP", rentMinMinor: 83000, rentMaxMinor: 112000, period: "month", earliest: addMonths(TEST_TODAY, 1), latest: addMonths(TEST_TODAY, 3), stayMin: 6, stayMax: 18, bio: "UX researcher. Neat, considerate, non-smoker, no pets. Balanced social energy.", habits: H() },

  // ---- Lagos hero pair (T02): candidate_home + find_together, annual budgets ----
  {
    email: "chidi@demo.housemate.test",
    name: "Chidi Okafor",
    city: "lagos",
    journey: "candidate_home",
    areas: ["yaba", "surulere"],
    currency: "NGN",
    rentMinMinor: 120000000,
    rentMaxMinor: 240000000,
    period: "year",
    earliest: addMonths(TEST_TODAY, 1),
    latest: addMonths(TEST_TODAY, 2),
    stayMin: 12,
    stayMax: 24,
    bio: "Fintech analyst moving back to Lagos. Organised, non-smoker, enjoy cooking. Prefer a calm, tidy flat near work.",
    habits: H({ cleaning: "several_times_weekly", quiet: "before_00" }),
  },
  {
    email: "damola@demo.housemate.test",
    name: "Damola Balogun",
    city: "lagos",
    journey: "find_together",
    areas: ["yaba", "gbagada"],
    currency: "NGN",
    rentMinMinor: 130000000,
    rentMaxMinor: 260000000,
    period: "year",
    earliest: addMonths(TEST_TODAY, 1),
    latest: addDays(addMonths(TEST_TODAY, 2), 5),
    stayMin: 12,
    stayMax: 24,
    bio: "Software developer. Clean, quiet on weekdays, sociable at weekends. Looking to split a two-bed in Yaba.",
    habits: H({ cleaning: "several_times_weekly", quiet: "before_00" }),
  },
  // ---- Lagos existing-room host (T03) ----
  {
    email: "femi@demo.housemate.test",
    name: "Femi Adebayo",
    city: "lagos",
    journey: "existing_room",
    areas: ["lekki"],
    currency: "NGN",
    rentMinMinor: 90000000,
    rentMaxMinor: 90000000,
    period: "year",
    earliest: TEST_TODAY,
    latest: addMonths(TEST_TODAY, 3),
    stayMin: 12,
    stayMax: 24,
    bio: "I have a spare room in my 2-bed in Lekki. Quiet professional household, looking for a considerate housemate.",
    habits: H({ quiet: "before_22", social: "mostly_private" }),
  },
  {
    email: "grace@demo.housemate.test",
    name: "Grace Eze",
    city: "lagos",
    journey: "find_together",
    areas: ["lekki", "ikoyi"],
    currency: "NGN",
    rentMinMinor: 70000000,
    rentMaxMinor: 110000000,
    period: "year",
    earliest: addMonths(TEST_TODAY, 1),
    latest: addMonths(TEST_TODAY, 3),
    stayMin: 12,
    stayMax: 24,
    bio: "Consultant relocating for a new role. Tidy, quiet, non-smoker. Happy to join an existing calm household.",
    habits: H({ quiet: "before_22", social: "mostly_private" }),
  },
  // ---- Lagos filler ----
  { email: "kunle@demo.housemate.test", name: "Kunle Ade", city: "lagos", journey: "find_together", areas: ["ikeja", "gbagada"], currency: "NGN", rentMinMinor: 100000000, rentMaxMinor: 180000000, period: "year", earliest: addMonths(TEST_TODAY, 2), latest: addMonths(TEST_TODAY, 4), stayMin: 12, stayMax: 24, bio: "Accountant, calm and neat. Prefer a quiet, private household close to Ikeja.", habits: H({ social: "mostly_private" }) },
  { email: "ada@demo.housemate.test", name: "Ada Nwosu", city: "lagos", journey: "find_together", areas: ["yaba", "surulere"], currency: "NGN", rentMinMinor: 110000000, rentMaxMinor: 220000000, period: "year", earliest: addMonths(TEST_TODAY, 1), latest: addMonths(TEST_TODAY, 2), stayMin: 12, stayMax: 24, bio: "Doctor on rotation. Tidy and considerate, need quiet weeknights.", habits: H({ quiet: "before_22", cleaning: "daily" }) },
  { email: "tunde@demo.housemate.test", name: "Tunde Salami", city: "lagos", journey: "find_together", areas: ["gbagada", "yaba"], currency: "NGN", rentMinMinor: 90000000, rentMaxMinor: 170000000, period: "year", earliest: addMonths(TEST_TODAY, 1), latest: addMonths(TEST_TODAY, 3), stayMin: 12, stayMax: 24, bio: "Marketing lead. Sociable, love hosting friends at weekends, tidy during the week.", habits: H({ social: "mostly_social", guests: "more_than_2" }) },
  { email: "ngozi@demo.housemate.test", name: "Ngozi Umeh", city: "lagos", journey: "find_together", areas: ["surulere", "yaba"], currency: "NGN", rentMinMinor: 105000000, rentMaxMinor: 210000000, period: "year", earliest: addMonths(TEST_TODAY, 1), latest: addMonths(TEST_TODAY, 2), stayMin: 12, stayMax: 18, bio: "Teacher, warm and organised. Non-smoker, no pets, balanced household.", habits: H() },
  { email: "seyi@demo.housemate.test", name: "Seyi Ogun", city: "lagos", journey: "find_together", areas: ["lekki", "ikoyi"], currency: "NGN", rentMinMinor: 140000000, rentMaxMinor: 280000000, period: "year", earliest: addMonths(TEST_TODAY, 2), latest: addMonths(TEST_TODAY, 4), stayMin: 12, stayMax: 24, bio: "Product manager. Clean, quiet weekdays, enjoy weekend brunches at home.", habits: H({ quiet: "before_22" }) },
  { email: "bola@demo.housemate.test", name: "Bola Kareem", city: "lagos", journey: "find_together", areas: ["ikeja", "gbagada"], currency: "NGN", rentMinMinor: 95000000, rentMaxMinor: 175000000, period: "year", earliest: addMonths(TEST_TODAY, 1), latest: addMonths(TEST_TODAY, 3), stayMin: 12, stayMax: 24, bio: "Civil engineer. Easy-going and tidy, no pets, non-smoker.", habits: H() },
  { email: "zainab@demo.housemate.test", name: "Zainab Bello", city: "lagos", journey: "find_together", areas: ["yaba", "gbagada"], currency: "NGN", rentMinMinor: 115000000, rentMaxMinor: 230000000, period: "year", earliest: addMonths(TEST_TODAY, 1), latest: addMonths(TEST_TODAY, 2), stayMin: 12, stayMax: 24, bio: "UX writer. Neat, calm on weekdays, happy with the occasional guest.", habits: H({ quiet: "before_00" }) },

  // ---- Staff persona ----
  { email: "verifier@demo.housemate.test", name: "Val Verifier", city: "london", journey: "find_together", areas: ["hackney"], currency: "GBP", rentMinMinor: 80000, rentMaxMinor: 100000, period: "month", earliest: addMonths(TEST_TODAY, 1), latest: addMonths(TEST_TODAY, 2), stayMin: 6, stayMax: 12, bio: "Staff verifier persona for the operations console.", habits: H(), role: "verifier" },
];

interface PropertySeed {
  city: "london" | "lagos";
  area: string;
  title: string;
  description: string;
  bedrooms: number;
  contract: "room" | "whole_home";
  rentMinor: number;
  currency: "GBP" | "NGN";
  period: "month" | "year";
  included: string[];
  upfront: { label: string; minor: number }[];
  deposit: number;
}

const properties: PropertySeed[] = [
  { city: "london", area: "hackney", title: "Bright 2-bed near London Fields", description: "Sample listing. Two double bedrooms, shared kitchen and living room, close to Overground.", bedrooms: 2, contract: "whole_home", rentMinor: 210000, currency: "GBP", period: "month", included: ["Water"], upfront: [{ label: "Holding deposit", minor: 30000 }], deposit: 240000 },
  { city: "london", area: "islington", title: "Modern flat off Upper Street", description: "Sample listing. Two bedrooms, recently refurbished, excellent transport.", bedrooms: 2, contract: "whole_home", rentMinor: 235000, currency: "GBP", period: "month", included: ["Water", "Building maintenance"], upfront: [], deposit: 270000 },
  { city: "london", area: "camden", title: "Two-bed conversion near Camden Market", description: "Sample listing. Characterful flat, wood floors, close to the tube.", bedrooms: 2, contract: "whole_home", rentMinor: 250000, currency: "GBP", period: "month", included: [], upfront: [{ label: "Admin fee", minor: 15000 }], deposit: 290000 },
  { city: "london", area: "lewisham", title: "Spacious 2-bed with garden", description: "Sample listing. Ground-floor flat with a shared garden, quiet street.", bedrooms: 2, contract: "whole_home", rentMinor: 180000, currency: "GBP", period: "month", included: ["Water", "Garden upkeep"], upfront: [], deposit: 200000 },
  { city: "london", area: "walthamstow", title: "Cosy 2-bed near Walthamstow Village", description: "Sample listing. Bright rooms, great local cafes and Victoria line access.", bedrooms: 2, contract: "whole_home", rentMinor: 195000, currency: "GBP", period: "month", included: ["Water"], upfront: [], deposit: 220000 },
  { city: "london", area: "brixton", title: "Two-bed apartment near Brixton tube", description: "Sample listing. Modern build, close to markets and nightlife.", bedrooms: 2, contract: "whole_home", rentMinor: 205000, currency: "GBP", period: "month", included: ["Water", "Gym access"], upfront: [], deposit: 230000 },

  { city: "lagos", area: "yaba", title: "Serviced 2-bed in Yaba", description: "Sample listing. Two en-suite bedrooms, 24/7 power backup, near tech hub.", bedrooms: 2, contract: "whole_home", rentMinor: 320000000, currency: "NGN", period: "year", included: ["Estate security", "Waste"], upfront: [{ label: "Agency fee (10%)", minor: 32000000 }, { label: "Caution deposit", minor: 32000000 }], deposit: 32000000 },
  { city: "lagos", area: "lekki", title: "2-bed apartment in Lekki Phase 1", description: "Sample listing. Spacious flat, gated estate, close to the expressway.", bedrooms: 2, contract: "whole_home", rentMinor: 450000000, currency: "NGN", period: "year", included: ["Estate security", "Water"], upfront: [{ label: "Agency fee (10%)", minor: 45000000 }, { label: "Legal fee (5%)", minor: 22500000 }], deposit: 45000000 },
  { city: "lagos", area: "ikeja", title: "Modern 2-bed in Ikeja GRA", description: "Sample listing. Quiet neighbourhood, ample parking, standby generator.", bedrooms: 2, contract: "whole_home", rentMinor: 380000000, currency: "NGN", period: "year", included: ["Estate security"], upfront: [{ label: "Agency fee (10%)", minor: 38000000 }], deposit: 38000000 },
  { city: "lagos", area: "surulere", title: "Comfortable 2-bed in Surulere", description: "Sample listing. Central location, close to amenities and transport.", bedrooms: 2, contract: "whole_home", rentMinor: 260000000, currency: "NGN", period: "year", included: ["Waste"], upfront: [{ label: "Agency fee (10%)", minor: 26000000 }], deposit: 26000000 },
  { city: "lagos", area: "gbagada", title: "2-bed flat in Gbagada", description: "Sample listing. Newly built, reliable power, family-friendly estate.", bedrooms: 2, contract: "whole_home", rentMinor: 300000000, currency: "NGN", period: "year", included: ["Estate security", "Water"], upfront: [{ label: "Agency fee (10%)", minor: 30000000 }], deposit: 30000000 },
  // A room-type sample linked to Femi's offer area (Lekki)
  { city: "lagos", area: "lekki", title: "Room in shared 2-bed, Lekki", description: "Sample room listing. One furnished room in a calm professional flat share.", bedrooms: 1, contract: "room", rentMinor: 90000000, currency: "NGN", period: "year", included: ["Estate security", "Water"], upfront: [{ label: "Caution deposit", minor: 9000000 }], deposit: 9000000 },
];

async function main() {
  // Safety: never load demo personas into a real-user (beta) database.
  if (process.env.APP_ENV === "beta" && process.env.FORCE_SEED !== "true") {
    console.error(
      "Refusing to seed demo data into a beta environment. Set FORCE_SEED=true only if you really mean it."
    );
    process.exit(1);
  }
  console.log("Seeding Housemate prototype…  TEST_TODAY =", TEST_TODAY);

  // Clean slate (order respects FKs; SQLite cascades handle children)
  await prisma.$transaction([
    prisma.moveInConfirmation.deleteMany(),
    prisma.handoffAcceptance.deleteMany(),
    prisma.handoff.deleteMany(),
    prisma.viewingOutcome.deleteMany(),
    prisma.viewing.deleteMany(),
    prisma.shortlistVote.deleteMany(),
    prisma.shortlistItem.deleteMany(),
    prisma.planAcceptance.deleteMany(),
    prisma.householdPlan.deleteMany(),
    prisma.membership.deleteMany(),
    prisma.household.deleteMany(),
    prisma.meeting.deleteMany(),
    prisma.message.deleteMany(),
    prisma.conversation.deleteMany(),
    prisma.introduction.deleteMany(),
    prisma.block.deleteMany(),
    prisma.scoreSnapshot.deleteMany(),
    prisma.verificationCheck.deleteMany(),
    prisma.searchVersion.deleteMany(),
    prisma.preferenceAnswer.deleteMany(),
    prisma.searchArea.deleteMany(),
    prisma.search.deleteMany(),
    prisma.profile.deleteMany(),
    prisma.session.deleteMany(),
    prisma.authCode.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.auditEvent.deleteMany(),
    prisma.outboxEvent.deleteMany(),
    prisma.idempotencyKey.deleteMany(),
    prisma.property.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  for (const m of members) {
    const user = await prisma.user.create({
      data: {
        email: m.email,
        emailVerified: true,
        phone: "+447700900000",
        phoneVerified: true,
        displayName: m.name,
        adultEligible: true,
        accountStatus: "active",
        role: m.role ?? "member",
        profile: {
          create: {
            journey: m.journey,
            bio: m.bio,
            avatarInitials: initials(m.name),
            publicationStatus: "published",
            publishedAt: new Date(),
          },
        },
        search: {
          create: {
            status: "active",
            cityId: m.city,
            currency: m.currency,
            rentMinMinor: m.rentMinMinor,
            rentMaxMinor: m.rentMaxMinor,
            rentPeriod: m.period,
            moveMode: "range",
            earliestDate: m.earliest,
            latestDate: m.latest,
            preferredDate: m.earliest,
            stayMinMonths: m.stayMin,
            stayMaxMonths: m.stayMax,
            areas: { create: m.areas.map((a) => ({ areaId: a })) },
            preferences: {
              create: QUESTIONNAIRE.map((q) => ({
                dimension: q.id,
                ownAnswer: m.habits[q.id],
                acceptedValues: JSON.stringify(
                  // accept own + adjacent by default; smoking/pets stay strict to own
                  q.id === "smoking" || q.id === "pets"
                    ? [m.habits[q.id]]
                    : q.values.map((v) => v.id)
                ),
              })),
            },
          },
        },
      },
    });

    // Core verification: identity + email + phone → 60 baseline. Give heroes a reference too.
    const withReference = ["amara@demo.housemate.test", "chidi@demo.housemate.test", "grace@demo.housemate.test"].includes(m.email);
    const checks: { category: string; points: number }[] = [
      { category: "identity", points: RUBRIC.identity },
      { category: "email", points: RUBRIC.email },
      { category: "phone", points: RUBRIC.phone },
    ];
    if (withReference) checks.push({ category: "reference", points: RUBRIC.reference });

    for (const c of checks) {
      await prisma.verificationCheck.create({
        data: { userId: user.id, category: c.category, status: "verified", points: c.points },
      });
    }
    const score = Math.min(100, checks.reduce((s, c) => s + c.points, 0));
    await prisma.scoreSnapshot.create({
      data: {
        userId: user.id,
        score,
        componentJson: JSON.stringify(checks),
      },
    });
  }

  for (const p of properties) {
    await prisma.property.create({
      data: {
        sourceType: "sample_partner_feed",
        cityId: p.city,
        areaId: p.area,
        title: p.title,
        description: p.description,
        bedroomCount: p.bedrooms,
        contractType: p.contract,
        rentMinor: p.rentMinor,
        currency: p.currency,
        rentPeriod: p.period,
        includedCosts: JSON.stringify(p.included),
        upfrontItems: JSON.stringify(p.upfront),
        depositMinor: p.deposit,
        sharersAllowed: true,
        state: "available",
        lastConfirmedAt: new Date(),
      },
    });
  }

  const userCount = await prisma.user.count();
  const propCount = await prisma.property.count();
  console.log(`✔ Seeded ${userCount} members and ${propCount} sample properties.`);
  console.log("Demo logins (request a code on the sign-in page, code is shown in demo sink):");
  console.log("  London hero pair : amara@demo.housemate.test / ben@demo.housemate.test");
  console.log("  Lagos hero pair  : chidi@demo.housemate.test / damola@demo.housemate.test");
  console.log("  Lagos room (T03) : femi@demo.housemate.test (host) / grace@demo.housemate.test");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
