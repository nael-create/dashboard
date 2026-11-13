import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { publicCalendar, readStore } from "@/lib/calendar-store";
import { loadEvents } from "@/lib/ics";
import { expandAgenda, PERSO_ID, readAgenda } from "@/lib/agenda";

export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** GET /api/events?start=YYYY-MM-DD&end=YYYY-MM-DD[&refresh=1] (end exclusif, 62 jours max). */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const start = sp.get("start") ?? "";
  const end = sp.get("end") ?? "";
  if (!DATE.test(start) || !DATE.test(end) || end <= start) return fail("Période invalide.");
  if ((Date.parse(end) - Date.parse(start)) / 86_400_000 > 62) return fail("Période trop longue (62 jours max).");

  try {
    const { calendars, options } = await readStore();
    const [{ events, errors, zones, displayTz }, agenda] = await Promise.all([
      loadEvents(calendars, start, end, sp.get("refresh") === "1"),
      readAgenda(),
    ]);
    // Calendrier « Perso » intégré (AGENDA.md) : toujours présent, modifiable.
    const perso = { id: PERSO_ID, name: agenda.settings.name, color: agenda.settings.color, host: "AGENDA.md", timeZone: null, editable: true };
    const all = [...events, ...expandAgenda(agenda.events, start, end, displayTz)].sort((a, b) => a.start.localeCompare(b.start));
    return NextResponse.json({ calendars: [perso, ...calendars.map(publicCalendar)], events: all, errors, zones, displayTz, options });
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e), 500);
  }
}
