import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api";
import { requireUser } from "@/lib/guard";
import { prisma } from "@/lib/db";

// GET /api/v1/properties?city=london — authorised sample catalogue.
export const GET = handler(async (req: NextRequest, { rid }) => {
  const user = await requireUser();
  const url = new URL(req.url);
  let city = url.searchParams.get("city");
  if (!city) {
    const search = await prisma.search.findUnique({ where: { userId: user.id } });
    city = search?.cityId ?? "london";
  }
  const properties = await prisma.property.findMany({
    where: { cityId: city, state: "available" },
    orderBy: { rentMinor: "asc" },
  });
  return ok(
    {
      properties: properties.map((p) => ({
        ...p,
        includedCosts: JSON.parse(p.includedCosts ?? "[]"),
        upfrontItems: JSON.parse(p.upfrontItems ?? "[]"),
      })),
    },
    rid
  );
});
