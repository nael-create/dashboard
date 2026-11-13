import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { publicCalendar, readCalendars } from "@/lib/calendar-store";
import { loadEvents } from "@/lib/ics";

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
    const calendars = await readCalendars();
    const { events, errors } = await loadEvents(calendars, start, end, sp.get("refresh") === "1");
    return NextResponse.json({ calendars: calendars.map(publicCalendar), events, errors });
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e), 500);
  }
}
