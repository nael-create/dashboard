import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, fail, isSameOrigin } from "@/lib/api";
import { updateAgendaSettings } from "@/lib/agenda";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

/** Nom et couleur du calendrier « Perso » (enregistrés dans AGENDA.md). */
export async function PATCH(req: Request) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Réglage invalide.");
  try {
    const res = await updateAgendaSettings(undefined, parsed.data);
    return NextResponse.json({ version: res.version });
  } catch (e) {
    return errorResponse(e);
  }
}
