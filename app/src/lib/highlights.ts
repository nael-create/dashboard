/**
 * SURLIGNAGES.md — passages surlignés dans les newsletters (voir CLAUDE.md, section 19).
 *
 *   ## 2026-11-16 — Objet de la newsletter
 *   id: hl-20261116-1
 *   color: yellow                      ← yellow | green | blue | pink
 *   from: Aktionnaire <team@aktionnaire.com>
 *   received: 2026-11-13T12:35:00Z     ← date de la newsletter
 *   link: https://outlook.live.com/…   ← lien Outlook web
 *   prefix: texte juste avant          ← ancrage (≈ 32 caractères)
 *   suffix: texte juste après
 *
 *   > Le passage surligné (1 000 caractères au plus).
 *
 *   Note libre (facultative).
 *
 * Exception étroite et voulue à « le corps d'un e-mail n'est jamais écrit dans le dépôt » : seuls les
 * passages choisis par le propriétaire, plafonnés à 1 000 caractères chacun, jamais l'e-mail entier.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { UserError } from "./api";
import { MAX_PASSAGE, collapse } from "./anchoring";
import { joinLines, readVersioned, splitLines, updateFile } from "./content-file";
import { lineSecretReason } from "./secrets";

export const HIGHLIGHTS_FILE = "SURLIGNAGES.md";
export const HIGHLIGHT_COLORS = ["yellow", "green", "blue", "pink"] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

export interface Highlight {
  id: string;
  date: string;
  subject: string;
  color: HighlightColor;
  from: string;
  received: string;
  link: string;
  prefix: string;
  suffix: string;
  text: string;
  note: string;
  start: number;
  end: number;
}

export interface HighlightInput {
  text: string;
  prefix: string;
  suffix: string;
  color: HighlightColor;
  note?: string;
  subject: string;
  from: string;
  received: string;
  link: string;
}

const HEADING = /^##\s+(\d{4}-\d{2}-\d{2})\s+[—–-]\s+(.*?)\s*$/;
const META = /^(id|color|from|received|link|prefix|suffix)\s*:\s?(.*)$/i;
const HEADER = [
  "# Surlignages",
  "",
  "> Passages surlignés dans les newsletters (1 000 caractères au plus chacun, jamais l'e-mail entier), avec leur note. Pas de mots de passe ni de codes : ce fichier est sur GitHub.",
  "",
];

export function parseHighlights(text: string): Highlight[] {
  const lines = splitLines(text);
  const starts = lines.map((l, i) => (/^##\s/.test(l) ? i : -1)).filter((i) => i >= 0);
  const out: Highlight[] = [];
  starts.forEach((start, k) => {
    const m = lines[start].match(HEADING);
    if (!m) return; // titre ## qui n'est pas un surlignage : ignoré, conservé tel quel
    const end = k + 1 < starts.length ? starts[k + 1] : lines.length;
    const meta: Record<string, string> = {};
    let i = start + 1;
    for (; i < end; i++) {
      const mm = lines[i].match(META);
      if (!mm) break;
      meta[mm[1].toLowerCase()] = mm[2].trim();
    }
    const quote: string[] = [];
    const note: string[] = [];
    for (const l of lines.slice(i, end)) {
      if (/^\s*>/.test(l)) quote.push(l.replace(/^\s*>\s?/, ""));
      else note.push(l);
    }
    const trim = (a: string[]) => {
      while (a.length && !a[0].trim()) a.shift();
      while (a.length && !a[a.length - 1].trim()) a.pop();
      return a;
    };
    const color = (HIGHLIGHT_COLORS as readonly string[]).includes(meta.color) ? (meta.color as HighlightColor) : "yellow";
    if (!meta.id) return; // bloc incomplet : ignoré sans erreur
    out.push({
      id: meta.id, date: m[1], subject: m[2], color,
      from: meta.from ?? "", received: meta.received ?? "", link: meta.link ?? "",
      prefix: meta.prefix ?? "", suffix: meta.suffix ?? "",
      text: trim(quote).join(" ").trim(), note: trim(note).join("\n"),
      start, end,
    });
  });
  return out;
}

const oneLine = (s: string) => collapse(s).trim();
/** 1000 → « 1 000 ». */
const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

function serialize(h: Omit<Highlight, "start" | "end">): string[] {
  const out = [
    `## ${h.date} — ${oneLine(h.subject) || "(sans objet)"}`,
    `id: ${h.id}`,
    `color: ${h.color}`,
    `from: ${oneLine(h.from)}`,
    `received: ${oneLine(h.received)}`,
    `link: ${oneLine(h.link)}`,
    `prefix: ${oneLine(h.prefix)}`,
    `suffix: ${oneLine(h.suffix)}`,
    "",
    `> ${oneLine(h.text)}`,
  ];
  const note = h.note.replace(/\r\n/g, "\n").trim();
  if (note) out.push("", ...note.split("\n"));
  out.push("");
  return out;
}

function nextId(all: Highlight[], date: string): string {
  const prefix = `hl-${date.replace(/-/g, "")}`;
  let n = 0;
  for (const h of all) {
    const m = h.id.match(/^hl-(\d{8})-(\d+)$/);
    if (m && `hl-${m[1]}` === prefix) n = Math.max(n, Number(m[2]));
  }
  return `${prefix}-${n + 1}`;
}

