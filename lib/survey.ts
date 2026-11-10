import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { CITIES, CityId } from "./constants";

// Who may be emailed a survey (D17, ENG-30): opted in, not unsubscribed, an active member
// account. Staff, demo bots and anyone suspended or deleting their account are excluded.
export const SURVEY_ELIGIBLE: Prisma.UserWhereInput = {
  surveyOptIn: true,
  unsubscribedAt: null,
  accountStatus: "active",
  isDemoBot: false,
  role: "member",
};

export function validCampaign(c: unknown): c is string {
  return typeof c === "string" && /^[a-z0-9][a-z0-9-]{2,39}$/.test(c);
}

export function validSurveyUrl(u: unknown): u is string {
  if (typeof u !== "string" || u.length > 500) return false;
  try {
    const url = new URL(u);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

// Add the pseudonymous reference so answers can be linked without exposing the account ID.
export function withRef(surveyUrl: string, ref: string | null): string {
  if (!ref) return surveyUrl;
  const url = new URL(surveyUrl);
  url.searchParams.set("ref", ref);
  return url.toString();
}

// CSV cell: quoted, and neutralised against spreadsheet formula injection.
export function csvCell(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

export const STAGES = ["signed_up", "published", "verified", "intro_sent", "chatting", "household"] as const;

// The furthest stage each person reached, for the survey export.
export async function furthestStages(userIds: string[]): Promise<Map<string, string>> {
  const [published, verified, intros, messages, households] = await Promise.all([
    prisma.profile.findMany({ where: { userId: { in: userIds }, publicationStatus: "published" }, select: { userId: true } }),
    prisma.verificationCheck.findMany({ where: { userId: { in: userIds }, category: "identity", status: "verified" }, select: { userId: true } }),
    prisma.introduction.findMany({ where: { senderId: { in: userIds } }, select: { senderId: true } }),
    prisma.message.findMany({ where: { senderId: { in: userIds } }, select: { senderId: true }, distinct: ["senderId"] }),
    prisma.membership.findMany({ where: { userId: { in: userIds } }, select: { userId: true } }),
  ]);
  const at = new Map<string, number>();
  const bump = (id: string, stage: number) => at.set(id, Math.max(at.get(id) ?? 0, stage));
  published.forEach((p) => bump(p.userId, 1));
  verified.forEach((v) => bump(v.userId, 2));
  intros.forEach((i) => bump(i.senderId, 3));
  messages.forEach((m) => bump(m.senderId, 4));
  households.forEach((h) => bump(h.userId, 5));
  return new Map(userIds.map((id) => [id, STAGES[at.get(id) ?? 0]]));
}

export function cityLabel(id: string | null | undefined): string {
  return id && id in CITIES ? CITIES[id as CityId].label.replace(/ pilot$/, "") : "";
}
