import { getCurrentUser } from "./session";
import { ApiError } from "./api";
import { prisma } from "./db";
import { HOMES_ENABLED, IS_BETA } from "./env";

export { adminEmails } from "./staff";

// Any signed-in account, applicants included (ENG-39). Only for the applicant allow-list:
// /me, /me/profile, /me/search, /me/preferences, /me/export, /me/delete, /applications/*.
export async function requireAccount() {
  const user = await getCurrentUser();
  if (!user) throw new ApiError("UNAUTHENTICATED", "Sign in to continue.", 401);
  if (user.accountStatus === "suspended")
    throw new ApiError("SUSPENDED", "This account is suspended.", 403);
  return user;
}

// Is this an applicant (or an application-scoped session)? Pure, for tests.
export function isApplicantSession(u: { accountStatus: string; sessionScope: string }): boolean {
  return u.accountStatus === "applicant" || u.sessionScope !== "member";
}

export const STAFF_ROLE_IDS = ["verifier", "moderator", "admin"];
export function isStaffRole(role: string): boolean {
  return STAFF_ROLE_IDS.includes(role);
}

// Server-side authorization — a hidden button is not authorization.
// Members only. An applicant gets 404 on every member route, the same as a missing resource,
// so the application session can't reach member data (ENG-39). Staff get 404 too: staff
// accounts are back-office only and never use the product (founder, 10 Nov). `role` here is
// already the effective role (lib/staff.ts), never the stored one alone.
export async function requireUser() {
  const user = await requireAccount();
  if (isApplicantSession(user) || isStaffRole(user.role)) throw new ApiError("NOT_FOUND", "Not found.", 404);
  return user;
}

// Homes, viewings, the application and move-in are off in beta. Call after requireUser()
// so an unauthenticated request still gets 401 first. 404, not 403: the feature doesn't exist here.
export function requireHomesEnabled() {
  if (!HOMES_ENABLED) throw new ApiError("NOT_FOUND", "This isn't available in early access.", 404);
}

// Back office. Visitors, members, applicants and suspended accounts all get the same 404:
// the staff routes don't exist for them. Effective role only (HM-10).
export async function requireStaff() {
  const user = await getCurrentUser();
  if (!user || user.accountStatus === "suspended" || isApplicantSession(user) || !isStaffRole(user.role)) {
    throw new ApiError("NOT_FOUND", "Not found.", 404);
  }
  return user;
}

// Admin-only staff tools (survey send and export, audit). Everyone else, other staff
// roles included, gets 404: these routes don't exist for them.
export async function requireAdmin() {
  const user = await requireStaff();
  if (user.role !== "admin") throw new ApiError("NOT_FOUND", "Not found.", 404);
  return user;
}

// Survey send and export only exist in beta (HM-33): elsewhere the accounts are samples or
// testers who never opted in. Checked before sign-in so other modes always get 404.
export async function requireSurveyAdmin() {
  if (!IS_BETA) throw new ApiError("NOT_FOUND", "Not found.", 404);
  return requireAdmin();
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
