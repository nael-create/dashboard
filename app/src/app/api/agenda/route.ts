import { NextResponse } from "next/server";
import { errorResponse, fail, isSameOrigin } from "@/lib/api";
import { addAgendaEvent } from "@/lib/agenda";
import { agendaInputSchema } from "@/lib/agenda-schema";
import { displayTimeZone } from "@/lib/display-tz";

export const dynamic = "force-dynamic";

/** Nouvel événement « Perso » (fuseau = fuseau d'affichage, enregistré explicitement). */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const parsed = agendaInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides.");
  try {
    const res = await addAgendaEvent({ ...parsed.data, timezone: displayTimeZone() });
    return NextResponse.json({ id: res.result, version: res.version }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
