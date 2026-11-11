import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { prisma } from "./db";
import { effectiveRole } from "./staff";

const COOKIE = "hm_session";

// member: the whole app. application: an applicant's limited session (ENG-39).
export type SessionScope = "member" | "application";

export async function createSession(userId: string, scope: SessionScope = "member"): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7-day absolute
  await prisma.session.create({ data: { token, userId, expiresAt, scope } });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return token;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { token } });
  jar.delete(COOKIE);
}

export async function getCurrentUser() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { token } });
  if (!session || session.expiresAt < new Date()) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { profile: true, search: true },
  });
  // An account being deleted is treated as gone: its sessions stop working (HM-07).
  if (!user || user.accountStatus === "deleted" || user.accountStatus === "deletion_pending") return null;
  // An applicant's session is always application-scoped, whatever the row says.
  const sessionScope: SessionScope =
    session.scope === "member" && user.accountStatus !== "applicant" ? "member" : "application";
  // Staff roles count only while the email is on the staff allowlist (lib/staff.ts, HM-10).
  return { ...user, role: effectiveRole(user), sessionScope };
}

// Activation (ENG-43): every earlier session (application-scoped, other devices) ends and
// one member session replaces them.
export async function replaceSessions(userId: string, scope: SessionScope): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
  await createSession(userId, scope);
}
