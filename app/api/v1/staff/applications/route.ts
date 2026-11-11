import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { requireStaff } from "@/lib/guard";
import { CITIES } from "@/lib/constants";
import { listApplications } from "@/lib/staffApplications";

const FILTERS = ["submitted", "in_review", "call_booked", "waitlisted", "declined", "approved", "all"];

// GET /api/v1/staff/applications?status=&city=&area=   (ENG-42; any staff role)
// Default status "submitted"; "declined" means the last 30 days. Oldest first, with waiting
// time and the D20 cluster hint. The reviewer's own application is never listed.
export const GET = handler(async (req: NextRequest, { rid }) => {
  const staff = await requireStaff();
  const q = req.nextUrl.searchParams;
  const status = q.get("status") || "submitted";
  const city = q.get("city") || null;
  const area = q.get("area") || null;
  const fe: Record<string, string> = {};
  if (!FILTERS.includes(status)) fe.status = "Unknown status.";
  if (city && !(city in CITIES)) fe.city = "Unknown city.";
  if (area && !Object.values(CITIES).some((c) => c.areas.some((a) => a.id === area))) fe.area = "Unknown area.";
  if (Object.keys(fe).length) return fail("VALIDATION", "Check the filters.", 422, rid, { field_errors: fe });
  return ok(await listApplications({ status, city, area, staffId: staff.id }), rid);
});
