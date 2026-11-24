/**
 * Saisie rapide d'une tâche en français : « Appeler la banque demain 14h #medtech ».
 * Reconnaît (et retire du titre) : aujourd'hui, demain, après-demain, un jour de la semaine
 * (« lundi » = le prochain lundi, jamais aujourd'hui), une date (25/11, 25/11/2027, 25 nov, 1er décembre),
 * une heure (14h, 14h30, 9:15, à 1h, midi, minuit), une durée (30min, 1h, 1h30 — voir `isDuration`),
 * #projet (s'il existe), une récurrence (tous les jours, chaque lundi, tous les mois le 1er) et ⏰ / ⏰-30m.
 * En cas d'ambiguïté (deux dates, date impossible), le texte est gardé dans le titre et la date reste
 * aujourd'hui : on la corrige à la main. Fonctions pures, testées dans test/task-input.test.ts.
 */
import {
  addDays, daysInMonth, isoWeekday, isValidDate, parseReminder, WEEKDAYS, type Recurrence,
} from "./tasks-core";

export interface ParsedTask {
  title: string;
  date: string;
  time: string | null;
  duration: number | null;
  project: string | null;
  reminder: number | null;
  recurrence: Recurrence | null;
  /** Morceaux reconnus, pour l'aperçu (« demain », « 14:00 », « #medtech »…). */
  chips: string[];
  /** Parmi `chips`, ceux qui désignent la date (remplacés par la date lisible dans l'aperçu). */
  dateChips: string[];
  /** Date incertaine : le texte a été laissé dans le titre. */
  ambiguous: boolean;
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’']/g, "'");

const MONTHS: [string, number][] = [
  ["janvier", 1], ["janv", 1], ["jan", 1], ["fevrier", 2], ["fevr", 2], ["fev", 2], ["mars", 3], ["mar", 3],
  ["avril", 4], ["avr", 4], ["mai", 5], ["juin", 6], ["juillet", 7], ["juil", 7], ["aout", 8],
  ["septembre", 9], ["sept", 9], ["sep", 9], ["octobre", 10], ["oct", 10], ["novembre", 11], ["nov", 11],
  ["decembre", 12], ["dec", 12],
];
const monthOf = (w: string) => MONTHS.find(([name]) => fold(w).replace(/\.$/, "") === name)?.[1] ?? null;
const weekdayOf = (w: string) => {
  const f = fold(w).replace(/s$/, "");
  const i = WEEKDAYS.indexOf(f);
  return i === -1 ? null : i + 1;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Date au jour/mois donnés : cette année, ou l'an prochain si elle est déjà passée. */
function dayMonth(today: string, day: number, month: number, year?: number): string | null {
  const y0 = Number(today.slice(0, 4));
  const build = (y: number) => `${y}-${pad(month)}-${pad(day)}`;
  if (year !== undefined) return isValidDate(build(year)) ? build(year) : null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (isValidDate(build(y0)) && build(y0) >= today) return build(y0);
  return isValidDate(build(y0 + 1)) ? build(y0 + 1) : null;
}

/** Prochain jour de semaine STRICTEMENT après aujourd'hui (« lundi » un lundi = lundi prochain). */
export const nextWeekday = (today: string, weekday: number) => addDays(today, ((weekday - isoWeekday(today) + 7) % 7) || 7);
/** Premier jour ≥ aujourd'hui qui tombe ce jour de semaine (pour une récurrence). */
const firstWeekday = (today: string, weekday: number) => addDays(today, (weekday - isoWeekday(today) + 7) % 7);
function firstMonthDay(today: string, day: number): string {
  const [y, m, d] = today.split("-").map(Number);
  if (day >= d) return `${y}-${pad(m)}-${pad(Math.min(day, daysInMonth(y, m)))}`;
  const [ny, nm] = m === 12 ? [y + 1, 1] : [y, m + 1];
  return `${ny}-${pad(nm)}-${pad(Math.min(day, daysInMonth(ny, nm)))}`;
}

/**
 * « Nh » / « NhMM » : durée si précédé de « pendant », ou si une heure a déjà été reconnue,
 * ou si l'heure est petite (moins de 6 h) sans « à » devant ; sinon c'est une heure (« 14h »).
 */
function isDuration(hours: number, prev: string | undefined, timeAlready: boolean) {
  if (prev === "pendant") return true;
  if (prev === "a") return false;
  return timeAlready || hours < 6;
}

export function parseTaskInput(input: string, today: string, projects: string[] = []): ParsedTask {
  const words = input.replace(/⏰/g, " ⏰").trim().split(/\s+/).filter(Boolean);
  const used = new Set<number>();
  const chips: string[] = [];
  let date: string | null = null;
  let dateCount = 0;
  let ambiguous = false;
  let time: string | null = null;
  let duration: number | null = null;
  let project: string | null = null;
  let reminder: number | null = null;
  let recurrence: Recurrence | null = null;
  const f = words.map(fold);
  // Mots et étiquettes de date, pour pouvoir les rendre au titre en cas d'ambiguïté.
  const dateIdx: number[] = [];
  const dateChips: string[] = [];
  const setDate = (d: string | null, idx: number[], label: string, glue?: number) => {
    if (!d) {
      ambiguous = true;
      return;
    }
    dateCount++;
    if (dateCount > 1) ambiguous = true;
    date ??= d;
    const all = glue !== undefined ? [...idx, glue] : idx;
    all.forEach((i) => used.add(i));
    dateIdx.push(...all);
    chips.push(label);
    dateChips.push(label);
  };
  // Petit mot lié à une date ou une heure (« le 25 », « à 14h ») : retiré avec elle.
  const glueBefore = (i: number, ...glue: string[]) => (i > 0 && glue.includes(f[i - 1]) && !used.has(i - 1) ? i - 1 : undefined);
  const swallow = (i: number, ...glue: string[]) => {
    const g = glueBefore(i, ...glue);
    if (g !== undefined) used.add(g);
  };

  for (let i = 0; i < words.length; i++) {
    if (used.has(i)) continue;
    const w = f[i];
    const next = f[i + 1];
    let m: RegExpMatchArray | null;

    // Récurrences (avant les jours de semaine)
    if ((w === "tous" || w === "toutes") && next === "les" && f[i + 2]) {
      const third = f[i + 2];
      if (third === "jours") {
        recurrence = { kind: "daily" };
        [i, i + 1, i + 2].forEach((k) => used.add(k));
        chips.push("tous les jours");
        continue;
      }
      const wd = weekdayOf(third);
      if (wd) {
        recurrence = { kind: "weekly", weekday: wd };
        [i, i + 1, i + 2].forEach((k) => used.add(k));
        chips.push(`chaque ${WEEKDAYS[wd - 1]}`);
        setDate(firstWeekday(today, wd), [], `dès le ${firstWeekday(today, wd)}`);
        continue;
      }
      if (third === "mois" && f[i + 3] === "le" && (m = (f[i + 4] ?? "").match(/^(\d{1,2})(er|e)?$/))) {
        const day = Number(m[1]);
        if (day >= 1 && day <= 31) {
          recurrence = { kind: "monthly", day };
          [i, i + 1, i + 2, i + 3, i + 4].forEach((k) => used.add(k));
          chips.push(`le ${day} de chaque mois`);
          setDate(firstMonthDay(today, day), [], `dès le ${firstMonthDay(today, day)}`);
          continue;
        }
      }
    }
    if (w === "chaque" && next) {
      if (next === "jour") {
        recurrence = { kind: "daily" };
        used.add(i).add(i + 1);
        chips.push("tous les jours");
        continue;
      }
      const wd = weekdayOf(next);
      if (wd) {
        recurrence = { kind: "weekly", weekday: wd };
        used.add(i).add(i + 1);
        chips.push(`chaque ${WEEKDAYS[wd - 1]}`);
        setDate(firstWeekday(today, wd), [], `dès le ${firstWeekday(today, wd)}`);
        continue;
      }
      if (next === "mois" && f[i + 2] === "le" && (m = (f[i + 3] ?? "").match(/^(\d{1,2})(er|e)?$/))) {
        const day = Number(m[1]);
        recurrence = { kind: "monthly", day };
        [i, i + 1, i + 2, i + 3].forEach((k) => used.add(k));
        chips.push(`le ${day} de chaque mois`);
        setDate(firstMonthDay(today, day), [], `dès le ${firstMonthDay(today, day)}`);
        continue;
      }
    }

    // Jours relatifs
    if (w === "aujourd'hui" || w === "aujourdhui" || w === "auj") {
      setDate(today, [i], "aujourd'hui");
      continue;
    }
    if (w === "demain") {
      setDate(addDays(today, 1), [i], "demain");
      continue;
    }
    if (w === "apres-demain" || (w === "apres" && next === "demain")) {
      setDate(addDays(today, 2), w === "apres" ? [i, i + 1] : [i], "après-demain");
      continue;
    }
    // Jour de la semaine (« lundi », « lundi prochain »)
    const wd = weekdayOf(w);
    if (wd && !w.endsWith("s")) {
      const idx = next === "prochain" ? [i, i + 1] : [i];
      setDate(nextWeekday(today, wd), idx, WEEKDAYS[wd - 1], glueBefore(i, "ce", "le"));
      continue;
    }
    // 25/11, 25/11/2027, 25/11/27
    if ((m = w.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/))) {
      const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : undefined;
      const d = dayMonth(today, Number(m[1]), Number(m[2]), y);
      setDate(d, [i], d ?? words[i], glueBefore(i, "le"));
      continue;
    }
    // 25 nov, 1er décembre, 25 novembre 2027
    if ((m = w.match(/^(\d{1,2})(er)?$/)) && next && monthOf(next)) {
      const yearTok = f[i + 2]?.match(/^\d{4}$/) ? Number(f[i + 2]) : undefined;
      const d = dayMonth(today, Number(m[1]), monthOf(next)!, yearTok);
      setDate(d, yearTok ? [i, i + 1, i + 2] : [i, i + 1], d ?? `${words[i]} ${words[i + 1]}`, glueBefore(i, "le"));
      continue;
    }
    // Heures et durées
    if (w === "midi" || w === "minuit") {
      if (!time) {
        time = w === "midi" ? "12:00" : "00:00";
        used.add(i);
        swallow(i, "a");
        chips.push(time);
      }
      continue;
    }
    if ((m = w.match(/^([01]?\d|2[0-3]):([0-5]\d)$/))) {
      if (!time) {
        time = `${pad(Number(m[1]))}:${m[2]}`;
        used.add(i);
        swallow(i, "a", "vers");
        chips.push(time);
      }
      continue;
    }
    if ((m = w.match(/^(\d{1,2})h(\d{2})?$/))) {
      const h = Number(m[1]);
      const min = Number(m[2] ?? 0);
      const prev = i > 0 && !used.has(i - 1) ? f[i - 1] : undefined;
      if (isDuration(h, prev, !!time) && duration === null && h <= 12) {
        duration = h * 60 + min;
        used.add(i);
        swallow(i, "pendant");
        chips.push(`durée ${h}h${m[2] ?? ""}`);
        continue;
      }
      if (!time && h <= 23 && min <= 59) {
        time = `${pad(h)}:${pad(min)}`;
        used.add(i);
        swallow(i, "a", "vers");
        chips.push(time);
      }
      continue;
    }
    if ((m = w.match(/^(\d{1,3})\s?(min|mn|minutes?)$/)) && duration === null) {
      duration = Number(m[1]);
      used.add(i);
      swallow(i, "pendant");
      chips.push(`durée ${duration} min`);
      continue;
    }
    // Rappel
    if (w.startsWith("⏰") && parseReminder(w.replace("mn", "m")) !== null) {
      reminder = parseReminder(w.replace("mn", "m"));
      used.add(i);
      chips.push(reminder === 0 ? "rappel à l'heure" : `rappel ${reminder} min avant`);
      continue;
    }
    // Projet
    if ((m = words[i].match(/^#([a-z0-9-]+)$/i))) {
      const slug = m[1].toLowerCase();
      if (!project && projects.includes(slug)) {
        project = slug;
        used.add(i);
        chips.push(`#${slug}`);
      }
      continue;
    }
  }

  // Ambiguïté : le texte de date reste dans le titre, la date revient à aujourd'hui (à corriger à la main).
  if (ambiguous) {
    date = null;
    dateIdx.forEach((k) => used.delete(k));
    for (const c of dateChips) chips.splice(chips.indexOf(c), 1);
  }
  const title = words.filter((_, i) => !used.has(i)).join(" ").replace(/\s+([,.;:!?])/g, "$1").trim();
  return { title, date: date ?? today, time, duration, project, reminder: time ? reminder : null, recurrence, chips, dateChips: ambiguous ? [] : dateChips, ambiguous };
}

