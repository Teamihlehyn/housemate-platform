import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { destroySession } from "@/lib/session";

export const POST = handler(async (_req: NextRequest, { rid }) => {
  await destroySession();
  return ok({ status: "signed_out" }, rid);
});
