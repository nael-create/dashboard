import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, isSameOrigin } from "@/lib/api";
import { updateStore } from "@/lib/calendar-store";

export const dynamic = "force-dynamic";

const schema = z.object({ mergeAdjacent: z.boolean() });

/** PATCH /api/calendar-options : réglages d'affichage du calendrier. */
export async function PATCH(req: Request) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Réglage invalide.");
  const options = await updateStore((store) => {
    store.options.mergeAdjacent = parsed.data.mergeAdjacent;
    return { ...store.options };
  });
  return NextResponse.json({ options });
}
