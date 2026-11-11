-- Application retention (R7): a hashed email + reapply date survive the purge of declined answers.
-- CreateTable
CREATE TABLE "ApplicantTombstone" (
    "emailHash" TEXT NOT NULL,
    "reapplyAfter" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicantTombstone_pkey" PRIMARY KEY ("emailHash")
);

-- CreateIndex
CREATE INDEX "ApplicantTombstone_reapplyAfter_idx" ON "ApplicantTombstone"("reapplyAfter");

