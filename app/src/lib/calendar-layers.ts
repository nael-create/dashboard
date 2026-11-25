/**
 * Calques intégrés du calendrier : « Tâches » (TACHES.md, tâches datées) et « Deadlines » (champ
 * `deadline` des projets en cours, en journée entière).
 * Fonctions pures : conversion en événements d'affichage. Les réglages (couleur, visibilité) sont
 * dans app/data/calendars.local.json (options.layers), comme ceux des autres calendriers.
 */
import type { CalEvent } from "./ics";
import type { Task } from "./tasks-core";
import { addDays, instantFromWallTime, localStamp } from "./tz";

export const TASKS_LAYER = "taches";
export const DEADLINES_LAYER = "deadlines";
export const DEFAULT_LAYERS = {
  [TASKS_LAYER]: { color: "#2f6f5e", visible: true },
  [DEADLINES_LAYER]: { color: "#6a4c93", visible: true },
};
/** Durée affichée d'une tâche horaire sans durée. */
export const DEFAULT_TASK_MINUTES = 30;

export interface TaskInfo { id: string; done: boolean; dropped: boolean; project: string | null }
export interface DeadlineInfo { project: string; projectTitle: string }
export type LayerEvent = CalEvent & { task?: TaskInfo; deadline?: DeadlineInfo };

/** Tâches qui touchent [start, end) : horaires = événements (30 min par défaut), sans heure = journée entière. */
export function tasksToEvents(tasks: Task[], taskTz: string, displayTz: string, start: string, end: string): LayerEvent[] {
  const out: LayerEvent[] = [];
  for (const t of tasks) {
    if (t.status === "dropped" || !t.date) continue;
    // Une marge d'un jour de chaque côté pour les fuseaux éloignés.
    if (t.date < addDays(start, -1) || t.date >= addDays(end, 1)) continue;
    const info: TaskInfo = { id: t.id, done: t.status === "done", dropped: false, project: t.project };
    if (!t.time) {
      if (t.date < start || t.date >= end) continue;
      out.push({ id: `${TASKS_LAYER}:${t.id}`, calendarId: TASKS_LAYER, title: t.title, allDay: true, start: t.date, end: addDays(t.date, 1), task: info });
      continue;
    }
    const [y, mo, d] = (t.date as string).split("-").map(Number);
    const ms = instantFromWallTime({ year: y, month: mo, day: d, hour: Number(t.time.slice(0, 2)), minute: Number(t.time.slice(3, 5)), second: 0 }, taskTz);
    const s = localStamp(ms, displayTz);
    const e = localStamp(ms + (t.duration ?? DEFAULT_TASK_MINUTES) * 60_000, displayTz);
    if (!(s < `${end}T00:00` && e > `${start}T00:00`)) continue;
    out.push({ id: `${TASKS_LAYER}:${t.id}`, calendarId: TASKS_LAYER, title: t.title, allDay: false, start: s, end: e, task: info });
  }
  return out;
}

/** Deadlines des projets en cours (journée entière, « Deadline · Projet »). */
export function deadlinesToEvents(list: { slug: string; title: string; deadline: string | null }[], start: string, end: string): LayerEvent[] {
  return list
    .filter((p): p is { slug: string; title: string; deadline: string } => !!p.deadline && /^\d{4}-\d{2}-\d{2}$/.test(p.deadline) && p.deadline >= start && p.deadline < end)
    .map((p) => ({
      id: `${DEADLINES_LAYER}:${p.slug}`, calendarId: DEADLINES_LAYER, title: `Deadline · ${p.title}`,
      allDay: true, start: p.deadline, end: addDays(p.deadline, 1),
      deadline: { project: p.slug, projectTitle: p.title },
    }));
}
