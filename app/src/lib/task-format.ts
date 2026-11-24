/** Libellés de dates pour les tâches (« aujourd'hui », « demain », « jeu. 27 nov. »). Pur, sans fuseau. */
import { addDays } from "./tasks-core";

export function relativeDay(iso: string, today: string): string {
  if (iso === today) return "aujourd'hui";
  if (iso === addDays(today, 1)) return "demain";
  if (iso === addDays(today, -1)) return "hier";
  const [y, m, d] = iso.split("-").map(Number);
  const opts: Intl.DateTimeFormatOptions = { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" };
  if (y !== Number(today.slice(0, 4))) opts.year = "numeric";
  return new Intl.DateTimeFormat("fr-FR", opts).format(new Date(Date.UTC(y, m - 1, d)));
}

/** « lundi 24 novembre » */
export function longDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(Date.UTC(y, m - 1, d)));
}
