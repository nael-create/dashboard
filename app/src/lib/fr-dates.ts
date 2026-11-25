/**
 * Dates en français pour l'interface (fonctions pures, sans fuseau : tout est en YYYY-MM-DD).
 * « 25 nov. 2026 », « mercredi 25 novembre », puces de deadline (« dans 12 jours · 7 déc. »,
 * « en retard de 2 jours »), puces de tâche (« ven. 28 nov. », « en retard de 2 j »), raccourcis
 * (« ce week-end », « semaine prochaine », « fin du mois ») et grille du mini-calendrier.
 * Jamais de format « 11/25/2026 ».
 */
import { addDays, isoWeekday } from "./tasks-core";

const utc = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", ...opts }).format(utc(iso));
export const isIsoDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

/** Jours de `from` à `to` (négatif si `to` est avant). */
export function dayDiff(from: string, to: string): number {
  return Math.round((utc(to).getTime() - utc(from).getTime()) / 86_400_000);
}

/** « 25 nov. 2026 » */
export const shortDate = (iso: string) => fmt(iso, { day: "numeric", month: "short", year: "numeric" });
/** « 7 déc. » (année ajoutée si elle diffère de celle de `today`). */
export const dayMonth = (iso: string, today?: string) =>
  fmt(iso, { day: "numeric", month: "short", ...(today && iso.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}) });
/** « mercredi 25 novembre » (année ajoutée si elle diffère de celle de `today`). */
export const longDate = (iso: string, today?: string) =>
  fmt(iso, { weekday: "long", day: "numeric", month: "long", ...(today && iso.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}) });
/** « novembre 2026 » */
export const monthTitle = (year: number, month: number) => fmt(`${year}-${String(month).padStart(2, "0")}-01`, { month: "long", year: "numeric" });

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export type ChipTone = "overdue" | "soon" | "normal";

/** Puce de deadline d'un projet : « aujourd'hui », « demain », « dans 12 jours · 7 déc. », « en retard de 2 jours ». */
export function deadlineChip(iso: string, today: string): { text: string; tone: ChipTone } {
  const n = dayDiff(today, iso);
  if (n < 0) return { text: `en retard de ${plural(-n, "jour", "jours")}`, tone: "overdue" };
  if (n === 0) return { text: "aujourd'hui", tone: "soon" };
  if (n === 1) return { text: "demain", tone: "soon" };
  return { text: `dans ${plural(n, "jour", "jours")} · ${dayMonth(iso, today)}`, tone: n <= 3 ? "soon" : "normal" };
}

/** Puce de date d'une tâche : « aujourd'hui », « demain », « ven. 28 nov. », « en retard de 2 j ». */
export function taskDateChip(iso: string, today: string): { text: string; tone: ChipTone } {
  const n = dayDiff(today, iso);
  if (n < 0) return { text: `en retard de ${-n} j`, tone: "overdue" };
  if (n === 0) return { text: "aujourd'hui", tone: "soon" };
  if (n === 1) return { text: "demain", tone: "normal" };
  return { text: fmt(iso, { weekday: "short", day: "numeric", month: "short", ...(iso.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}) }), tone: "normal" };
}

/** Samedi qui vient (aujourd'hui si on est samedi ou dimanche). */
export function thisWeekend(today: string): string {
  const wd = isoWeekday(today);
  return wd >= 6 ? today : addDays(today, 6 - wd);
}
/** Lundi de la semaine prochaine. */
export const nextWeek = (today: string) => addDays(today, 8 - isoWeekday(today));
/** Dernier jour du mois en cours. */
export function endOfMonth(today: string): string {
  const [y, m] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export interface DatePreset { label: string; date: string }
/** Raccourcis de la deadline d'un projet. */
export const deadlinePresets = (today: string): DatePreset[] => [
  { label: "Dans 1 semaine", date: addDays(today, 7) },
  { label: "Dans 2 semaines", date: addDays(today, 14) },
  { label: "Fin du mois", date: endOfMonth(today) },
];
/** Raccourcis de la date d'une tâche. */
export const taskPresets = (today: string): DatePreset[] => [
  { label: "Aujourd'hui", date: today },
  { label: "Demain", date: addDays(today, 1) },
  { label: "Ce week-end", date: thisWeekend(today) },
  { label: "Semaine prochaine", date: nextWeek(today) },
];

/** Grille d'un mois (semaines du lundi au dimanche) ; `null` = case hors du mois. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const days = Number(endOfMonth(first).slice(8));
  const cells: (string | null)[] = Array(isoWeekday(first) - 1).fill(null);
  for (let d = 1; d <= days; d++) cells.push(`${first.slice(0, 8)}${String(d).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
export const WEEKDAY_INITIALS = ["L", "M", "M", "J", "V", "S", "D"];
export const WEEKDAY_NAMES = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
