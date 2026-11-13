/**
 * Lecture / écriture sûre des fichiers Markdown de contenu.
 *
 * Règle « fichier inchangé depuis la lecture » : chaque lecture renvoie une `version`
 * (empreinte SHA-256 du texte). Une écriture DOIT fournir la version lue ; si le fichier
 * a changé entre-temps (modification à la main, autre onglet…), l'écriture est refusée
 * (ConflictError → HTTP 409) et rien n'est écrasé.
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { CONTENT_DIR } from "./content";

export class ConflictError extends Error {
  constructor(file: string) {
    super(`Le fichier ${file} a été modifié ailleurs entre-temps. Recharge la page puis recommence.`);
  }
}

export interface Versioned {
  text: string;
  /** Empreinte du contenu lu ; "absent" si le fichier n'existe pas. */
  version: string;
  exists: boolean;
}

export const hashText = (text: string) => crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);

/** Chemin absolu d'un fichier de contenu (relatif à la racine du dépôt). Refuse toute sortie du dépôt. */
export function contentPath(rel: string): string {
  const abs = path.resolve(/*turbopackIgnore: true*/ CONTENT_DIR, rel);
  if (abs !== CONTENT_DIR && !abs.startsWith(CONTENT_DIR + path.sep)) throw new Error("Chemin hors du dépôt refusé.");
  return abs;
}

export async function readVersioned(rel: string): Promise<Versioned> {
  try {
    const text = await fs.readFile(/*turbopackIgnore: true*/ contentPath(rel), "utf8");
    return { text, version: hashText(text), exists: true };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return { text: "", version: "absent", exists: false };
    throw e;
  }
}

// Une file d'attente par fichier : deux écritures simultanées ne peuvent pas s'entremêler.
const locks = new Map<string, Promise<unknown>>();

function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  locks.set(key, run.catch(() => {}));
  return run;
}

/**
 * Modifie un fichier si (et seulement si) sa version n'a pas changé depuis `expectedVersion`.
 * `transform` reçoit le texte actuel et renvoie le nouveau texte (ou null pour ne rien écrire).
 * Si `expectedVersion` est omis, la transformation s'applique au contenu du moment
 * (à réserver aux ajouts simples, ex. une ligne dans l'inbox).
 */
export function updateFile<T = void>(
  rel: string,
  expectedVersion: string | undefined,
  transform: (current: string, exists: boolean) => { text: string | null; result?: T },
): Promise<{ version: string; result?: T }> {
  const abs = contentPath(rel);
  return withLock(abs, async () => {
    const cur = await readVersioned(rel);
    if (expectedVersion !== undefined && expectedVersion !== cur.version) throw new ConflictError(rel);
    const { text, result } = transform(cur.text, cur.exists);
    if (text === null || (cur.exists && text === cur.text)) return { version: cur.version, result };
    await fs.mkdir(/*turbopackIgnore: true*/ path.dirname(abs), { recursive: true });
    const tmp = `${abs}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(/*turbopackIgnore: true*/ tmp, text, "utf8");
    await fs.rename(/*turbopackIgnore: true*/ tmp, abs);
    notifyContentChanged();
    return { version: hashText(text), result };
  });
}

/* Petits outils communs pour les fichiers Markdown « par blocs ». */

export const splitLines = (text: string) => text.replace(/\r\n/g, "\n").split("\n");
export const joinLines = (lines: string[]) => {
  const out = lines.join("\n");
  return out.endsWith("\n") ? out : out + "\n";
};

/* Signal interne « le contenu a changé » (utilisé par le bouton Sauvegarder). */
const listeners = new Set<() => void>();
export const onContentChanged = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
function notifyContentChanged() {
  for (const fn of listeners) fn();
}
