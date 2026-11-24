import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, isSameOrigin } from "@/lib/api";
import { HEX_COLOR, updateStore } from "@/lib/calendar-store";
import { DEFAULT_LAYERS, MILESTONES_LAYER, TASKS_LAYER } from "@/lib/calendar-layers";

export const dynamic = "force-dynamic";

const layer = z.object({ color: z.string().regex(HEX_COLOR, "Couleur invalide.").optional(), visible: z.boolean().optional() });
const schema = z.object({
  mergeAdjacent: z.boolean().optional(),
  layer: z.object({ id: z.enum([TASKS_LAYER, MILESTONES_LAYER]), set: layer }).optional(),
});

/** PATCH /api/calendar-options : réglages d'affichage du calendrier. */
export async function PATCH(req: Request) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Réglage invalide.");
  const options = await updateStore((store) => {
    if (parsed.data.mergeAdjacent !== undefined) store.options.mergeAdjacent = parsed.data.mergeAdjacent;
    const l = parsed.data.layer;
    if (l) {
      const cur = store.options.layers?.[l.id] ?? DEFAULT_LAYERS[l.id];
      store.options.layers = { ...store.options.layers, [l.id]: { color: l.set.color ?? cur.color, visible: l.set.visible ?? cur.visible } };
    }
    return { ...store.options };
  });
  return NextResponse.json({ options });
}
