/**
 * FAVORIS.md — un bloc par favori :
 *
 *   ## 2026-11-13 — Titre
 *   id: fav-20261113-1
 *   type: article            ← article | newsletter | notion | memo | project
 *   ref: https://…           ← lien (article, newsletter) ou référence interne (notion:…, memo:…, project:…)
 *   source: FT World
 *   published: 2026-11-12    ← date de l'article / de la newsletter (facultatif)
 *   note: Ma note courte     ← facultatif
 *
 * Jamais de contenu d'article ni de corps d'e-mail : seulement titre, lien, source et dates.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { UserError } from "./api";
import { CONTENT_DIR, isValidSlug } from "./content";
import { joinLines, readVersioned, splitLines, updateFile } from "./content-file";
import { readMemo } from "./memo";
import { readNotions } from "./notions";
import { detectSensitive } from "./secrets";

export const FAVORITES_FILE = "FAVORIS.md";
export const FAVORITE_TYPES = ["article", "newsletter", "notion", "memo", "project"] as const;
export type FavoriteType = (typeof FAVORITE_TYPES)[number];

export interface Favorite {
  id: string;
  added: string;
  title: string;
  type: FavoriteType;
  ref: string;
  source: string;
  published: string | null;
  note: string;
  start: number;
  end: number;
}

const HEADING = /^##\s+(\d{4}-\d{2}-\d{2})\s+[—–-]\s+(.+?)\s*$/;
const HEADER = [
  "# Favoris",
  "",
  "> Articles, newsletters, notions, mémos et projets mis de côté. Titre, lien et source uniquement : jamais le contenu d'un article ou d'un e-mail.",
  "",
];

export function parseFavorites(text: string): Favorite[] {
  const lines = splitLines(text);
  const starts = lines.map((l, i) => (/^##\s/.test(l) ? i : -1)).filter((i) => i >= 0);
  const out: Favorite[] = [];
  starts.forEach((start, k) => {
    const m = lines[start].match(HEADING);
    if (!m) return;
    const end = k + 1 < starts.length ? starts[k + 1] : lines.length;
    const meta: Record<string, string> = {};
    for (let i = start + 1; i < end; i++) {
      const mm = lines[i].match(/^([a-z]+)\s*:\s*(.*?)\s*$/i);
      if (mm) meta[mm[1].toLowerCase()] = mm[2];
    }
    const type = FAVORITE_TYPES.includes(meta.type as FavoriteType) ? (meta.type as FavoriteType) : null;
    if (!type || !meta.ref) return;
    out.push({
      id: meta.id || `fav-${m[1].replace(/-/g, "")}-${start}`,
      added: m[1], title: m[2], type, ref: meta.ref, source: meta.source ?? "",
      published: /^\d{4}-\d{2}-\d{2}$/.test(meta.published ?? "") ? meta.published : null,
      note: meta.note ?? "", start, end,
    });
  });
  return out;
}

export const favoriteKey = (type: string, ref: string) => `${type}|${ref}`;

export async function readFavorites() {
  const { text, version } = await readVersioned(FAVORITES_FILE);
  return { favorites: parseFavorites(text), version };
}

const oneLine = (s: string, max: number) => s.replace(/[\r\n]+/g, " ").replace(/^#+\s*/, "").trim().slice(0, max);

function block(f: Omit<Favorite, "start" | "end">): string[] {
  return [
    `## ${f.added} — ${f.title}`,
    `id: ${f.id}`,
    `type: ${f.type}`,
    `ref: ${f.ref}`,
    ...(f.source ? [`source: ${f.source}`] : []),
    ...(f.published ? [`published: ${f.published}`] : []),
    ...(f.note ? [`note: ${f.note}`] : []),
    "",
  ];
}

export interface ToggleInput { type: FavoriteType; ref: string; title: string; source?: string; published?: string | null }

