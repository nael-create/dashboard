import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, isSameOrigin } from "@/lib/api";
import { HEX_COLOR, publicCalendar, updateCalendars } from "@/lib/calendar-store";
import { forgetFeed } from "@/lib/ics";
import { isValidTimeZone } from "@/lib/tz";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z
  .object({
    name: z.string().trim().min(1, "Le nom ne peut pas être vide.").max(60, "Nom trop long (60 caractères max).").optional(),
    color: z.string().regex(HEX_COLOR, "Couleur invalide.").optional(),
    // null = détection automatique du fuseau.
    timeZone: z
      .string()
      .refine(isValidTimeZone, "Fuseau horaire inconnu (choisis-en un dans la liste).")
      .nullable()
      .optional(),
  })
  .refine((d) => d.name !== undefined || d.color !== undefined || d.timeZone !== undefined, "Rien à modifier.");

export async function PATCH(req: Request, { params }: Ctx) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides.");

  const updated = await updateCalendars((list) => {
    const cal = list.find((c) => c.id === id);
    if (!cal) return null;
    if (parsed.data.name !== undefined) cal.name = parsed.data.name;
    if (parsed.data.color !== undefined) cal.color = parsed.data.color.toLowerCase();
    if (parsed.data.timeZone !== undefined) cal.timeZone = parsed.data.timeZone;
    return { ...cal };
  });
  if (!updated) return fail("Calendrier introuvable.", 404);
  return NextResponse.json({ calendar: publicCalendar(updated) });
}

export async function DELETE(req: Request, { params }: Ctx) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const { id } = await params;
  const removed = await updateCalendars((list) => {
    const i = list.findIndex((c) => c.id === id);
    if (i === -1) return false;
    list.splice(i, 1);
    return true;
  });
  if (!removed) return fail("Calendrier introuvable.", 404);
  forgetFeed(id);
  return NextResponse.json({ ok: true });
}
