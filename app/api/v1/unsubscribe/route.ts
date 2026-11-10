import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api";
import { prisma } from "@/lib/db";
import { verifyUnsubscribeToken } from "@/lib/emailLinks";
import { setSurveyOptIn } from "@/lib/surveyConsent";

// Survey email unsubscribe (ENG-29). No sign-in; the signed token is the authority.
//   GET  /api/v1/unsubscribe?token=… → {status: "subscribed" | "unsubscribed"}. Changes
//        nothing, so link scanners that open every URL can't unsubscribe anyone.
//   POST /api/v1/unsubscribe?token=… → {status: "unsubscribed"}. Idempotent: a repeat is 200
//        with no new audit row. Also the RFC 8058 one-click target (List-Unsubscribe-Post),
//        so the token is read from the query string and any body is ignored.
// A bad, tampered or unknown token → 404 NOT_FOUND "This link isn't valid." Never shows the
// email address or anything else about the account.
const INVALID = "This link isn't valid. You can turn survey emails off in Settings.";

async function resolve(req: NextRequest) {
  const userId = verifyUnsubscribeToken(req.nextUrl.searchParams.get("token"));
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId }, select: { id: true, surveyOptIn: true, unsubscribedAt: true } });
}

export const GET = handler(async (req: NextRequest, { rid }) => {
  const u = await resolve(req);
  if (!u) return fail("NOT_FOUND", INVALID, 404, rid);
  return ok({ status: u.surveyOptIn && !u.unsubscribedAt ? "subscribed" : "unsubscribed" }, rid);
});

export const POST = handler(async (req: NextRequest, { rid }) => {
  const u = await resolve(req);
  if (!u) return fail("NOT_FOUND", INVALID, 404, rid);
  await prisma.$transaction((tx) => setSurveyOptIn(tx, u.id, false, "unsubscribe_link", rid));
  return ok({ status: "unsubscribed" }, rid);
});
