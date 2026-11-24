/**
 * Indicateurs d'un projet (fonctions pures) : avancement = part des jalons atteints, dernière activité
 * (mise à jour du README, journal, tâche liée faite), prochaine tâche, « à l'arrêt » (aucune alerte).
 */
import type { Task } from "./tasks-core";

export interface ProjectStats {
  progress: { done: number; total: number; pct: number | null };
  lastActivity: string | null;
  nextTask: { title: string; date: string; time: string | null } | null;
  stalled: boolean;
}

const maxDate = (...ds: (string | null | undefined)[]) =>
  ds.filter((d): d is string => !!d && /^\d{4}-\d{2}-\d{2}/.test(d)).map((d) => d.slice(0, 10)).sort().pop() ?? null;

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function projectStats(
  p: { slug: string; status: string | null; updated: string | null; journalTop?: string | null },
  milestones: { done: boolean }[],
  tasks: Task[],
  today: string,
  stalledDays: number,
): ProjectStats {
  const done = milestones.filter((m) => m.done).length;
  const mine = tasks.filter((t) => t.project === p.slug);
  const lastActivity = maxDate(p.updated, p.journalTop, ...mine.map((t) => t.closedOn));
  const next = mine.filter((t) => t.status === "todo").sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "99").localeCompare(b.time ?? "99"))[0];
  return {
    progress: { done, total: milestones.length, pct: milestones.length ? Math.round((done / milestones.length) * 100) : null },
    lastActivity,
    nextTask: next ? { title: next.title, date: next.date, time: next.time } : null,
    stalled: p.status === "active" && (!lastActivity || daysBetween(lastActivity, today) >= stalledDays),
  };
}
