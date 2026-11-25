/**
 * Notes du jour d'un projet / domaine (fonctions pures, testées dans test/daily-notes.test.ts).
 *
 *   ## Notes
 *
 *   ### 2026-11-25
 *
 *   Texte libre (Markdown).
 *
 *   ✓ Relire le devis        ← ajoutée toute seule quand une tâche liée est cochée ce jour-là
 *
 *   ### 2026-11-24
 *   …
 *
 * Une sous-section `### YYYY-MM-DD` par jour, la plus récente en haut : le texte libre d'abord, puis les
 * lignes « ✓ » des tâches faites. Tout reste modifiable à la main ; on ne réécrit que la sous-section
 * concernée. Le texte écrit avant la première sous-section (ancien format) est conservé tel quel.
 * Imports relatifs en .ts : utilisé aussi par le script de migration (node --experimental-strip-types).
 */
import { findSection, type Doc } from "./markdown-doc.ts";

export const NOTES_SECTION = "Notes";
const DAY = /^###\s+(\d{4}-\d{2}-\d{2})\s*$/;
const DONE = /^✓\s+(.+?)\s*$/;

export interface DayNote {
  date: string;
  /** Texte libre (sans les lignes ✓), espaces de début et de fin retirés. */
  text: string;
  /** Titres des tâches faites ce jour-là (lignes « ✓ »). */
  done: string[];
  /** Lignes [start, end) de la sous-section, titre compris. */
  start: number;
  end: number;
}

/** Sous-sections datées de « ## Notes », dans l'ordre du fichier. */
export function dayNotes(d: Doc): DayNote[] {
  const s = findSection(d, NOTES_SECTION);
  if (!s) return [];
  const out: DayNote[] = [];
  let cur: { date: string; start: number } | null = null;
  const close = (end: number) => {
    if (!cur) return;
    const body = d.lines.slice(cur.start + 1, end);
    const done: string[] = [];
    const free: string[] = [];
    for (const l of body) {
      const m = l.match(DONE);
      if (m) done.push(m[1]);
      else free.push(l);
    }
    out.push({ date: cur.date, text: trim(free).join("\n"), done, start: cur.start, end });
  };
  for (let i = s.start; i < s.end; i++) {
    const m = d.lines[i].match(DAY);
    if (m) {
      close(i);
      cur = { date: m[1], start: i };
    } else if (cur && /^#{1,3}\s/.test(d.lines[i])) {
      // Titre ### non daté : fin de la sous-section courante (contenu écrit à la main, conservé).
      close(i);
      cur = null;
    }
  }
  close(s.end);
  return out;
}

const trim = (lines: string[]) => {
  const out = [...lines];
  while (out.length && !out[0].trim()) out.shift();
  while (out.length && !out[out.length - 1].trim()) out.pop();
  return out;
};

/** Crée « ## Notes » à la fin du document si elle manque. */
function ensureNotes(d: Doc) {
  if (findSection(d, NOTES_SECTION)) return;
  while (d.lines.length && !d.lines[d.lines.length - 1].trim()) d.lines.pop();
  d.lines.push("", `## ${NOTES_SECTION}`, "");
}

/** Lignes d'une sous-section. */
function block(date: string, text: string, done: string[]): string[] {
  const t = text.replace(/\r\n/g, "\n").trim();
  return [`### ${date}`, "", ...(t ? [...t.split("\n"), ""] : []), ...(done.length ? [...done.map((x) => `✓ ${x}`), ""] : [])];
}

/** Remplace la sous-section d'un jour (créée à sa place, la plus récente en haut ; supprimée si vide). */
function writeDay(d: Doc, date: string, text: string, done: string[]) {
  ensureNotes(d);
  const days = dayNotes(d);
  const found = days.find((n) => n.date === date);
  const empty = !text.trim() && !done.length;
  if (found) {
    d.lines.splice(found.start, found.end - found.start, ...(empty ? [] : block(date, text, done)));
    return;
  }
  if (empty) return;
  const after = days.find((n) => n.date < date);
  if (after) {
    d.lines.splice(after.start, 0, ...block(date, text, done));
    return;
  }
  const s = findSection(d, NOTES_SECTION)!;
  // Après les jours plus récents (ou en tête de la section, après un éventuel texte d'introduction).
  const last = days.filter((n) => n.date > date).pop();
  const at = last ? last.end : s.end;
  const lines = block(date, text, done);
  if (at > 0 && d.lines[at - 1]?.trim()) lines.unshift("");
  d.lines.splice(at, 0, ...lines);
}

/** Texte libre d'un jour (les lignes ✓ sont gardées). Les titres « # / ## / ### » sont refusés. */
export function setDayText(d: Doc, date: string, text: string) {
  if (/^#{1,3}\s/m.test(text)) throw new Error("Pas de titres « # », « ## » ou « ### » dans une note (utilise « #### »).");
  const cur = dayNotes(d).find((n) => n.date === date);
  writeDay(d, date, text, cur?.done ?? []);
}

/** Ajoute « ✓ titre » au jour donné (sans doublon). */
export function addDone(d: Doc, date: string, title: string) {
  const t = title.replace(/\s+/g, " ").trim();
  if (!t) return;
  const cur = dayNotes(d).find((n) => n.date === date);
  if (cur?.done.includes(t)) return;
  writeDay(d, date, cur?.text ?? "", [...(cur?.done ?? []), t]);
}

/** Retire « ✓ titre » du jour donné (tâche décochée). */
export function removeDone(d: Doc, date: string, title: string) {
  const t = title.replace(/\s+/g, " ").trim();
  const cur = dayNotes(d).find((n) => n.date === date);
  if (!cur || !cur.done.includes(t)) return;
  const done = [...cur.done];
  done.splice(done.indexOf(t), 1);
  writeDay(d, date, cur.text, done);
}

/** Ajoute du texte à la fin de la note d'un jour (migration : journal, anciennes sections). */
export function appendDayText(d: Doc, date: string, text: string) {
  const cur = dayNotes(d).find((n) => n.date === date);
  const merged = [cur?.text ?? "", text.trim()].filter(Boolean).join("\n\n");
  writeDay(d, date, merged, cur?.done ?? []);
}

/** Abaisse les titres d'un texte repris dans une note (« ## X » → « #### X »). */
export const demoteHeadings = (text: string) => text.replace(/^#{1,3}(\s)/gm, "####$1");
