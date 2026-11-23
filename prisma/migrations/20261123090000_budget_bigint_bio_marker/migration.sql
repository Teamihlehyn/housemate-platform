-- HM-55: widen search budgets to BIGINT (Lagos annual budgets in kobo overflow INT). Widening
-- keeps every existing value.
ALTER TABLE "Search" ALTER COLUMN "rentMinMinor" SET DATA TYPE BIGINT,
ALTER COLUMN "rentMaxMinor" SET DATA TYPE BIGINT,
ALTER COLUMN "upfrontMinor" SET DATA TYPE BIGINT;

-- HM-54: when the bio last changed.
ALTER TABLE "Profile" ADD COLUMN "bioUpdatedAt" TIMESTAMP(3);

-- HM-56: the reported user's bio at report time (moderators only).
ALTER TABLE "Report" ADD COLUMN "targetBio" TEXT;
