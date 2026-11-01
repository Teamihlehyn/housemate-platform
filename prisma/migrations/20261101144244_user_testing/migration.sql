-- AlterTable
ALTER TABLE "HouseholdPlan" ADD COLUMN     "billsSplit" TEXT NOT NULL DEFAULT 'equal',
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "noticePeriodWeeks" INTEGER NOT NULL DEFAULT 4;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isDemoBot" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sandboxWorldId" TEXT;

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "conversationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TesterFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "testerId" TEXT,
    "source" TEXT,
    "page" TEXT NOT NULL,
    "rating" INTEGER,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TesterFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");

-- CreateIndex
CREATE INDEX "User_sandboxWorldId_idx" ON "User"("sandboxWorldId");
