import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { requireStaff } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { parseGenderPreference } from "@/lib/constants";
import { staffApplication } from "@/lib/staffApplications";

// POST /api/v1/staff/applications/[id]/reveal → {gender, gender_preference}   (ENG-42)
// The private matching fields, only on request, and every reveal is audited (no values in
// the audit row). Any staff role; never on one's own application (404).
export const POST = handler(async (_req: NextRequest, { rid, params }) => {
  const staff = await requireStaff();
  const app = await staffApplication(params.id, staff.id);
  const search = await prisma.search.findUnique({ where: { userId: app.userId }, select: { gender: true, genderPreference: true } });
  await prisma.$transaction((tx) =>
    writeAudit(tx, {
      eventType: "staff.application_private_revealed",
      actorType: "staff",
      actorId: staff.id,
      subjectId: app.userId,
      resourceType: "application",
      resourceId: app.id,
      action: "reveal_private",
      safeAfter: { fields: ["gender", "gender_preference"] },
    }, rid)
  );
  return ok(
    { gender: search?.gender ?? null, gender_preference: parseGenderPreference(search?.genderPreference ?? null) },
    rid
  );
});
