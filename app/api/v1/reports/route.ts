import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { writeAudit, writeOutbox, notify } from "@/lib/audit";
import { REPORT_CATEGORIES } from "@/lib/constants";

// POST /api/v1/reports {target_user_id, category, description, conversation_id?}
// Creates a private case. A report never changes the target's public score.
export const POST = handler(async (req: NextRequest, { rid }) => {
  const user = await requireUser();
  const body = await req.json().catch(() => ({}));
  const description = String(body.description ?? "").trim();
  const fe: Record<string, string> = {};
  if (!REPORT_CATEGORIES.some((c) => c.id === body.category)) fe.category = "Choose what happened.";
  if (description.length < 20 || description.length > 1000) fe.description = "Describe what happened in 20–1,000 characters.";
  if (Object.keys(fe).length) return fail("VALIDATION", "Please fix the highlighted fields.", 422, rid, { field_errors: fe });

  const target = await prisma.user.findUnique({ where: { id: String(body.target_user_id ?? "") } });
  if (!target || target.id === user.id || (target.sandboxWorldId ?? null) !== (user.sandboxWorldId ?? null))
    return fail("NOT_FOUND", "We couldn't find that user.", 404, rid);

  const report = await prisma.$transaction(async (tx) => {
    const r = await tx.report.create({
      data: {
        reporterId: user.id,
        targetUserId: target.id,
        category: body.category,
        description,
        conversationId: body.conversation_id ?? null,
      },
    });
    // Audit records the case, never the description text.
    await writeAudit(tx, { eventType: "report.created", actorId: user.id, subjectId: target.id, resourceType: "report", resourceId: r.id, action: "create", reasonCode: body.category }, rid);
    await writeOutbox(tx, "report_created", { reportId: r.id, category: body.category });
    await notify(
      tx,
      user.id,
      "report_receipt",
      "Report received",
      `Case ${r.id.slice(-6).toUpperCase()} is open. Support in this prototype is simulated and is not an emergency service.`
    );
    return r;
  });

  return ok({ caseId: report.id.slice(-6).toUpperCase() }, rid);
});
