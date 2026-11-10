-- Survey email opt-in (ENG-29) and feedback lookups by member (ENG-31). Additive with safe
-- defaults: every existing member starts opted out.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "surveyOptIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "surveyOptInAt" TIMESTAMP(3),
ADD COLUMN     "surveyOptInVersion" TEXT,
ADD COLUMN     "unsubscribedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "TesterFeedback_userId_idx" ON "TesterFeedback"("userId");
