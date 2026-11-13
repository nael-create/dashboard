/**
 * Lecture du contenu Markdown (source de vérité) à la racine du dépôt.
 * Lecture seule : ce module n'écrit jamais aucun fichier.
 * Les fichiers sont relus à chaque requête : aucune copie, aucun cache disque.
 */
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

// Annotations turbopackIgnore : ces fichiers sont lus à l'exécution, ils ne doivent jamais être
// embarqués dans une compilation (ni le contenu personnel, ni data/calendars.local.json).
export const CONTENT_DIR = path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.CONTENT_DIR ?? "..");

export const STATUSES = ["idea", "active", "paused", "done", "dropped"] as const;
export const PRIORITIES = ["P1", "P2", "P3"] as const;
export type Status = (typeof STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  idea: "Idée",
  active: "Actif",
  paused: "En pause",
  done: "Terminé",
  dropped: "Abandonné",
};

export type Kind = "project" | "area";

export interface Entry {
  kind: Kind;
  slug: string;
  title: string;
  status: Status | null;
  priority: Priority | null;
  created: string | null;
  updated: string | null;
  nextAction: string | null;
  deadline: string | null;
  /** Problème de lecture du frontmatter, affiché tel quel dans l'interface. */
  error: string | null;
}

export interface EntryWithBody extends Entry {
  body: string;
}

/** Noms de dossiers valides : kebab-case minuscule (empêche aussi toute traversée de chemin). */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const isValidSlug = (s: string) => SLUG_RE.test(s);

const ROOTS: Record<Kind, string> = { project: "projects", area: "areas" };

function asString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  const s = String(v).trim();
  return s === "" ? null : s;
}

function asEnum<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  const s = asString(v);
  return s && (allowed as readonly string[]).includes(s) ? (s as T) : null;
}

async function readEntry(kind: Kind, slug: string): Promise<EntryWithBody | null> {
  if (!isValidSlug(slug)) return null;
  const file = path.join(/*turbopackIgnore: true*/ CONTENT_DIR, ROOTS[kind], slug, "README.md");
  let raw: string;
  try {
    raw = await fs.readFile(/*turbopackIgnore: true*/ file, "utf8");
  } catch {
    return null;
  }

  const base: EntryWithBody = {
    kind, slug, title: slug, status: null, priority: null, created: null,
    updated: null, nextAction: null, deadline: null, error: null, body: raw,
  };

  try {
    // Passer des options désactive le cache interne de gray-matter (qui masquerait les erreurs).
    const { data, content } = matter(raw, {});
    const problems: string[] = [];
    const status = asEnum(data.status, STATUSES);
    const priority = asEnum(data.priority, PRIORITIES);
    if (data.status !== undefined && !status) problems.push(`statut inconnu « ${String(data.status)} »`);
    if (data.priority !== undefined && !priority) problems.push(`priorité inconnue « ${String(data.priority)} »`);
    return {
      ...base,
      title: asString(data.title) ?? slug,
      status,
      priority,
      created: asString(data.created),
      updated: asString(data.updated),
      nextAction: asString(data.next_action),
      deadline: asString(data.deadline),
      error: problems.length ? problems.join(", ") : null,
      body: content,
    };
  } catch (e) {
    // Frontmatter YAML invalide (ex. une valeur contenant « : » non entourée de guillemets).
    const msg = e instanceof Error ? e.message.split("\n")[0] : String(e);
    return {
      ...base,
      error: `frontmatter illisible (${msg}). Astuce : entourer de guillemets les valeurs qui contiennent « : », ex. title: "TODO: fill in".`,
    };
  }
}

async function listEntries(kind: Kind): Promise<Entry[]> {
  let dirs: string[];
  try {
    const items = await fs.readdir(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ CONTENT_DIR, ROOTS[kind]), { withFileTypes: true });
    // Les dossiers commençant par « _ » (templates) sont exclus.
    dirs = items.filter((d) => d.isDirectory() && isValidSlug(d.name)).map((d) => d.name);
  } catch {
    return [];
  }
  const entries = await Promise.all(dirs.map((d) => readEntry(kind, d)));
  return entries
    .filter((e): e is EntryWithBody => e !== null)
    .map(({ body: _body, ...rest }) => rest);
}

const PRIORITY_RANK: Record<string, number> = { P1: 1, P2: 2, P3: 3 };

/** Tri : priorité (P1 → P3), puis deadline la plus proche (vides en dernier), puis titre. */
export function sortEntries<T extends Entry>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const p = (PRIORITY_RANK[a.priority ?? ""] ?? 9) - (PRIORITY_RANK[b.priority ?? ""] ?? 9);
    if (p) return p;
    if (a.deadline !== b.deadline) {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return a.deadline.localeCompare(b.deadline);
    }
    return a.title.localeCompare(b.title, "fr");
  });
}

export const listProjects = async () => sortEntries(await listEntries("project"));
export const listAreas = async () => sortEntries(await listEntries("area"));
export const getProject = (slug: string) => readEntry("project", slug);
export const getArea = (slug: string) => readEntry("area", slug);

/* ------------------------------------------------------------------ */
/* Revues hebdomadaires                                                 */
/* ------------------------------------------------------------------ */

const REVIEW_RE = /^(\d{4})-W(\d{2})\.md$/;

/** Extrait les éléments de liste d'une section « ## Titre » d'un fichier Markdown. */
export function sectionItems(markdown: string, heading: string): string[] {
  const lines = markdown.replace(/<!--[\s\S]*?-->/g, "").split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (start === -1) return [];
  const items: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,2}\s/.test(line)) break;
    const m = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.+)$/);
    if (m) items.push(m[1].trim());
  }
  return items;
}

export interface WeeklyFocus {
  /** Nom du fichier de revue utilisé (ex. « 2026-W46 »), ou null si aucune revue. */
  review: string | null;
  items: string[];
}

export async function getWeeklyFocus(): Promise<WeeklyFocus> {
  let files: string[] = [];
  try {
    files = (await fs.readdir(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ CONTENT_DIR, "reviews"))).filter((f) => REVIEW_RE.test(f));
  } catch {
    /* pas de dossier reviews/ */
  }
  if (!files.length) return { review: null, items: [] };
  const latest = files.sort().at(-1)!;
  const md = await fs.readFile(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ CONTENT_DIR, "reviews", latest), "utf8");
  return {
    review: latest.replace(/\.md$/, ""),
    items: sectionItems(md, "Focus semaine prochaine").slice(0, 3),
  };
}

/* ------------------------------------------------------------------ */
/* Inbox                                                                */
/* ------------------------------------------------------------------ */

/** Nombre d'éléments non cochés sous « ## Éléments » (l'exemple n'est pas compté). */
export async function countInbox(): Promise<number> {
  try {
    const md = await fs.readFile(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ CONTENT_DIR, "INBOX.md"), "utf8");
    const lines = md.split(/\r?\n/);
    const start = lines.findIndex((l) => l.trim() === "## Éléments");
    if (start === -1) return 0;
    let n = 0;
    for (const line of lines.slice(start + 1)) {
      if (/^#{1,2}\s/.test(line)) break;
      if (/^\s*[-*]\s+\[ \]\s+\S/.test(line)) n++;
    }
    return n;
  } catch {
    return 0;
  }
}
