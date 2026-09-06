import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { writeAudit, writeOutbox, notify } from "@/lib/audit";
import { formatPeriodPrice } from "@/lib/money";

// POST /api/v1/households/[id]/shortlist — add a sample property or a user link.
export const POST = handler(async (req: NextRequest, { rid, params }) => {
  const user = await requireUser();
  const body = await req.json().catch(() => ({}));
  const hh = await prisma.household.findUnique({
    where: { id: params.id },
    include: { memberships: true },
  });
  if (!hh || !hh.memberships.some((m) => m.userId === user.id))
    return fail("NOT_FOUND", "Household not found.", 404, rid);
  if (hh.state !== "active")
    return fail("STATE_CONFLICT", "The household must be active to shortlist.", 409, rid);

  const otherId = hh.memberships.find((m) => m.userId !== user.id)!.userId;
  const count = await prisma.shortlistItem.count({ where: { householdId: hh.id, state: "active" } });
  if (count >= 20) return fail("LIMIT", "Shortlist limit reached (20).", 422, rid);

  let title = String(body.title ?? "").trim();
  let area: string | null = null;
  let priceNote: string | null = null;
  let propertyId: string | null = null;
  let url: string | null = null;

  if (body.source_property_id) {
    const prop = await prisma.property.findUnique({ where: { id: body.source_property_id } });
    if (!prop || prop.state !== "available")
      return fail("NOT_FOUND", "That property is not available.", 404, rid);
    // Idempotent: duplicate property in a household returns the existing item.
    const existing = await prisma.shortlistItem.findFirst({
      where: { householdId: hh.id, propertyId: prop.id, state: "active" },
    });
    if (existing) return ok({ id: existing.id, deduped: true }, rid);
    propertyId = prop.id;
    title = prop.title;
    area = prop.areaId;
    priceNote = formatPeriodPrice(prop.rentMinor, prop.rentPeriod, prop.currency);
  } else if (body.url) {
    // HTTPS only; reject credentials and local/private hosts (SSRF-safe: we never fetch it).
    const raw = String(body.url).trim();
    if (raw.length > 2048) return fail("VALIDATION", "URL too long.", 422, rid);
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return fail("VALIDATION", "Enter a valid URL.", 422, rid);
    }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password)
      return fail("VALIDATION", "Only https links without credentials are allowed.", 422, rid);
    if (/^(localhost|127\.|10\.|192\.168\.|0\.)/i.test(parsed.hostname))
      return fail("VALIDATION", "That host is not allowed.", 422, rid);
    url = raw;
    if (!title) title = parsed.hostname;
    area = body.area ?? null;
    priceNote = body.priceNote ?? null;
  } else {
    return fail("VALIDATION", "Provide a sample property or a link.", 422, rid);
  }

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.shortlistItem.create({
      data: {
        householdId: hh.id,
        propertyId,
        url,
        title,
        area,
        priceNote,
        notes: body.notes ? String(body.notes).slice(0, 500) : null,
        votes: { create: { userId: user.id, decision: "interested" } },
      },
    });
    await writeAudit(tx, { eventType: "shortlist.added", actorId: user.id, resourceType: "shortlist_item", resourceId: created.id, action: "add" }, rid);
    await writeOutbox(tx, "shortlist_added", { itemId: created.id });
    await notify(tx, otherId, "shortlist_added", "New shortlisted home", `${user.displayName} added "${title}" to your shortlist.`);
    return created;
  });

  return ok({ id: item.id }, rid);
});
