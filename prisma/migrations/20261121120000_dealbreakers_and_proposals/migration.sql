-- Usability round 1, founder decisions D-R2 and D-R4 (ENG-52, ENG-56).
-- PreferenceAnswer: own answer may be unanswered; deal-breaker state. Existing rows become
-- 'none' when every value is accepted, otherwise 'some' (acceptedValues unchanged, so matching
-- results for existing users don't change). Household.proposedBy for the 3-outgoing limit.
-- AlterTable
ALTER TABLE "Household" ADD COLUMN     "proposedBy" TEXT;

-- AlterTable
ALTER TABLE "PreferenceAnswer" ADD COLUMN     "state" TEXT NOT NULL DEFAULT 'some',
ALTER COLUMN "ownAnswer" DROP NOT NULL;


-- Backfill (data only; no rows are removed).
UPDATE "PreferenceAnswer" p SET state = 'none'
WHERE (SELECT count(*) FROM json_array_elements_text(p."acceptedValues"::json)) >=
      CASE p.dimension WHEN 'cleaning' THEN 3 WHEN 'quiet' THEN 3 WHEN 'guests' THEN 3
                       WHEN 'smoking' THEN 2 WHEN 'pets' THEN 2 WHEN 'social' THEN 3 ELSE 999 END;
UPDATE "Household" h SET "proposedBy" = (
  SELECT pa."userId" FROM "PlanAcceptance" pa JOIN "HouseholdPlan" hp ON hp.id = pa."planId"
  WHERE hp."householdId" = h.id AND hp."versionNo" = 1 ORDER BY pa."acceptedAt" ASC LIMIT 1
) WHERE h."proposedBy" IS NULL;
