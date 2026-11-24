import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { publicCalendar, readStore } from "@/lib/calendar-store";
import { loadEvents } from "@/lib/ics";
import { expandAgenda, PERSO_ID, readAgenda } from "@/lib/agenda";
import { DEFAULT_LAYERS, MILESTONES_LAYER, milestonesToEvents, TASKS_LAYER, tasksToEvents } from "@/lib/calendar-layers";
import { listMilestones } from "@/lib/milestones";
import { readTasks } from "@/lib/tasks";

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
    const [{ events, errors, zones, displayTz }, agenda, tasks, milestones] = await Promise.all([
      loadEvents(calendars, start, end, sp.get("refresh") === "1"),
      readAgenda(),
      readTasks().catch(() => null),
      listMilestones().catch(() => []),
    ]);
    // Calques intégrés « Tâches » et « Jalons » (masquables, couleur réglable dans « Gérer les calendriers »).
    const layer = (id: typeof TASKS_LAYER | typeof MILESTONES_LAYER) => options.layers?.[id] ?? DEFAULT_LAYERS[id];
    const layers = [
      { id: TASKS_LAYER, name: "Tâches", color: layer(TASKS_LAYER).color, host: "TACHES.md", timeZone: null, layer: true, hidden: !layer(TASKS_LAYER).visible },
      { id: MILESTONES_LAYER, name: "Jalons", color: layer(MILESTONES_LAYER).color, host: "projects/*/README.md", timeZone: null, layer: true, hidden: !layer(MILESTONES_LAYER).visible },
    ];
    const layerEvents = [
      ...(layer(TASKS_LAYER).visible && tasks ? tasksToEvents(tasks.tasks, tasks.settings.timezone, displayTz, start, end) : []),
      ...(layer(MILESTONES_LAYER).visible ? milestonesToEvents(milestones, start, end) : []),
    ];
    // Calendrier « Perso » intégré (AGENDA.md) : toujours présent, modifiable.
    const perso = { id: PERSO_ID, name: agenda.settings.name, color: agenda.settings.color, host: "AGENDA.md", timeZone: null, editable: true };
    const all = [...events, ...expandAgenda(agenda.events, start, end, displayTz), ...layerEvents].sort((a, b) => a.start.localeCompare(b.start));
    return NextResponse.json({ calendars: [perso, ...calendars.map(publicCalendar), ...layers], events: all, errors, zones, displayTz, options });
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e), 500);
  }
}
