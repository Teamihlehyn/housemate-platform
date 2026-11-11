-- Own-account approvals (ENG-46, SEC-15): the reviewer's note lives on the application, not the audit log.
-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "ownAccount" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "relationshipNote" TEXT;

