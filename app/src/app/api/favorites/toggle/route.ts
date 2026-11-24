import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, fail, isSameOrigin } from "@/lib/api";
import { FAVORITE_TYPES, toggleFavorite } from "@/lib/favorites";
import { todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

const schema = z.object({
  type: z.enum(FAVORITE_TYPES),
  ref: z.string().min(1).max(2000),
  title: z.string().max(500),
  source: z.string().max(200).optional(),
  published: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

/** Ajoute ou retire un favori. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Favori invalide.");
  const input = { ...parsed.data };
  try {
    const res = await toggleFavorite(input, todayISO());
    return NextResponse.json({ ...res, ref: input.ref });
  } catch (e) {
    return errorResponse(e);
  }
}
