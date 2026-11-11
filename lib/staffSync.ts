import { prisma } from "./db";
import { writeAudit } from "./audit";
import { roleAtSignIn } from "./staff";

// At every sign-in, make the stored role match the staff allowlist (HM-10, lib/staff.ts):
// listed addresses get their listed role; a staff role that is no longer listed is removed.
// Both changes are audited. Returns the role now stored.
export async function syncRoleAtSignIn(user: { id: string; email: string; role: string }, rid: string): Promise<string> {
  const next = roleAtSignIn(user);
  if (!next) return user.role;
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { role: next } });
    await writeAudit(tx, {
      eventType: next === "member" ? "staff.role_revoked" : "staff.role_granted",
      actorType: "service",
      actorId: null,
      subjectId: user.id,
      resourceType: "user",
      resourceId: user.id,
      action: next === "member" ? "revoke_role" : "grant_role",
      reasonCode: next === "member" ? "not_in_staff_allowlist" : "staff_allowlist",
      safeBefore: { role: user.role },
      safeAfter: { role: next },
    }, rid);
  });
  return next;
}
