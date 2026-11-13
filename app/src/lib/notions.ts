/**
 * NOTIONS.md — glossaire à mémoriser, un bloc par notion :
 *
 *   ## Terme
 *   tags: eco, finance
 *   added: 2026-11-13
 *
 *   Définition (une ou plusieurs lignes).
 *
 *   > Exemple ou contexte (facultatif).
 *
 * La progression de révision (boîte de Leitner, prochaine date, historique) n'est JAMAIS écrite
 * dans NOTIONS.md : elle vit dans app/data/notions-progress.local.json (ignoré par git), indexée
 * par un identifiant dérivé du terme. Si ce fichier disparaît, les notions repartent de zéro.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { UserError } from "./api";
import { joinLines, readVersioned, splitLines, updateFile } from "./content-file";
import { detectSensitive } from "./secrets";
import { slugify } from "./slug";
import { splitTags } from "./memo";
import { addDays } from "./tz";

export const NOTIONS_FILE = "NOTIONS.md";
// DASHBOARD_DATA_DIR permet aux tests d'utiliser un dossier temporaire.
const progressFile = () =>
  path.join(/*turbopackIgnore: true*/ process.env.DASHBOARD_DATA_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "data"), "notions-progress.local.json");

import { INTERVALS, LEARNED_BOX } from "./leitner";
export { INTERVALS, LEARNED_BOX };

export interface Notion {
  id: string;
  term: string;
  tags: string[];
  added: string | null;
  definition: string;
  example: string;
  start: number;
  end: number;
}

export interface Progress {
  box: number;
  due: string;
  history: { date: string; result: "knew" | "again" }[];
}

const HEADER = [
  "# Notions",
  "",
  "> Glossaire à retenir. Un bloc par notion : « ## Terme », puis tags/added, la définition, et un exemple facultatif précédé de « > ».",
  "",
];

/* ------------------------------------------------------------------ */
/* Lecture                                                              */
/* ------------------------------------------------------------------ */