function validRef(type: FavoriteType, ref: string): boolean {
  if (type === "article" || type === "newsletter") {
    try {
      const u = new URL(ref);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  }
  return new RegExp(`^${type}:[A-Za-z0-9_-]+$`).test(ref);
}

/**
 * Ajoute le favori s'il n'existe pas, le retire sinon.
 * S'applique au contenu du moment (ajout / retrait d'un bloc) : rien d'autre n'est réécrit.
 */
export async function toggleFavorite(input: ToggleInput, today: string): Promise<{ starred: boolean }> {
  if (!validRef(input.type, input.ref)) throw new UserError("Référence de favori invalide.");
  const title = oneLine(input.title, 200) || "(sans titre)";
  const source = oneLine(input.source ?? "", 80);
  const reason = detectSensitive(`${title}\n${source}`);
  if (reason) throw new UserError(`Non enregistré : ${reason}.`);
  const res = await updateFile<boolean>(FAVORITES_FILE, undefined, (text, exists) => {
    const lines = exists ? splitLines(text) : [...HEADER];
    const favs = parseFavorites(lines.join("\n"));
    const found = favs.find((f) => favoriteKey(f.type, f.ref) === favoriteKey(input.type, input.ref));
    if (found) {
      lines.splice(found.start, found.end - found.start);
      return { text: joinLines(lines), result: false };
    }
    const prefix = `fav-${today.replace(/-/g, "")}-`;
    const n = Math.max(0, ...favs.filter((f) => f.id.startsWith(prefix)).map((f) => Number(f.id.slice(prefix.length)) || 0)) + 1;
    const b = block({ id: `${prefix}${n}`, added: today, title, type: input.type, ref: input.ref, source, published: input.published ?? null, note: "" });
    // Plus récent en haut.
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    const at = favs.length ? favs[0].start : lines.length;
    if (!favs.length) lines.push("");
    lines.splice(favs.length ? at : lines.length, 0, ...b);
    return { text: joinLines(lines), result: true };
  });
  return { starred: !!res.result };
}

export async function setFavoriteNote(version: string, id: string, note: string) {
  const clean = oneLine(note, 280);
  const reason = detectSensitive(clean);
  if (reason) throw new UserError(`Non enregistré : ${reason}.`);
  return updateFile(FAVORITES_FILE, version, (text) => {
    const lines = splitLines(text);
    const f = parseFavorites(text).find((x) => x.id === id);
    if (!f) throw new UserError("Favori introuvable.", 404);
    const i = lines.slice(f.start, f.end).findIndex((l) => /^note\s*:/i.test(l));
    if (i >= 0) {
      if (clean) lines[f.start + i] = `note: ${clean}`;
      else lines.splice(f.start + i, 1);
    } else if (clean) {
      let at = f.start + 1;
      while (at < f.end && /^[a-z]+\s*:/i.test(lines[at])) at++;
      lines.splice(at, 0, `note: ${clean}`);
    }
    return { text: joinLines(lines) };
  });
}

export async function removeFavorite(version: string, id: string) {
  return updateFile(FAVORITES_FILE, version, (text) => {
    const lines = splitLines(text);
    const f = parseFavorites(text).find((x) => x.id === id);
    if (!f) throw new UserError("Favori introuvable.", 404);
    lines.splice(f.start, f.end - f.start);
    return { text: joinLines(lines) };
  });
}

/* ------------------------------------------------------------------ */
/* Résolution des références internes                                   */
/* ------------------------------------------------------------------ */

export interface ResolvedFavorite extends Omit<Favorite, "start" | "end"> {
  /** Lien à ouvrir (externe ou page de l'app) ; null si l'élément n'existe plus. */
  href: string | null;
  external: boolean;
  missing: boolean;
  archived: boolean;
}

const dirExists = (rel: string) =>
  fs.stat(/*turbopackIgnore: true*/ path.join(CONTENT_DIR, rel)).then((s) => s.isDirectory(), () => false);

export async function resolveFavorites(): Promise<{ favorites: ResolvedFavorite[]; version: string }> {
  const [{ favorites, version }, { notions }, { entries }] = await Promise.all([readFavorites(), readNotions(), readMemo()]);
  const notionIds = new Set(notions.filter((n) => n.definition.trim()).map((n) => n.id));
  const allNotionIds = new Set(notions.map((n) => n.id));
  const memoIds = new Set(entries.map((e) => e.id ?? e.key));
  const out: ResolvedFavorite[] = [];
  for (const { start: _s, end: _e, ...f } of favorites) {
    const [, target] = f.ref.split(/:(.*)/s);
    let href: string | null = null;
    let external = false;
    let archived = false;
    if (f.type === "article" || f.type === "newsletter") {
      href = f.ref;
      external = true;
    } else if (f.type === "notion" && allNotionIds.has(target)) {
      href = notionIds.has(target) ? `/notions#notion-${target}` : `/notions?onglet=gerer`;
    } else if (f.type === "memo" && memoIds.has(target)) {
      href = `/memo#memo-${target}`;
    } else if (f.type === "project" && isValidSlug(target)) {
      if (await dirExists(`projects/${target}`)) href = `/projets/${target}`;
      else if (await dirExists(`archive/${target}`)) archived = true;
    }
    out.push({ ...f, href, external, missing: !href && !archived, archived });
  }
  return { favorites: out, version };
}
