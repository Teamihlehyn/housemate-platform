import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { proposePlanChange } from "@/lib/household";
import { afterPlanProposedOrChanged } from "@/lib/demoBots";

// PATCH /api/v1/households/[id]/plan
// {expected_plan_version, contributions?: {userId: monthlyMinor}, noticePeriodWeeks?, billsSplit?, notes?, stayMin?, stayMax?}
// Creates a new agreement version. Prior acceptances no longer count; the other
// member must accept again before viewings or the application can progress.
export const PATCH = handler(async (req: NextRequest, { rid, params }) => {
  const user = await requireUser();
  const body = await req.json().catch(() => ({}));
  if (typeof body.expected_plan_version !== "number")
    return fail("VALIDATION", "expected_plan_version is required.", 422, rid);

  const versionNo = await proposePlanChange({
    householdId: params.id,
    userId: user.id,
    expectedPlanVersion: body.expected_plan_version,
    changes: {
      contributions: body.contributions,
      noticePeriodWeeks: body.noticePeriodWeeks,
      billsSplit: body.billsSplit,
      notes: body.notes,
      stayMin: body.stayMin,
      stayMax: body.stayMax,
    },
    rid,
  });

  await afterPlanProposedOrChanged(params.id);
  return ok({ planVersion: versionNo }, rid);
});
