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
import { addDone, dayNotes, NOTES_SECTION, removeDone, setDayText } from "./daily-notes";
import { findSection, fmValue, parseDoc, sectionText, serializeDoc, setField, type Doc } from "./markdown-doc";
import { detectSensitive } from "./secrets";
import { slugify } from "./slug";

export const ROOT: Record<Kind, string> = { project: "projects", area: "areas" };
/** Champs modifiables (projets simplifiés : plus d'étape ni de `next_action`, déduite des tâches). */
const FIELDS: Record<Kind, string[]> = {
  project: ["title", "status", "priority", "deadline"],
  area: ["title", "status", "priority"],
};
/** Sections de l'ancien format (affichées en lecture seule si la migration n'est pas passée). */
const LEGACY_SECTIONS = ["Objectif", "Pourquoi", "Critères de réussite", "Ressources", "Risques", "Prochaines actions", "Liens", "Jalons", "Journal", "Rôle", "Standards à maintenir"];

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
  /** Notes du jour (## Notes / ### YYYY-MM-DD), dans l'ordre du fichier (plus récente en haut). */
  notes: { date: string; text: string; done: string[] }[];
  /** Autres sections « ## » (écrites à la main ou ancien format) : lecture seule. */
  extra: [string, string][];
  /** L'ancien format est encore là (migration à lancer). */
  legacy: boolean;
}

export async function readEditable(kind: Kind, slug: string): Promise<EditableEntry | null> {
  assertSlug(slug);
  const cur = await readVersioned(readmePath(kind, slug));
  if (!cur.exists) return null;
  const d = parseDoc(cur.text);
  const fields: Record<string, string> = {};
  if (d.fm) {
    for (let i = d.fm.start + 1; i < d.fm.end; i++) {
      const m = d.lines[i].match(/^([a-z_]+)[ \t]*:(.*)$/i);
      if (m) fields[m[1]] = fmValue(m[2]);
    }
  }
  const extra: [string, string][] = [];
  const from = d.fm ? d.fm.end + 1 : 0;
  for (let i = from; i < d.lines.length; i++) {
    const m = d.lines[i].match(/^##\s+(.+?)\s*$/);
    if (!m || m[1] === NOTES_SECTION) continue;
    const text = sectionText(d, m[1]) ?? "";
    if (text.trim()) extra.push([m[1], text]);
  }
  return {
    kind, slug, version: cur.version, fields,
    notes: dayNotes(d).map(({ date, text, done }) => ({ date, text, done })),
    extra,
    legacy: LEGACY_SECTIONS.some((n) => findSection(d, n)) || /^(stage|next_action)\s*:/m.test(d.fm ? d.lines.slice(d.fm.start, d.fm.end).join("\n") : ""),
  };
}

export type EditOp =
  | { op: "fields"; fields: Record<string, string> }
  | { op: "note"; date: string; text: string };

export const RESERVED_SLUGS = new Set(["aujourdhui", "pipeline", "liste", "domaines"]);

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
      apply(kind, d, op);
    } catch (e) {
      if (e instanceof UserError) throw e;
      throw new UserError(e instanceof Error ? e.message : String(e), 400);
    }
    setField(d, "updated", today);
    return { text: serializeDoc(d) };
  });

  let archivedTo: string | null = null;
  if (willArchive) archivedTo = await archiveProject(slug);
  await regenerateDashboard();
  return { version: res.version, archivedTo };
}

function apply(kind: Kind, d: Doc, op: EditOp) {
  switch (op.op) {
    case "fields":
      for (const [k, v] of Object.entries(op.fields)) {
        if (!FIELDS[kind].includes(k)) throw new UserError(`Champ non modifiable : ${k}.`);
        if (/[\r\n]/.test(v)) throw new UserError("Une valeur doit tenir sur une ligne.");
        checkText(v);
        setField(d, k, normalizeField(k, v));
      }
      return;
    case "note":
      if (op.text.length > 20_000) throw new UserError("Note trop longue.");
      checkText(op.text);
      setDayText(d, isoDate(op.date), op.text);
  }
}

/** Ajoute (ou retire) « ✓ titre » dans la note du jour d'un projet / domaine (tâche liée cochée). Sans échec. */
export async function recordDone(slug: string, date: string, title: string, done: boolean) {
  if (!isValidSlug(slug)) return;
  for (const kind of ["project", "area"] as Kind[]) {
    const cur = await readVersioned(readmePath(kind, slug));
    if (!cur.exists) continue;
    await updateFile(readmePath(kind, slug), undefined, (text, exists) => {
      if (!exists) return { text: null };
      const d = parseDoc(text);
      if (done) addDone(d, date, title);
      else removeDone(d, date, title);
      setField(d, "updated", todayISO());
      return { text: serializeDoc(d) };
    });
    await regenerateDashboard();
    return;
  }
}

/** Projet ou domaine existant pour ce nom (pour lier une tâche). */
export async function entryKindOf(slug: string): Promise<Kind | null> {
  if (!isValidSlug(slug)) return null;
  for (const kind of ["project", "area"] as Kind[]) if ((await readVersioned(readmePath(kind, slug))).exists) return kind;
  return null;
}

