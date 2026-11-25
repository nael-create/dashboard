/**
 * Regroupements d'affichage des tâches (fonctions pures, testées) : sections du jour, progression,
 * historique par semaine, tâches d'un projet / domaine et sa prochaine tâche (« prochaine action »
 * dérivée, plus stockée). Aucun score, aucune série.
 */
import { addDays, isDated, isoWeekday, weekStart, type DatedTask, type Task } from "./tasks-core";

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
const byDayOrder = (a: DatedTask, b: DatedTask) => a.date.localeCompare(b.date) || a.line - b.line;

/** Ligne où insérer une nouvelle tâche : avant la 1re tâche du même jour plus tardive, sinon fin de fichier. */
export function insertionLine(tasks: Task[], date: string | null, time: string | null, fileLength: number): number {
  if (date && time) {
    const later = tasks.filter((t) => t.date === date && t.status === "todo" && t.time && t.time > time).sort((a, b) => a.line - b.line)[0];
    if (later) return later.line;
  }
  return fileLength;
}

export interface TaskSections {
  overdue: DatedTask[];
  today: DatedTask[];
  /** Faites (ou abandonnées) aujourd'hui, montrées barrées sous « aujourd'hui ». */
  todayDone: DatedTask[];
  tomorrow: DatedTask[];
  week: DatedTask[];
  /** Au-delà de « cette semaine » (repliée par défaut). */
  later: DatedTask[];
}

/** Sections de l'onglet « aujourd'hui » : tâches DATÉES seulement (les tâches sans date restent dans leur projet). */
export function groupTasks(all: Task[], today: string): TaskSections {
  const tasks = all.filter(isDated);
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
export function todayProgress(all: Task[], today: string): { done: number; total: number } {
  const planned = all.filter(isDated).filter((t) => t.status !== "dropped" && (t.date === today || (t.status === "done" && t.closedOn === today && t.date < today)));
  return { done: planned.filter((t) => t.status === "done").length, total: planned.length };
}

/** Historique : tâches faites et abandonnées, groupées par semaine (lundi) de fin, plus récentes d'abord. */
export function historyByWeek(tasks: Task[]): { week: string; tasks: Task[] }[] {
  const closed = tasks.filter((t) => t.status !== "todo" && (t.closedOn || t.date));
  const map = new Map<string, Task[]>();
  for (const t of closed) {
    const w = weekStart((t.closedOn ?? t.date)!);
    map.set(w, [...(map.get(w) ?? []), t]);
  }
  const key = (t: Task) => t.closedOn ?? t.date ?? "";
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([week, list]) => ({ week, tasks: list.sort((a, b) => key(b).localeCompare(key(a)) || a.line - b.line) }));
}

/**
 * Ordre des tâches ouvertes d'un projet / domaine : en retard d'abord, puis par date, puis sans date
 * (dans l'ordre du fichier, réglable à la main).
 */
export function openOrder(today: string) {
  return (a: Task, b: Task) => {
    const rank = (t: Task) => (!t.date ? 2 : t.date < today ? 0 : 1);
    return rank(a) - rank(b) || (a.date && b.date ? a.date.localeCompare(b.date) : 0) || (a.time ?? "").localeCompare(b.time ?? "") || a.line - b.line;
  };
}

/** Tâches d'un projet / domaine : à faire (voir `openOrder`) puis faites / abandonnées (plus récentes d'abord). */
export function entryTasks(tasks: Task[], slug: string, today: string) {
  const mine = tasks.filter((t) => t.project === slug);
  const key = (t: Task) => t.closedOn ?? t.date ?? "";
  return {
    open: mine.filter((t) => t.status === "todo").sort(openOrder(today)),
    closed: mine.filter((t) => t.status !== "todo").sort((a, b) => key(b).localeCompare(key(a)) || b.line - a.line),
    progress: { done: mine.filter((t) => t.status === "done").length, total: mine.filter((t) => t.status !== "dropped").length },
  };
}

/** « Prochaine action » dérivée : la première tâche ouverte (en retard, puis par date, puis sans date). */
export function nextTask(tasks: Task[], slug: string, today: string): Task | null {
  return entryTasks(tasks, slug, today).open[0] ?? null;
}
