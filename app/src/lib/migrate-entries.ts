/**
 * Migration vers les projets / domaines simplifiés (2026-11-25). Fonction pure et IDEMPOTENTE : sur un
 * README déjà migré, elle ne change rien et ne crée aucune tâche. Rien n'est perdu :
 * - « Prochaines actions » → tâches sans date liées au projet (TACHES.md) ; `next_action` réel aussi ;
 * - « Jalons » → tâches datées (atteints = faites) ;
 * - « Journal » → notes du jour (« Fait : X » et « Jalon atteint : X » deviennent « ✓ X ») ;
 * - Objectif, Pourquoi, Critères de réussite, Ressources, Risques, Liens (projets) / Rôle, Standards à
 *   maintenir (domaines) et l'ancien texte de « ## Notes » : supprimés s'ils ne contiennent que
 *   « TODO: fill in », sinon déplacés dans une note datée du jour `updated`, titrée « Ancien contenu : … » ;
 * - frontmatter : `stage` et `next_action` retirés ; `started` / `tags` retirés seulement s'ils sont vides.
 * Les sections ajoutées à la main (autres titres) sont gardées telles quelles.
 * Imports relatifs en .ts : utilisé par app/scripts/migrate-entries.ts (node --experimental-strip-types).
 */
import { appendDayText, addDone, dayNotes, demoteHeadings, NOTES_SECTION } from "./daily-notes.ts";
import { actions, findSection, journal, milestones, parseDoc, serializeDoc, type Doc } from "./markdown-doc.ts";
import type { Task } from "./tasks-core.ts";

export type EntryKind = "project" | "area";
export type NewTask = Pick<Task, "status" | "date" | "title" | "project" | "closedOn">;

const OLD_SECTIONS: Record<EntryKind, string[]> = {
  project: ["Objectif", "Pourquoi", "Critères de réussite", "Ressources", "Risques", "Liens"],
  area: ["Rôle", "Standards à maintenir"],
};

/** Texte « vide » : rien, « TODO: fill in », puces vides ou commentaires HTML seulement. */
export function isTrivial(text: string | null | undefined): boolean {
  if (!text) return true;
  const rest = text
    .replace(/<!--[\s\S]*?-->/g, "")
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-*]\s+(?:\[[ xX]\]\s+)?)?/, "").trim())
    .filter((l) => l && l !== "TODO: fill in");
  return rest.length === 0;
}

function field(d: Doc, key: string): string | null {
  if (!d.fm) return null;
  for (let i = d.fm.start + 1; i < d.fm.end; i++) {
    const m = d.lines[i].match(new RegExp(`^${key}\\s*:\\s*(.*?)\\s*(?:\\s#.*)?$`));
    if (m) return m[1].replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1").trim();
  }
  return null;
}

function removeField(d: Doc, key: string) {
  if (!d.fm) return false;
  for (let i = d.fm.start + 1; i < d.fm.end; i++) {
    if (new RegExp(`^${key}\\s*:`).test(d.lines[i])) {
      d.lines.splice(i, 1);
      d.fm.end--;
      return true;
    }
  }
  return false;
}

function sectionBody(d: Doc, name: string): string | null {
  const s = findSection(d, name);
  if (!s) return null;
  return d.lines.slice(s.start, s.end).join("\n").trim();
}

function removeSection(d: Doc, name: string) {
  const s = findSection(d, name);
  if (!s) return;
  d.lines.splice(s.heading, s.end - s.heading);
}

export interface MigrationResult {
  text: string;
  changed: boolean;
  tasks: NewTask[];
  report: string[];
}

/**
 * Migre un README. `openTitles` : titres des tâches déjà liées à ce projet dans TACHES.md (pour ne pas
 * créer de doublon, y compris en relançant la migration). `today` : date de repli si `updated` manque.
 */
