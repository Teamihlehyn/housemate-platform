-- Approval-first sign-up (ENG-39). Additive: new Application table, Session.scope (existing
-- sessions stay 'member'), AuthCode.consentVersion, Invite.applicationId. AccessRequest is
-- retired in code (no new writes) but kept until its rows are purged.
-- AlterTable
ALTER TABLE "AuthCode" ADD COLUMN     "consentVersion" TEXT;

-- AlterTable
ALTER TABLE "Invite" ADD COLUMN     "applicationId" TEXT;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'member';

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "submittedAt" TIMESTAMP(3),
    "callAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "idCheckMethod" TEXT,
    "idCheckAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "reapplyAfter" TIMESTAMP(3),
    "activationInviteId" TEXT,
    "statusTokenHash" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Application_userId_key" ON "Application"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_statusTokenHash_key" ON "Application"("statusTokenHash");

-- CreateIndex
CREATE INDEX "Application_status_submittedAt_idx" ON "Application"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "Invite_applicationId_idx" ON "Invite"("applicationId");

