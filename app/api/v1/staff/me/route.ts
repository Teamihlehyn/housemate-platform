import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { requireStaff } from "@/lib/guard";

// GET /api/v1/staff/me → {email, displayName, role}. The back office's own "who am I".
export const GET = handler(async (_req: NextRequest, { rid }) => {
  const staff = await requireStaff();
  return ok({ email: staff.email, displayName: staff.displayName, role: staff.role }, rid);
});
