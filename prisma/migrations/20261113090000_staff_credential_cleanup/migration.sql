-- SEC review of ENG-47: a staff credential goes with its account (cascade), and the unused
-- lockout columns are dropped (attempt limits are counted in the audit log, HM-43/45).
-- AlterTable
ALTER TABLE "StaffCredential" DROP COLUMN "failedCount",
DROP COLUMN "lockedUntil";

-- AddForeignKey
ALTER TABLE "StaffCredential" ADD CONSTRAINT "StaffCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

