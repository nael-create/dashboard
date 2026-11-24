/**
 * Regroupements d'affichage des tâches (fonctions pures, testées) : sections du jour, progression,
 * historique par semaine. Aucun score, aucune série : seulement « faites / prévues aujourd'hui ».
 */
import { addDays, isoWeekday, weekStart, type Task } from "./tasks-core";

export type SectionKey = "overdue" | "today" | "tomorrow" | "week";

export const SECTION_LABELS: Record<SectionKey, string> = {
  overdue: "en retard",
  today: "aujourd'hui",
  tomorrow: "demain",
  week: "cette semaine",
};

/** Dernier jour de « cette semaine » : dimanche ; le samedi et le dimanche, on montre la semaine suivante. */
export function weekEnd(today: string): string {
  const sunday = addDays(weekStart(today), 6);
  return isoWeekday(today) >= 6 ? addDays(sunday, 7) : sunday;
}

/**
 * Ordre dans une journée : celui des lignes du fichier (glisser-déposer, ⌥↑/↓). Une nouvelle tâche
 * avec heure est insérée à sa place horaire parmi celles du même jour (voir `insertionLine`).
 */
const byDayOrder = (a: Task, b: Task) => a.date.localeCompare(b.date) || a.line - b.line;

/** Ligne où insérer une nouvelle tâche : avant la 1re tâche du même jour plus tardive, sinon fin de fichier. */
export function insertionLine(tasks: Task[], date: string, time: string | null, fileLength: number): number {
  if (time) {
    const later = tasks.filter((t) => t.date === date && t.status === "todo" && t.time && t.time > time).sort((a, b) => a.line - b.line)[0];
    if (later) return later.line;
  }
  return fileLength;
}

export interface TaskSections {
  overdue: Task[];
  today: Task[];
  /** Faites (ou abandonnées) aujourd'hui, montrées barrées sous « aujourd'hui ». */
  todayDone: Task[];
  tomorrow: Task[];
  week: Task[];
  /** Au-delà de « cette semaine » (repliée par défaut). */
  later: Task[];
}

export function groupTasks(tasks: Task[], today: string): TaskSections {
  const tomorrow = addDays(today, 1);
  const end = weekEnd(today);
  const todo = tasks.filter((t) => t.status === "todo").sort(byDayOrder);
  return {
    overdue: todo.filter((t) => t.date < today),
    today: todo.filter((t) => t.date === today),
    todayDone: tasks.filter((t) => t.status !== "todo" && (t.date === today || t.closedOn === today) && t.date <= today).sort(byDayOrder),
    tomorrow: todo.filter((t) => t.date === tomorrow),
    week: todo.filter((t) => t.date > tomorrow && t.date <= end),
    later: todo.filter((t) => t.date > end && t.date > tomorrow),
  };
}

/** « 3 / 7 » : tâches faites parmi celles prévues aujourd'hui (les abandonnées ne comptent pas). */
export function todayProgress(tasks: Task[], today: string): { done: number; total: number } {
  const planned = tasks.filter((t) => t.status !== "dropped" && (t.date === today || (t.status === "done" && t.closedOn === today && t.date < today)));
  return { done: planned.filter((t) => t.status === "done").length, total: planned.length };
}

/** Historique : tâches faites et abandonnées, groupées par semaine (lundi) de fin, plus récentes d'abord. */
export function historyByWeek(tasks: Task[]): { week: string; tasks: Task[] }[] {
  const closed = tasks.filter((t) => t.status !== "todo");
  const map = new Map<string, Task[]>();
  for (const t of closed) {
    const w = weekStart(t.closedOn ?? t.date);
    map.set(w, [...(map.get(w) ?? []), t]);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([week, list]) => ({ week, tasks: list.sort((a, b) => (b.closedOn ?? b.date).localeCompare(a.closedOn ?? a.date) || a.line - b.line) }));
}

/** Tâches d'un projet : à faire (par date) puis faites récemment. */
export function projectTasks(tasks: Task[], slug: string) {
  const mine = tasks.filter((t) => t.project === slug);
  return {
    todo: mine.filter((t) => t.status === "todo").sort(byDayOrder),
    closed: mine.filter((t) => t.status !== "todo").sort((a, b) => (b.closedOn ?? b.date).localeCompare(a.closedOn ?? a.date)),
  };
}
