import { NextResponse } from "next/server";
import { errorResponse, fail, isSameOrigin } from "@/lib/api";
import { deleteAgendaEvent, readAgenda, toInput, updateAgendaEvent } from "@/lib/agenda";
import { agendaInputSchema } from "@/lib/agenda-schema";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const { events, version } = await readAgenda();
  const ev = events.find((e) => e.id === id);
  return ev ? NextResponse.json({ event: toInput(ev), version }) : fail("Événement introuvable.", 404);
}

/** Modifie un événement « Perso » ; son fuseau d'origine est conservé. */
export async function PATCH(req: Request, { params }: Ctx) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const body = await req.json().catch(() => null);
  const parsed = agendaInputSchema.safeParse(body);
  if (!parsed.success || typeof body?.version !== "string") return fail(parsed.error?.issues[0]?.message ?? "Données invalides.");
  try {
    const { id } = await params;
    const { events } = await readAgenda();
    const ev = events.find((e) => e.id === id);
    if (!ev) return fail("Événement introuvable.", 404);
    const res = await updateAgendaEvent(body.version, id, { ...parsed.data, timezone: ev.timezone });
    return NextResponse.json({ version: res.version });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const version = new URL(req.url).searchParams.get("version") ?? "";
  try {
    await deleteAgendaEvent(version, (await params).id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
