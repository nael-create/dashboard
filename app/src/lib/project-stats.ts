/**
 * Indicateurs d'un projet / domaine (fonctions pures) : avancement = tâches faites / tâches (hors
 * abandonnées), dernière activité (mise à jour du README, note du jour, tâche liée faite), prochaine tâche
 * (la « prochaine action », déduite des tâches et plus stockée).
 */
import type { Task } from "./tasks-core";
import { entryTasks } from "./tasks-view";

export interface ProjectStats {
  progress: { done: number; total: number; pct: number | null };
  lastActivity: string | null;
  nextTask: { id: string; title: string; date: string | null; time: string | null } | null;
}

const maxDate = (...ds: (string | null | undefined)[]) =>
  ds.filter((d): d is string => !!d && /^\d{4}-\d{2}-\d{2}/.test(d)).map((d) => d.slice(0, 10)).sort().pop() ?? null;

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function projectStats(p: { slug: string; updated: string | null; lastNote?: string | null }, tasks: Task[], today: string): ProjectStats {
  const { open, progress } = entryTasks(tasks, p.slug, today);
  const mine = tasks.filter((t) => t.project === p.slug);
  const next = open[0];
  return {
    progress: { ...progress, pct: progress.total ? Math.round((progress.done / progress.total) * 100) : null },
    lastActivity: maxDate(p.updated, p.lastNote, ...mine.map((t) => t.closedOn)),
    nextTask: next ? { id: next.id, title: next.title, date: next.date, time: next.time } : null,
  };
}