export function parseNotions(text: string): Notion[] {
  const lines = splitLines(text);
  const starts = lines.map((l, i) => (/^##\s+\S/.test(l) ? i : -1)).filter((i) => i >= 0);
  const seen = new Set<string>();
  return starts.map((start, k) => {
    const end = k + 1 < starts.length ? starts[k + 1] : lines.length;
    const term = lines[start].replace(/^##\s+/, "").trim();
    let tags: string[] = [];
    let added: string | null = null;
    let i = start + 1;
    for (; i < end; i++) {
      const m = lines[i].match(/^(tags|added)\s*:\s*(.*)$/i);
      if (!m) break;
      if (m[1].toLowerCase() === "tags") tags = splitTags(m[2]);
      else if (/^\d{4}-\d{2}-\d{2}$/.test(m[2].trim())) added = m[2].trim();
    }
    const def: string[] = [];
    const ex: string[] = [];
    for (const l of lines.slice(i, end)) {
      if (/^\s*>/.test(l)) ex.push(l.replace(/^\s*>\s?/, ""));
      else def.push(l);
    }
    const trim = (arr: string[]) => {
      while (arr.length && !arr[0].trim()) arr.shift();
      while (arr.length && !arr[arr.length - 1].trim()) arr.pop();
      return arr.join("\n");
    };
    // Identifiant stable dérivé du terme ; deux termes identiques ne créent jamais de doublon d'identifiant.
    const base = slugify(term) || "notion";
    let id = base;
    for (let n = 2; seen.has(id); n++) id = `${base}-${n}`;
    seen.add(id);
    return { id, term, tags, added, definition: trim(def), example: trim(ex), start, end };
  });
}

export async function readNotions() {
  const { text, version } = await readVersioned(NOTIONS_FILE);
  return { notions: parseNotions(text), version };
}

async function readProgress(): Promise<Record<string, Progress>> {
  try {
    const raw = JSON.parse(await fs.readFile(/*turbopackIgnore: true*/ progressFile(), "utf8"));
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {}; // fichier absent ou illisible : tout repart de zéro, sans erreur
  }
}

let progressQueue: Promise<unknown> = Promise.resolve();
function updateProgress<T>(fn: (p: Record<string, Progress>) => T): Promise<T> {
  const run = progressQueue.then(async () => {
    const p = await readProgress();
    const result = fn(p);
    const file = progressFile();
    await fs.mkdir(/*turbopackIgnore: true*/ path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(/*turbopackIgnore: true*/ tmp, JSON.stringify(p, null, 2) + "\n", { mode: 0o600 });
    await fs.rename(/*turbopackIgnore: true*/ tmp, file);
    return result;
  });
  progressQueue = run.catch(() => {});
  return run;
}

/* ------------------------------------------------------------------ */
/* Révision (Leitner)                                                   */
/* ------------------------------------------------------------------ */

export interface NotionView extends Omit<Notion, "start" | "end"> {
  complete: boolean;
  /** Boîte 1 à 6 (1 pour une notion jamais révisée). */
  box: number;
  due: string | null;
  reviewed: boolean;
}

/** Échéance d'une notion : progression enregistrée, sinon le lendemain de son ajout (aujourd'hui si date inconnue). */
export function dueDate(n: Notion, p: Progress | undefined, today: string): string {
  if (p) return p.due;
  return n.added ? addDays(n.added, 1) : today;
}

export function view(n: Notion, p: Progress | undefined, today: string): NotionView {
  const { start: _s, end: _e, ...rest } = n;
  const complete = n.definition.trim() !== "";
  return { ...rest, complete, box: p?.box ?? 1, due: complete ? dueDate(n, p, today) : null, reviewed: !!p };
}

export async function notionsWithProgress(today: string) {
  const [{ notions, version }, progress] = await Promise.all([readNotions(), readProgress()]);
  const views = notions.map((n) => view(n, progress[n.id], today));
  return { notions: views, version, learned: views.filter((v) => v.box >= LEARNED_BOX).length };
}

/** Notions à revoir aujourd'hui (avec définition, échéance passée), les plus en retard d'abord. */
export async function dueNotions(today: string, limit: number, offset = 0) {
  const { notions, learned } = await notionsWithProgress(today);
  const due = notions
    .filter((n) => n.complete && n.due !== null && n.due <= today)
    .sort((a, b) => a.due!.localeCompare(b.due!) || a.box - b.box || a.term.localeCompare(b.term, "fr"));
  return { items: due.slice(offset, offset + limit), totalDue: due.length, learned, total: notions.filter((n) => n.complete).length };
}

/** « Je savais » : boîte suivante ; « À revoir » : boîte 1, à revoir demain. */
export function nextProgress(prev: Progress | undefined, knew: boolean, today: string): Progress {
  const box = knew ? Math.min((prev?.box ?? 1) + 1, INTERVALS.length) : 1;
  return {
    box,
    due: addDays(today, knew ? INTERVALS[box - 1] : 1),
    history: [...(prev?.history ?? []), { date: today, result: knew ? "knew" as const : "again" as const }].slice(-50),
  };
}

export async function recordReview(id: string, knew: boolean, today: string) {
  const { notions } = await readNotions();
  if (!notions.some((n) => n.id === id && n.definition.trim())) throw new UserError("Notion introuvable ou sans définition.", 404);
  return updateProgress((p) => (p[id] = nextProgress(p[id], knew, today)));
}

export async function resetProgress(id: string) {
  await updateProgress((p) => {
    delete p[id];
  });
}

/* ------------------------------------------------------------------ */
/* Écriture de NOTIONS.md (bloc par bloc)                               */
/* ------------------------------------------------------------------ */

export interface NotionInput {
  term: string;
  definition?: string;
  example?: string;
  tags?: string[];
}

function check(input: Partial<NotionInput>) {
  if (input.term !== undefined && (/[\r\n]/.test(input.term) || !input.term.trim())) throw new UserError("Le terme doit tenir sur une ligne.");
  for (const v of [input.definition, input.example]) {
    if (v && /^##\s/m.test(v)) throw new UserError("Une ligne ne peut pas commencer par « ## » (réservé aux termes).");
  }
  const reason = detectSensitive([input.term, input.definition, input.example, ...(input.tags ?? [])].join("\n"));
  if (reason) throw new UserError(`Non enregistré : ${reason}. NOTIONS.md est publié sur GitHub.`);
}

function serialize(n: { term: string; tags: string[]; added: string | null; definition: string; example: string }): string[] {
  const out = [`## ${n.term.trim()}`];
  if (n.tags.length) out.push(`tags: ${n.tags.join(", ")}`);
  if (n.added) out.push(`added: ${n.added}`);
  const def = n.definition.replace(/\r\n/g, "\n").trim();
  const ex = n.example.replace(/\r\n/g, "\n").trim();
  if (def) out.push("", ...def.split("\n"));
  if (ex) out.push("", ...ex.split("\n").map((l) => (l ? `> ${l}` : ">")));
  out.push("");
  return out;
}

function appendBlocks(text: string, exists: boolean, blocks: string[][]): string {
  const lines = exists ? splitLines(text) : [...HEADER];
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  for (const b of blocks) {
    if (lines.length && lines[lines.length - 1] !== "") lines.push("");
    lines.push(...b);
  }
  return joinLines(lines);
}

const sameTerm = (a: string, b: string) => (slugify(a) || a.toLowerCase()) === (slugify(b) || b.toLowerCase());

/** Ajout (rapide ou complet). Ajout en fin de fichier : sûr même sans version (rien n'est écrasé). */
export async function addNotion(input: NotionInput, today: string, version?: string) {
  check(input);
  return updateFile(NOTIONS_FILE, version, (text, exists) => {
    if (parseNotions(text).some((n) => sameTerm(n.term, input.term))) throw new UserError(`« ${input.term.trim()} » existe déjà.`, 409);
    const block = serialize({ term: input.term, tags: input.tags ?? [], added: today, definition: input.definition ?? "", example: input.example ?? "" });
    return { text: appendBlocks(text, exists, [block]) };
  });
}

export async function importNotions(items: { term: string; definition: string }[], today: string, version: string) {
  for (const it of items) check(it);
  return updateFile<number>(NOTIONS_FILE, version, (text, exists) => {
    const existing = parseNotions(text).map((n) => n.term);
    const kept: string[][] = [];
    const terms: string[] = [...existing];
    for (const it of items) {
      if (!it.term.trim() || terms.some((t) => sameTerm(t, it.term))) continue; // doublons ignorés
      terms.push(it.term);
      kept.push(serialize({ term: it.term, tags: [], added: today, definition: it.definition, example: "" }));
    }
    return { text: kept.length ? appendBlocks(text, exists, kept) : null, result: kept.length };
  });
}

export async function updateNotion(version: string, id: string, patch: Partial<NotionInput>) {
  check(patch);
  const res = await updateFile<{ oldId: string; newTerm: string }>(NOTIONS_FILE, version, (text) => {
    const lines = splitLines(text);
    const all = parseNotions(text);
    const n = all.find((x) => x.id === id);
    if (!n) throw new UserError("Notion introuvable (elle a peut-être été renommée ou supprimée).", 404);
    const term = patch.term?.trim() ?? n.term;
    if (all.some((x) => x.id !== id && sameTerm(x.term, term))) throw new UserError(`« ${term} » existe déjà.`, 409);
    const block = serialize({
      term, tags: patch.tags ?? n.tags, added: n.added,
      definition: patch.definition ?? n.definition, example: patch.example ?? n.example,
    });
    lines.splice(n.start, n.end - n.start, ...block);
    return { text: joinLines(lines), result: { oldId: id, newTerm: term } };
  });
  // Terme renommé depuis l'app : la progression suit le nouvel identifiant.
  const after = (await readNotions()).notions.find((n) => n.term === res.result!.newTerm);
  if (after && after.id !== id) {
    await updateProgress((p) => {
      if (p[id] && !p[after.id]) p[after.id] = p[id];
      delete p[id];
    });
  }
  return res;
}

export async function deleteNotion(version: string, id: string) {
  await updateFile(NOTIONS_FILE, version, (text) => {
    const lines = splitLines(text);
    const n = parseNotions(text).find((x) => x.id === id);
    if (!n) throw new UserError("Notion introuvable (elle a peut-être déjà été supprimée).", 404);
    lines.splice(n.start, n.end - n.start);
    return { text: joinLines(lines) };
  });
  await resetProgress(id);
}

/** Analyse d'un import en masse « terme : définition » (une ligne par notion), pour l'aperçu. */
export function parseBulk(raw: string, existingTerms: string[]) {
  const out: { line: number; term: string; definition: string; status: "ok" | "duplicate" | "invalid" }[] = [];
  const seen = [...existingTerms];
  raw.split(/\r?\n/).forEach((l, i) => {
    if (!l.trim()) return; // lignes vides ignorées
    const m = l.match(/^\s*(.+?)\s*:\s*(.*)$/);
    const term = (m ? m[1] : l).trim().replace(/^[-*]\s+/, "");
    const definition = m ? m[2].trim() : "";
    const status = !term || /^##/.test(term) ? "invalid" : seen.some((t) => sameTerm(t, term)) ? "duplicate" : "ok";
    if (status === "ok") seen.push(term);
    out.push({ line: i + 1, term, definition, status });
  });
  return out;
}
