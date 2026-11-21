import { prisma } from "./db";
import { testApprovalsAllowed } from "./env";

// Has the team checked this person's identity? (VerificationCheck, category "identity".)
export async function identityVerified(userId: string): Promise<boolean> {
  const c = await prisma.verificationCheck.findUnique({
    where: { userId_category: { userId, category: "identity" } },
    select: { status: true },
  });
  return c?.status === "verified";
}

// Beta browsing rule (ENG-02): where identity checks are mandatory, a person can see
// another person only when both have been identity-checked. Elsewhere, always allowed.
export function canSeeEachOther(opts: {
  verifiedOnly: boolean;
  viewerVerified: boolean;
  targetVerified: boolean;
}): boolean {
  if (!opts.verifiedOnly) return true;
  return opts.viewerVerified && opts.targetVerified;
}

// The beta browsing gate (ENG-02): a team-checked identity, or, only where test approvals are
// allowed (never production, ENG-67), a test account so testers can match each other.
export async function passesIdentityGate(userId: string): Promise<boolean> {
  if (await identityVerified(userId)) return true;
  if (!testApprovalsAllowed()) return false;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { isTestAccount: true } });
  return !!u?.isTestAccount;
}
