/**
 * MEMO.md — choses à retenir. Format (voir CLAUDE.md, section 10) :
 *
 *   ## 2026-11-13 — Titre court
 *   id: 20261113-1
 *   pinned: yes
 *   tags: maison, admin
 *
 *   Texte libre, sur une ou plusieurs lignes.
 *
 * Les modifications remplacent uniquement les lignes du bloc concerné.
 */
import { hashText, joinLines, readVersioned, splitLines, updateFile } from "./content-file";
import { detectSensitive } from "./secrets";
import { UserError } from "./api";

export const MEMO_FILE = "MEMO.md";

export interface MemoEntry {
  /** Identifiant stable : `id:` du bloc, ou empreinte du bloc s'il n'en a pas (écrit à la 1re modification). */
  key: string;
  id: string | null;
  date: string;
  title: string;
  pinned: boolean;
  tags: string[];
  text: string;
  /** Lignes [start, end) du bloc dans le fichier. */
  start: number;
  end: number;
}

const HEADING = /^##\s+(\d{4}-\d{2}-\d{2})\s+[—–-]\s+(.+?)\s*$/;
const META = /^(id|pinned|tags)\s*:\s*(.*)$/i;

export function parseMemo(text: string): MemoEntry[] {
  const lines = splitLines(text);
  const entries: MemoEntry[] = [];
  const starts: number[] = [];
  lines.forEach((l, i) => {
    if (/^##\s/.test(l)) starts.push(i);
  });
  starts.forEach((start, idx) => {
    const m = lines[start].match(HEADING);
    if (!m) return; // titre ## qui n'est pas une entrée : ignoré, conservé tel quel
    const end = idx + 1 < starts.length ? starts[idx + 1] : lines.length;
    let id: string | null = null;
    let pinned = false;
    let tags: string[] = [];
    let i = start + 1;
    for (; i < end; i++) {
      const mm = lines[i].match(META);
      if (!mm) break;
      const [, k, v] = mm;
      if (k.toLowerCase() === "id") id = v.trim() || null;
      else if (k.toLowerCase() === "pinned") pinned = /^(yes|oui|true)$/i.test(v.trim());
      else tags = splitTags(v);
    }
    const body = lines.slice(i, end);
    while (body.length && body[0].trim() === "") body.shift();
    while (body.length && body[body.length - 1].trim() === "") body.pop();
    const block = lines.slice(start, end).join("\n");
    entries.push({
      key: id ?? `h${hashText(block).slice(0, 10)}`,
      id, date: m[1], title: m[2], pinned, tags, text: body.join("\n"), start, end,
    });
  });
  return entries;
}

export function splitTags(v: string): string[] {
  const seen = new Set<string>();
  return v
    .split(",")
    .map((t) => t.trim().replace(/^#/, ""))
    .filter((t) => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()));
}

function serialize(e: { id: string; date: string; title: string; pinned: boolean; tags: string[]; text: string }): string[] {
  const out = [`## ${e.date} — ${e.title}`, `id: ${e.id}`, `pinned: ${e.pinned ? "yes" : "no"}`, `tags: ${e.tags.join(", ")}`];
  const body = e.text.replace(/\r\n/g, "\n").trim();
  if (body) out.push("", ...body.split("\n"));
  out.push("");
  return out;
}

function nextId(entries: MemoEntry[], date: string): string {
  const prefix = date.replace(/-/g, "");
  let n = 0;
  for (const e of entries) {
    const m = e.id?.match(/^(\d{8})-(\d+)$/);
    if (m && m[1] === prefix) n = Math.max(n, Number(m[2]));
  }
  return `${prefix}-${n + 1}`;
}

const HEADER = [
  "# Mémo",
  "",
  "> Choses à retenir, du plus récent au plus ancien. Jamais de mots de passe, codes d'accès ou numéros de carte : ce fichier est sur GitHub.",
  "",
];

export interface MemoInput {
  title: string;
  text: string;
  tags: string[];
  pinned: boolean;
  date?: string;
}

function check(input: Partial<MemoInput>) {
  if (input.title !== undefined && /[\r\n]/.test(input.title)) throw new UserError("Le titre doit tenir sur une ligne.");
  if (input.text !== undefined && /^##\s/m.test(input.text)) {
    throw new UserError("Le texte ne peut pas contenir de ligne commençant par « ## » (réservé aux titres d'entrées).");
  }
  const reason = detectSensitive(`${input.title ?? ""}\n${input.text ?? ""}\n${(input.tags ?? []).join(" ")}`);
  if (reason) {
    throw new UserError(`Non enregistré : ${reason}. MEMO.md est publié sur GitHub, garde ce genre d'information dans un gestionnaire de mots de passe.`);
  }
}

export async function readMemo() {
  const { text, version } = await readVersioned(MEMO_FILE);
  return { entries: parseMemo(text), version };
}

export async function addMemo(version: string, input: MemoInput & { date: string }) {
  check(input);
  return updateFile<MemoEntry>(MEMO_FILE, version, (text, exists) => {
    const lines = exists ? splitLines(text) : [...HEADER];
    if (lines[lines.length - 1] === "") lines.pop();
    const entries = parseMemo(lines.join("\n"));
    const id = nextId(entries, input.date);
    const block = serialize({ ...input, id });
    // Plus récent en haut : avant la première entrée (ou en fin de fichier s'il n'y en a pas).
    if (!entries.length && lines.length && lines[lines.length - 1].trim() !== "") lines.push("");
    const at = entries.length ? entries[0].start : lines.length;
    lines.splice(at, 0, ...block);
    return { text: joinLines(lines), result: { ...input, id, key: id, start: at, end: at + block.length } };
  });
}

export async function updateMemo(version: string, key: string, patch: Partial<MemoInput>) {
  check(patch);
  return updateFile(MEMO_FILE, version, (text) => {
    const lines = splitLines(text);
    const entries = parseMemo(text);
    const e = entries.find((x) => x.key === key);
    if (!e) throw new UserError("Entrée introuvable (elle a peut-être été supprimée).", 404);
    const merged = {
      id: e.id ?? nextId(entries, patch.date ?? e.date),
      date: patch.date ?? e.date,
      title: patch.title ?? e.title,
      pinned: patch.pinned ?? e.pinned,
      tags: patch.tags ?? e.tags,
      text: patch.text ?? e.text,
    };
    lines.splice(e.start, e.end - e.start, ...serialize(merged));
    return { text: joinLines(lines) };
  });
}

export async function deleteMemo(version: string, key: string) {
  return updateFile(MEMO_FILE, version, (text) => {
    const lines = splitLines(text);
    const e = parseMemo(text).find((x) => x.key === key);
    if (!e) throw new UserError("Entrée introuvable (elle a peut-être déjà été supprimée).", 404);
    lines.splice(e.start, e.end - e.start);
    return { text: joinLines(lines) };
  });
}
