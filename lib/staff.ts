import { IS_BETA } from "./env";

// Staff access comes from the environment, never from a stored role alone (HM-10).
//   ADMIN_EMAILS="a@x.com,b@x.com"                       → admin
//   STAFF_EMAILS="v@x.com:verifier,m@x.com:moderator"    → verifier / moderator (ENG-42)
// An address in ADMIN_EMAILS is always admin, whatever STAFF_EMAILS says.

export const STAFF_ROLES = ["verifier", "moderator", "admin"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

// Emails granted the admin role (comma-separated ADMIN_EMAILS).
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// Every listed staff address and its role. Malformed STAFF_EMAILS entries are ignored.
export function staffAllowlist(): Map<string, StaffRole> {
  const out = new Map<string, StaffRole>();
  for (const entry of (process.env.STAFF_EMAILS || "").split(",")) {
    const [email, role] = entry.split(":").map((s) => (s || "").trim().toLowerCase());
    if (email && (role === "verifier" || role === "moderator")) out.set(email, role);
  }
  for (const email of adminEmails()) out.set(email, "admin");
  return out;
}

// The role an address is listed with, or null.
export function listedRole(email: string | null | undefined): StaffRole | null {
  if (!email) return null;
  return staffAllowlist().get(email.trim().toLowerCase()) ?? null;
}

// Wherever real people are involved (beta, or any Vercel deployment) the allowlist is the
// single source of truth: removing an address revokes access at once. Local development
// and the demo modes off Vercel keep seeded staff accounts working.
export function allowlistEnforced(): boolean {
  return IS_BETA || !!process.env.VERCEL_ENV;
}

export function staffRoleAllowed(email: string | null | undefined): boolean {
  if (!allowlistEnforced()) return true;
  return listedRole(email) !== null;
}

// The role to act on. Enforced: a stored staff role counts only while the address is listed,
// and then as the listed role (so moving someone from admin to moderator takes effect at once).
export function effectiveRole(user: { role: string; email: string | null }): string {
  if (user.role === "member") return "member";
  if (!allowlistEnforced()) return user.role;
  return listedRole(user.email) ?? "member";
}

// Prisma filter for accounts that may appear in the product (matching, profiles, intros):
// stored role member, and not on the staff allowlist (whose role is set at their next sign-in).
export function productAccountWhere() {
  return { role: "member", email: { notIn: [...staffAllowlist().keys()] } };
}

// Is this account staff (by effective role or allowlist)? Such accounts never appear in the
// product: not in Discover, not as a profile, never introduced.
export function isStaffAccount(user: { role: string; email: string | null }): boolean {
  return effectiveRole(user) !== "member" || listedRole(user.email) !== null || user.role !== "member";
}

// What the stored role should become at sign-in: the listed role, or member when a stored
// staff role is no longer listed. null = leave it alone.
export function roleAtSignIn(user: { role: string; email: string }): string | null {
  const listed = listedRole(user.email);
  if (listed) return user.role === listed ? null : listed;
  if (user.role !== "member" && allowlistEnforced()) return "member";
  return null;
}