/** Contrôles avant écriture : longueur, forme, et aucun secret (même contrôle que « Sauvegarder »). */
export function checkHighlight(input: Partial<HighlightInput>) {
  if (input.text !== undefined) {
    const t = oneLine(input.text);
    if (!t) throw new UserError("Sélectionne d'abord un passage.");
    if (t.length > MAX_PASSAGE) {
      throw new UserError(`Passage trop long : ${fmt(MAX_PASSAGE)} caractères au plus (ta sélection en fait ${fmt(t.length)}). Surligne un passage plus court.`);
    }
  }
  if (input.note !== undefined) {
    if (input.note.length > 2000) throw new UserError("Note trop longue (2 000 caractères au plus).");
    if (/^\s*(##|>)/m.test(input.note)) throw new UserError("Une ligne de la note ne peut pas commencer par « ## » ni par « > ».");
  }
  if (input.color !== undefined && !(HIGHLIGHT_COLORS as readonly string[]).includes(input.color)) throw new UserError("Couleur inconnue.");
  if (input.link && !/^https:\/\//.test(input.link)) throw new UserError("Lien Outlook invalide.");
  for (const v of [input.text, input.note, input.prefix, input.suffix, input.subject, input.from]) {
    if (!v) continue;
    for (const line of v.split("\n")) {
      const reason = lineSecretReason(line);
      if (reason) {
        throw new UserError(`Non enregistré : ${reason}. SURLIGNAGES.md est publié sur GitHub ; ne surligne pas de mot de passe, de code ou de numéro de carte.`);
      }
    }
  }
}

export async function readHighlights() {
  const { text, version } = await readVersioned(HIGHLIGHTS_FILE);
  return { highlights: parseHighlights(text), version };
}

/** Ajout en haut du fichier (plus récent d'abord). Sans version : rien n'est écrasé, le bloc est inséré. */
export async function addHighlight(input: HighlightInput, today: string, version?: string) {
  checkHighlight(input);
  return updateFile<Highlight>(HIGHLIGHTS_FILE, version, (text, exists) => {
    const lines = exists ? splitLines(text) : [...HEADER];
    if (lines[lines.length - 1] === "") lines.pop();
    const all = parseHighlights(lines.join("\n"));
    const h = {
      id: nextId(all, today), date: today, subject: input.subject, color: input.color,
      from: input.from, received: input.received, link: input.link,
      prefix: input.prefix, suffix: input.suffix, text: oneLine(input.text), note: input.note ?? "",
    };
    const block = serialize(h);
    if (!all.length && lines.length && lines[lines.length - 1].trim() !== "") lines.push("");
    const at = all.length ? all[0].start : lines.length;
    lines.splice(at, 0, ...block);
    return { text: joinLines(lines), result: { ...h, start: at, end: at + block.length } };
  });
}

export async function updateHighlight(version: string | undefined, id: string, patch: { color?: HighlightColor; note?: string }) {
  checkHighlight(patch);
  return updateFile<Highlight>(HIGHLIGHTS_FILE, version, (text) => {
    const lines = splitLines(text);
    const h = parseHighlights(text).find((x) => x.id === id);
    if (!h) throw new UserError("Surlignage introuvable (il a peut-être été supprimé).", 404);
    const merged = { ...h, color: patch.color ?? h.color, note: patch.note ?? h.note };
    lines.splice(h.start, h.end - h.start, ...serialize(merged));
    return { text: joinLines(lines), result: merged };
  });
}

export async function deleteHighlight(version: string | undefined, id: string) {
  return updateFile(HIGHLIGHTS_FILE, version, (text) => {
    const lines = splitLines(text);
    const h = parseHighlights(text).find((x) => x.id === id);
    if (!h) throw new UserError("Surlignage introuvable (il a peut-être déjà été supprimé).", 404);
    lines.splice(h.start, h.end - h.start);
    return { text: joinLines(lines) };
  });
}

/** La newsletter d'un surlignage : même lien Outlook, sinon même objet et même date de réception. */
export function sameNewsletter(h: Pick<Highlight, "link" | "subject" | "received">, m: { webLink: string; subject: string; received: string }) {
  if (h.link && m.webLink) return h.link === m.webLink;
  return oneLine(h.subject) === oneLine(m.subject) && h.received === m.received;
}

/* ------------------------------------------------------------------ */
/* « Introuvable dans le mail » : état local (jamais dans le dépôt)     */
/* ------------------------------------------------------------------ */

const statusFile = () =>
  path.join(/*turbopackIgnore: true*/ process.env.DASHBOARD_DATA_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "data"), "highlights-status.local.json");

export type HighlightStatus = Record<string, "found" | "missing">;

export async function readHighlightStatus(): Promise<HighlightStatus> {
  try {
    const data = JSON.parse(await fs.readFile(/*turbopackIgnore: true*/ statusFile(), "utf8"));
    return data && typeof data === "object" ? (data as HighlightStatus) : {};
  } catch {
    return {}; // absent ou illisible : rien de connu, sans erreur
  }
}

let statusQueue: Promise<unknown> = Promise.resolve();
export function recordHighlightStatus(found: string[], missing: string[]) {
  const run = statusQueue.then(async () => {
    const s = await readHighlightStatus();
    for (const id of found) s[id] = "found";
    for (const id of missing) s[id] = "missing";
    const file = statusFile();
    await fs.mkdir(/*turbopackIgnore: true*/ path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(/*turbopackIgnore: true*/ tmp, JSON.stringify(s, null, 2) + "\n", { mode: 0o600 });
    await fs.rename(/*turbopackIgnore: true*/ tmp, file);
  });
  statusQueue = run.catch(() => {});
  return run;
}
