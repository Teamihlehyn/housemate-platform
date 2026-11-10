import { IS_BETA } from "./env";

// Emails granted the admin role (comma-separated ADMIN_EMAILS).
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// ADMIN_EMAILS is the single source of truth for staff access wherever real people are
// involved (beta, or any Vercel deployment). A stored staff role on an account whose
// email is no longer listed is ignored, so removing an address revokes access at once.
// Local development keeps seeded staff accounts working.
export function staffRoleAllowed(email: string | null | undefined): boolean {
  if (!IS_BETA && !process.env.VERCEL_ENV) return true;
  return !!email && adminEmails().includes(email.trim().toLowerCase());
}

export function effectiveRole(user: { role: string; email: string | null }): string {
  if (user.role === "member") return "member";
  return staffRoleAllowed(user.email) ? user.role : "member";
}
