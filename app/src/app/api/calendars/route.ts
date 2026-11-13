import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, isSameOrigin } from "@/lib/api";
import {
  HEX_COLOR, newCalendarId, normalizeFeedUrl, publicCalendar, readCalendars, updateCalendars,
} from "@/lib/calendar-store";
import { probeFeed } from "@/lib/ics";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ calendars: (await readCalendars()).map(publicCalendar) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e), 500);
  }
}

const addSchema = z.object({
  name: z.string().trim().min(1, "Donne un nom au calendrier.").max(60, "Nom trop long (60 caractères max)."),
  color: z.string().regex(HEX_COLOR, "Couleur invalide."),
  url: z.string().trim().min(1, "Colle le lien d'abonnement."),
});

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const parsed = addSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides.");

  let url: string;
  try {
    url = normalizeFeedUrl(parsed.data.url);
  } catch (e) {
    return fail(e instanceof Error && e.message.startsWith("Le lien") ? e.message : "Ce lien n'est pas une adresse valide.");
  }

  // On vérifie le lien avant de l'enregistrer.
  const probe = await probeFeed(url);
  if (!probe.ok) return fail(`Impossible de lire ce calendrier : ${probe.message}`, 422);

  const created = await updateCalendars((list) => {
    if (list.some((c) => c.url === url)) return null;
    const cal = { id: newCalendarId(), name: parsed.data.name, color: parsed.data.color.toLowerCase(), url };
    list.push(cal);
    return cal;
  });
  if (!created) return fail("Ce calendrier est déjà ajouté.", 409);
  return NextResponse.json({ calendar: publicCalendar(created), eventCount: probe.eventCount }, { status: 201 });
}
