/**
 * Modification des projets et domaines depuis l'app.
 * Chaque modification : règle « fichier inchangé depuis la lecture », lignes concernées seulement,
 * champ `updated` mis à jour, puis DASHBOARD.md régénéré.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { UserError } from "./api";
import { CONTENT_DIR, isValidSlug, type Kind } from "./content";
import { readVersioned, updateFile } from "./content-file";
import { regenerateDashboard } from "./dashboard-md";
import { todayISO } from "./dates";
import {
  actions, addAction, addJournal, checkAction, editAction, journal, moveAction, parseDoc, sectionText,
  serializeDoc, setField, setSectionText, type Doc,
} from "./markdown-doc";
import { detectSensitive } from "./secrets";
import { slugify } from "./slug";

export const ROOT: Record<Kind, string> = { project: "projects", area: "areas" };
export const SECTIONS: Record<Kind, string[]> = {
  project: ["Objectif", "Notes", "Liens"],
  area: ["Rôle", "Standards à maintenir", "Notes"],
};
const FIELDS: Record<Kind, string[]> = {
  project: ["title", "status", "priority", "next_action", "deadline"],
  area: ["title", "status", "priority"],
};

const readmePath = (kind: Kind, slug: string) => `${ROOT[kind]}/${slug}/README.md`;

function assertSlug(slug: string) {
  if (!isValidSlug(slug)) throw new UserError("Nom de dossier invalide.", 404);
}

function checkText(...texts: (string | undefined)[]) {
  const reason = detectSensitive(texts.filter(Boolean).join("\n"));
  if (reason) throw new UserError(`Non enregistré : ${reason}. Ce fichier est publié sur GitHub.`);
}

export interface EditableEntry {
  kind: Kind;
  slug: string;
  version: string;
  fields: Record<string, string>;
  sections: Record<string, string>;
  actions: { text: string; done: boolean }[];
  journal: { date: string; text: string }[];
  /** Corps complet (affichage en lecture seule des sections non éditables). */
  body: string;
}