export function migrateReadme(text: string, kind: EntryKind, slug: string, existingTitles: Set<string>, today: string): MigrationResult {
  const d = parseDoc(text);
  const report: string[] = [];
  const tasks: NewTask[] = [];
  const seen = new Set(existingTitles);
  const updated = /^\d{4}-\d{2}-\d{2}$/.test(field(d, "updated") ?? "") ? field(d, "updated")! : today;
  const addTask = (t: NewTask) => {
    const key = t.title.replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    tasks.push({ ...t, title: key });
  };

  // Notes déjà au nouveau format ? (sous-sections ### datées) Sinon, l'ancien texte de « ## Notes » est repris.
  const notesBody = sectionBody(d, NOTES_SECTION);
  const notesAreDaily = dayNotes(d).length > 0;
  const oldNotes = notesBody !== null && !notesAreDaily && !isTrivial(notesBody) ? notesBody : null;
  // (Une section qui ne contient que des commentaires HTML — nouveau modèle — est laissée telle quelle.)
  if (notesBody !== null && !notesAreDaily && notesBody.replace(/<!--[\s\S]*?-->/g, "").trim()) {
    const s = findSection(d, NOTES_SECTION)!;
    d.lines.splice(s.start, s.end - s.start, "");
    if (oldNotes) report.push("Notes : ancien texte déplacé dans une note datée");
  }

  // 1. Prochaines actions → tâches sans date.
  const acts = actions(d).filter((a) => !isTrivial(a.text));
  for (const a of acts) addTask({ status: a.done ? "done" : "todo", date: null, title: a.text, project: slug, closedOn: a.done ? updated : null });
  if (findSection(d, "Prochaines actions")) {
    removeSection(d, "Prochaines actions");
    report.push(`Prochaines actions : ${acts.length} → tâches sans date`);
  }

  // 2. next_action (n'est plus stocké, il est déduit des tâches).
  const next = field(d, "next_action");
  if (next !== null) {
    if (!isTrivial(next)) {
      const before = tasks.length;
      addTask({ status: "todo", date: null, title: next, project: slug, closedOn: null });
      if (tasks.length > before) {
        // Placée en premier : c'était la prochaine action.
        tasks.unshift(tasks.pop()!);
        report.push("next_action → tâche sans date (en tête)");
      }
    }
    removeField(d, "next_action");
  }

  // 3. Jalons → tâches datées.
  const ms = milestones(d);
  for (const m of ms) addTask({ status: m.done ? "done" : "todo", date: m.date, title: m.text, project: slug, closedOn: m.done ? m.date : null });
  if (findSection(d, "Jalons")) {
    removeSection(d, "Jalons");
    if (ms.length) report.push(`Jalons : ${ms.length} → tâches datées`);
  }

  // 4. Journal → notes du jour.
  const entries = journal(d);
  const journalBody = sectionBody(d, "Journal");
  if (journalBody !== null) {
    const leftovers = journalBody
      .replace(/<!--[\s\S]*?-->/g, "")
      .split("\n")
      .filter((l) => l.trim() && !/^\s*[-*]\s+\d{4}-\d{2}-\d{2}\s+[—–-]\s+/.test(l));
    removeSection(d, "Journal");
    // Le plus ancien d'abord, pour garder l'ordre du journal dans chaque note.
    for (const e of [...entries].reverse()) {
      const fait = e.text.match(/^(?:Fait|Jalon atteint)\s*:\s*(.+)$/);
      if (fait) addDone(d, e.date, fait[1]);
      else appendDayText(d, e.date, demoteHeadings(e.text));
    }
    if (leftovers.length) appendDayText(d, updated, `**Ancien contenu : Journal**\n\n${demoteHeadings(leftovers.join("\n"))}`);
    if (entries.length) report.push(`Journal : ${entries.length} entrée(s) → notes du jour`);
  }

  // 5. Sections retirées : vides → supprimées ; remplies → note « Ancien contenu : … ».
  const moved: [string, string][] = [];
  for (const name of OLD_SECTIONS[kind]) {
    const body = sectionBody(d, name);
    if (body === null) continue;
    if (!isTrivial(body)) moved.push([name, body]);
    removeSection(d, name);
  }
  if (oldNotes) moved.unshift(["Notes", oldNotes]);
  for (const [name, body] of moved) {
    // Ajoutées à la note du jour `updated`, dans l'ordre d'origine des sections.
    appendDayText(d, updated, `**Ancien contenu : ${name}**\n\n${demoteHeadings(body)}`);
    if (name !== "Notes") report.push(`${name} : contenu déplacé dans une note datée du ${updated}`);
  }

  // 6. Frontmatter.
  if (removeField(d, "stage")) report.push("stage retiré");
  for (const k of ["started", "tags"]) if (field(d, k) === "") removeField(d, k);

  // 7. « ## Notes » toujours présente, en dernier.
  if (!findSection(d, NOTES_SECTION)) {
    while (d.lines.length && !d.lines[d.lines.length - 1].trim()) d.lines.pop();
    d.lines.push("", `## ${NOTES_SECTION}`, "");
  }

  const out = tidy(serializeDoc(d));
  return { text: out, changed: out !== text, tasks, report };
}

/** Pas plus d'une ligne vide d'affilée ; une ligne vide avant chaque titre. */
function tidy(text: string): string {
  return text.replace(/\n{3,}/g, "\n\n").replace(/([^\n])\n(#{1,3} )/g, "$1\n\n$2").replace(/\n*$/, "\n");
}
