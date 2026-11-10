-- Invite revocation (HM-29) and lookups by email for account deletion (HM-30). Additive.

-- AlterTable
ALTER TABLE "Invite" ADD COLUMN     "revokedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Invite_email_idx" ON "Invite"("email");
