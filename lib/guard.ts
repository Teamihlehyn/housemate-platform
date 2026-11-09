import { getCurrentUser } from "./session";
import { ApiError } from "./api";
import { prisma } from "./db";
import { HOMES_ENABLED } from "./env";

// Emails granted the admin role on sign-in (comma-separated ADMIN_EMAILS).
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// Server-side authorization — a hidden button is not authorization.
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new ApiError("UNAUTHENTICATED", "Sign in to continue.", 401);
  if (user.accountStatus === "suspended")
    throw new ApiError("SUSPENDED", "This account is suspended.", 403);
  return user;
}

// Homes, viewings, the application and move-in are off in beta. Call after requireUser()
// so an unauthenticated request still gets 401 first. 404, not 403: the feature doesn't exist here.
export function requireHomesEnabled() {
  if (!HOMES_ENABLED) throw new ApiError("NOT_FOUND", "This isn't available in early access.", 404);
}

export async function requireStaff(role?: string) {
  const user = await requireUser();
  const staffRoles = ["verifier", "moderator", "admin"];
  if (!staffRoles.includes(user.role)) throw new ApiError("FORBIDDEN", "Staff access required.", 403);
  if (role && user.role !== role && user.role !== "admin")
    throw new ApiError("FORBIDDEN", "Insufficient role.", 403);
  return user;
}

// Idempotency: same key + same body → original response; different body → 409.
export async function withIdempotency<T>(
  key: string | null,
  actorId: string,
  route: string,
  body: unknown,
  fn: () => Promise<T>
): Promise<{ replayed: boolean; result: T }> {
  if (!key) return { replayed: false, result: await fn() };
  const bodyHash = JSON.stringify(body ?? {});
  const existing = await prisma.idempotencyKey.findUnique({ where: { key } });
  if (existing) {
    if (existing.actorId !== actorId || existing.route !== route)
      throw new ApiError("IDEMPOTENCY_CONFLICT", "Key already used for a different request.", 409);
    if (existing.requestHash !== bodyHash)
      throw new ApiError("IDEMPOTENCY_CONFLICT", "Same key with a different body.", 409);
    return { replayed: true, result: JSON.parse(existing.responseJson) as T };
  }
  const result = await fn();
  await prisma.idempotencyKey.create({
    data: { key, actorId, route, requestHash: bodyHash, responseJson: JSON.stringify(result) },
  });
  return { replayed: false, result };
}