/** Valeurs contrôlées : dates ISO (ou vide). */
function normalizeField(k: string, v: string): string {
  const t = v.trim();
  if (k === "title") return t || "TODO: fill in";
  if (k === "deadline") return t ? isoDate(t) : "";
  if (k === "status" && !["idea", "active", "paused", "done", "dropped"].includes(t)) throw new UserError("Statut inconnu.");
  if (k === "priority" && !["P1", "P2", "P3"].includes(t)) throw new UserError("Priorité inconnue.");
  return t;
}

function isoDate(v: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) throw new UserError("Date invalide.");
  return v;
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

/** Ce que contient le dossier d'un projet (affiché dans la confirmation de suppression). */
export async function projectContents(slug: string): Promise<{ docs: number; images: number; files: number }> {
  assertSlug(slug);
  const dir = path.join(/*turbopackIgnore: true*/ CONTENT_DIR, "projects", slug);
  const count = async (sub: string, filter: (n: string) => boolean) =>
    fs.readdir(/*turbopackIgnore: true*/ path.join(dir, sub)).then((l) => l.filter(filter).length, () => 0);
  const all = await fs.readdir(/*turbopackIgnore: true*/ dir, { recursive: true, withFileTypes: true }).then((l) => l.filter((e) => e.isFile()).length, () => 0);
  return { docs: await count("docs", (n) => n.endsWith(".md")), images: await count("assets", (n) => !n.startsWith(".")), files: all };
}

/**
 * Supprime DÉFINITIVEMENT le dossier projects/<slug>/ (README, docs, images), après confirmation dans
 * l'interface. Refusé si le README a changé depuis la lecture (409). Les tâches liées restent dans
 * TACHES.md ; une copie reste dans l'historique git si le projet avait été sauvegardé.
 */
export async function deleteProject(slug: string, version: string): Promise<{ title: string }> {
  assertSlug(slug);
  if (RESERVED_SLUGS.has(slug)) throw new UserError("Nom réservé.", 404);
  const cur = await readVersioned(readmePath("project", slug));
  if (!cur.exists) throw new UserError("Ce projet n'existe plus (déjà supprimé ou archivé ?). Recharge la page.", 404);
  if (cur.version !== version) throw new UserError("Ce projet a été modifié ailleurs entre-temps. Recharge la page avant de le supprimer.", 409);
  const title = cur.text.match(/^title:\s*"?(.*?)"?\s*(?:#.*)?$/m)?.[1] || slug;
  const dir = path.join(/*turbopackIgnore: true*/ CONTENT_DIR, "projects", slug);
  // Garde-fou : uniquement un sous-dossier direct de projects/ (jamais _template ni autre chose).
  if (path.dirname(dir) !== path.join(CONTENT_DIR, "projects") || slug.startsWith("_")) throw new UserError("Suppression refusée.", 400);
  await fs.rm(/*turbopackIgnore: true*/ dir, { recursive: true, force: false });
  await regenerateDashboard();
  return { title };
}

/** Crée projects/<slug>/ (ou areas/<slug>/) à partir du template ; seul le titre est demandé. */
export async function createEntry(kind: Kind, title: string, deadline: string | null = null): Promise<string> {
  const clean = oneLine(title);
  checkText(clean);
  const base = slugify(clean);
  if (!base) throw new UserError("Ce titre ne permet pas de créer un nom de dossier (utilise des lettres ou des chiffres).");
  const rootDir = path.join(/*turbopackIgnore: true*/ CONTENT_DIR, ROOT[kind]);
  // Noms réservés aux onglets de /projets (aujourdhui, pipeline, liste, domaines).
  const exists = (n: string) => (kind === "project" && RESERVED_SLUGS.has(n) ? Promise.resolve(true) : fs.access(/*turbopackIgnore: true*/ path.join(rootDir, n)).then(() => true, () => false));
  let slug = base;
  for (let n = 2; await exists(slug); n++) slug = `${base}-${n}`;

  const tplDir = path.join(/*turbopackIgnore: true*/ rootDir, "_template");
  await fs.cp(/*turbopackIgnore: true*/ tplDir, path.join(/*turbopackIgnore: true*/ rootDir, slug), {
    recursive: true, errorOnExist: true,
    // Les modèles de pages de docs restent dans _template (ils servent à « Nouvelle page »).
    filter: (src) => !src.split(path.sep).includes("docs-templates"),
  });

  const today = todayISO();
  await updateFile(readmePath(kind, slug), undefined, (text) => {
    const d = parseDoc(text);
    setField(d, "title", clean);
    setField(d, "status", kind === "project" ? "idea" : "active");
    setField(d, "priority", "P3");
    setField(d, "created", today);
    setField(d, "updated", today);
    if (kind === "project" && deadline) setField(d, "deadline", isoDate(deadline));
    const h1 = d.lines.findIndex((l) => /^#\s/.test(l));
    if (h1 >= 0) d.lines[h1] = `# ${clean}`;
    return { text: serializeDoc(d) };
  });
  await regenerateDashboard();
  return slug;
}