export async function readEditable(kind: Kind, slug: string): Promise<EditableEntry | null> {
  assertSlug(slug);
  const cur = await readVersioned(readmePath(kind, slug));
  if (!cur.exists) return null;
  const d = parseDoc(cur.text);
  const fields: Record<string, string> = {};
  if (d.fm) {
    for (let i = d.fm.start + 1; i < d.fm.end; i++) {
      const m = d.lines[i].match(/^([a-z_]+)\s*:\s*(.*?)\s*(?:\s#.*)?$/i);
      if (!m) continue;
      let v = m[2].trim();
      if (/^".*"$/.test(v)) v = v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      else if (/^'.*'$/.test(v)) v = v.slice(1, -1).replace(/''/g, "'");
      fields[m[1]] = v;
    }
  }
  const sections: Record<string, string> = {};
  for (const name of SECTIONS[kind]) sections[name] = sectionText(d, name) ?? "";
  const body = d.fm ? d.lines.slice(d.fm.end + 1).join("\n") : cur.text;
  return { kind, slug, version: cur.version, fields, sections, actions: actions(d).map(({ text, done }) => ({ text, done })), journal: journal(d), body };
}

export type EditOp =
  | { op: "fields"; fields: Record<string, string> }
  | { op: "section"; name: string; text: string }
  | { op: "action-add"; text: string }
  | { op: "action-check"; index: number; text: string }
  | { op: "action-edit"; index: number; text: string; newText: string }
  | { op: "action-move"; index: number; text: string; dir: -1 | 1 }
  | { op: "journal-add"; text: string; date?: string };

const ARCHIVE_STATUSES = new Set(["done", "dropped"]);

/** Applique une modification ; renvoie aussi le slug d'archive si le projet a été archivé. */
export async function editEntry(kind: Kind, slug: string, version: string, op: EditOp, confirmArchive = false) {
  assertSlug(slug);
  const today = todayISO();
  const willArchive = kind === "project" && op.op === "fields" && ARCHIVE_STATUSES.has(op.fields.status ?? "");
  if (willArchive && !confirmArchive) throw new UserError("Confirmation requise avant d'archiver ce projet.", 428);

  const res = await updateFile(readmePath(kind, slug), version, (text, exists) => {
    if (!exists) throw new UserError("Ce fichier n'existe plus (déplacé ou archivé ?). Recharge la page.", 404);
    const d: Doc = parseDoc(text);
    try {
      apply(kind, d, op, today);
    } catch (e) {
      if (e instanceof UserError) throw e;
      throw new UserError(e instanceof Error ? e.message : String(e), 409);
    }
    setField(d, "updated", today);
    return { text: serializeDoc(d) };
  });

  let archivedTo: string | null = null;
  if (willArchive) archivedTo = await archiveProject(slug);
  await regenerateDashboard();
  return { version: res.version, archivedTo };
}

function apply(kind: Kind, d: Doc, op: EditOp, today: string) {
  switch (op.op) {
    case "fields":
      for (const [k, v] of Object.entries(op.fields)) {
        if (!FIELDS[kind].includes(k)) throw new UserError(`Champ non modifiable : ${k}.`);
        if (/[\r\n]/.test(v)) throw new UserError("Une valeur doit tenir sur une ligne.");
        checkText(v);
        setField(d, k, k === "title" || k === "next_action" ? v.trim() || "TODO: fill in" : v.trim());
      }
      return;
    case "section":
      if (!SECTIONS[kind].includes(op.name)) throw new UserError("Section non modifiable.");
      if (/^#{1,2}\s/m.test(op.text)) throw new UserError("Le texte ne peut pas contenir de titres « # » ou « ## » (utilise « ### »).");
      checkText(op.text);
      setSectionText(d, op.name, op.text);
      return;
    case "action-add":
      checkText(op.text);
      addAction(d, oneLine(op.text));
      return;
    case "action-check":
      checkAction(d, op.index, op.text, today);
      return;
    case "action-edit":
      checkText(op.newText);
      editAction(d, op.index, op.text, oneLine(op.newText));
      return;
    case "action-move":
      moveAction(d, op.index, op.text, op.dir);
      return;
    case "journal-add":
      checkText(op.text);
      addJournal(d, op.date ?? today, oneLine(op.text));
  }
}

function oneLine(t: string) {
  const v = t.replace(/\s+/g, " ").trim();
  if (!v) throw new UserError("Le texte est vide.");
  return v;
}

/** Déplace projects/<slug> vers archive/<slug> (suffixe de date si ce nom existe déjà). */
async function archiveProject(slug: string): Promise<string> {
  const src = path.join(/*turbopackIgnore: true*/ CONTENT_DIR, "projects", slug);
  let target = slug;
  const taken = async (n: string) => fs.access(/*turbopackIgnore: true*/ path.join(CONTENT_DIR, "archive", n)).then(() => true, () => false);
  if (await taken(target)) target = `${slug}-${todayISO()}`;
  for (let n = 2; await taken(target); n++) target = `${slug}-${todayISO()}-${n}`;
  await fs.mkdir(/*turbopackIgnore: true*/ path.join(CONTENT_DIR, "archive"), { recursive: true });
  await fs.rename(/*turbopackIgnore: true*/ src, path.join(/*turbopackIgnore: true*/ CONTENT_DIR, "archive", target));
  return target;
}

/** Crée projects/<slug>/ (ou areas/<slug>/) à partir du template ; seul le titre est demandé. */
export async function createEntry(kind: Kind, title: string): Promise<string> {
  const clean = oneLine(title);
  checkText(clean);
  const base = slugify(clean);
  if (!base) throw new UserError("Ce titre ne permet pas de créer un nom de dossier (utilise des lettres ou des chiffres).");
  const rootDir = path.join(/*turbopackIgnore: true*/ CONTENT_DIR, ROOT[kind]);
  const exists = (n: string) => fs.access(/*turbopackIgnore: true*/ path.join(rootDir, n)).then(() => true, () => false);
  let slug = base;
  for (let n = 2; await exists(slug); n++) slug = `${base}-${n}`;

  const tplDir = path.join(/*turbopackIgnore: true*/ rootDir, "_template");
  await fs.cp(/*turbopackIgnore: true*/ tplDir, path.join(/*turbopackIgnore: true*/ rootDir, slug), { recursive: true, errorOnExist: true });

  const today = todayISO();
  await updateFile(readmePath(kind, slug), undefined, (text) => {
    const d = parseDoc(text);
    setField(d, "title", clean);
    setField(d, "status", kind === "project" ? "idea" : "active");
    setField(d, "priority", "P3");
    setField(d, "created", today);
    setField(d, "updated", today);
    const h1 = d.lines.findIndex((l) => /^#\s/.test(l));
    if (h1 >= 0) d.lines[h1] = `# ${clean}`;
    // Date réelle de création dans le journal du template.
    for (let i = 0; i < d.lines.length; i++) d.lines[i] = d.lines[i].replace(/^(\s*[-*]\s+)YYYY-MM-DD(\s+[—–-]\s+)/, `$1${today}$2`);
    return { text: serializeDoc(d) };
  });
  await regenerateDashboard();
  return slug;
}
