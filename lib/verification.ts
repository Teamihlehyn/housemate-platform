import { prisma } from "./db";

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
