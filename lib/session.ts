import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { prisma } from "./db";

const COOKIE = "hm_session";

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7-day absolute
  await prisma.session.create({ data: { token, userId, expiresAt } });
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
  if (!user || user.accountStatus === "deleted") return null;
  return user;
}

export function getSessionCookieName() {
  return COOKIE;
}
