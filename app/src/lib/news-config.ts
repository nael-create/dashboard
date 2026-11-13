/**
 * Configuration des actus : NEWS.md (sources publiques, ordre et visibilité des widgets)
 * + app/data/news.local.json (sources PRIVÉES dont l'URL contient une clé personnelle ; ignoré par git).
 *
 * Format de NEWS.md (modifiable à la main) :
 *
 *   ## Réglages
 *   widgets: source            ← « source » (un widget par source) ou « category » (un par catégorie)
 *
 *   ## Ordre des widgets
 *   - [x] ft-world             ← [x] visible, [ ] masqué ; « cat:Marchés » pour un widget de catégorie
 *
 *   ## FT World
 *   id: ft-world
 *   url: https://www.ft.com/world?format=rss
 *   category: Monde
 *   color: #0ea5e9
 *   enabled: yes
 */
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { UserError } from "./api";
import { joinLines, readVersioned, splitLines, updateFile } from "./content-file";
import { slugify } from "./slug";

export const NEWS_FILE = "NEWS.md";
const LOCAL_FILE = path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "news.local.json");

export interface NewsSource {
  id: string;
  name: string;
  url: string;
  category: string;
  color: string;
  enabled: boolean;
  private: boolean;
}

export type WidgetMode = "source" | "category";
export interface WidgetPref { key: string; visible: boolean }

export interface NewsConfig {
  sources: NewsSource[];
  mode: WidgetMode;
  order: WidgetPref[];
  version: string;
}

export const DEFAULT_SOURCES: Omit<NewsSource, "private">[] = [
  { id: "ft-international", name: "FT International", url: "https://www.ft.com/rss/home", category: "Monde", color: "#e0785a", enabled: true },
  { id: "ft-world", name: "FT World", url: "https://www.ft.com/world?format=rss", category: "Monde", color: "#d9612f", enabled: true },
  { id: "ft-markets", name: "FT Markets", url: "https://www.ft.com/markets?format=rss", category: "Marchés", color: "#0d7680", enabled: true },
  { id: "ft-global-economy", name: "FT Global Economy", url: "https://www.ft.com/global-economy?format=rss", category: "Économie", color: "#990f3d", enabled: true },
  { id: "reuters", name: "Reuters", url: "https://news.google.com/rss/search?q=when:24h+site:reuters.com&ceid=US:en&hl=en-US&gl=US", category: "Monde", color: "#f97316", enabled: true },
  { id: "reuters-business", name: "Reuters Business", url: "https://news.google.com/rss/search?q=when:24h+site:reuters.com/business&ceid=US:en&hl=en-US&gl=US", category: "Business", color: "#6366f1", enabled: true },
  { id: "reuters-markets", name: "Reuters Markets", url: "https://news.google.com/rss/search?q=when:7d+site:reuters.com/markets+-site:reuters.com/markets/quote&ceid=US:en&hl=en-US&gl=US", category: "Marchés", color: "#10b981", enabled: true },
];

const SETTINGS = "## Réglages";
const ORDER = "## Ordre des widgets";
const SOURCE_KEYS = ["id", "url", "category", "color", "enabled"] as const;

/* ------------------------------------------------------------------ */
/* Lecture                                                              */
/* ------------------------------------------------------------------ */

interface Block { start: number; end: number; heading: string }

function blocks(lines: string[]): Block[] {
  const starts = lines.map((l, i) => (/^##\s/.test(l) ? i : -1)).filter((i) => i >= 0);
  return starts.map((s, k) => ({ start: s, end: k + 1 < starts.length ? starts[k + 1] : lines.length, heading: lines[s].trim() }));
}

function readMeta(lines: string[], b: Block): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = b.start + 1; i < b.end; i++) {
    const m = lines[i].match(/^([a-z_]+)\s*:\s*(.*?)\s*$/i);
    if (m) out[m[1].toLowerCase()] = m[2];
  }
  return out;
}

export function parseNews(text: string): Omit<NewsConfig, "version"> {
  const lines = splitLines(text);
  const sources: NewsSource[] = [];
  let mode: WidgetMode = "source";
  const order: WidgetPref[] = [];
  const seen = new Set<string>();
  for (const b of blocks(lines)) {
    if (b.heading === SETTINGS) {
      if (/^category$/i.test(readMeta(lines, b).widgets ?? "")) mode = "category";
    } else if (b.heading === ORDER) {
      for (let i = b.start + 1; i < b.end; i++) {
        const m = lines[i].match(/^\s*[-*]\s+\[([ xX])\]\s+(\S.*?)\s*$/);
        if (m) order.push({ key: m[2], visible: m[1] !== " " });
      }
    } else {
      const meta = readMeta(lines, b);
      if (!meta.url) continue;
      const name = b.heading.replace(/^##\s+/, "");
      let id = meta.id && /^[a-z0-9-]+$/.test(meta.id) ? meta.id : slugify(name);
      while (seen.has(id)) id = `${id}-2`;
      seen.add(id);
      sources.push({
        id, name, url: meta.url,
        category: meta.category || "Autres",
        color: /^#[0-9a-f]{6}$/i.test(meta.color ?? "") ? meta.color.toLowerCase() : "#64748b",
        enabled: !/^(no|non|false)$/i.test(meta.enabled ?? "yes"),
        private: false,
      });
    }
  }
  return { sources, mode, order };
}

const localSchema = z.object({
  sources: z.array(z.object({
    id: z.string(), name: z.string(), url: z.string().url(), category: z.string(),
    color: z.string(), enabled: z.boolean(),
  })),
});

async function readLocal(): Promise<NewsSource[]> {
  try {
    const raw = JSON.parse(await fs.readFile(/*turbopackIgnore: true*/ LOCAL_FILE, "utf8"));
    return localSchema.parse(raw).sources.map((s) => ({ ...s, private: true }));
  } catch {
    return [];
  }
}

async function writeLocal(sources: NewsSource[]) {
  await fs.mkdir(/*turbopackIgnore: true*/ path.dirname(LOCAL_FILE), { recursive: true });
  const data = { sources: sources.filter((s) => s.private).map(({ private: _p, ...s }) => s) };
  const tmp = `${LOCAL_FILE}.${process.pid}.tmp`;
  await fs.writeFile(/*turbopackIgnore: true*/ tmp, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
  await fs.rename(/*turbopackIgnore: true*/ tmp, LOCAL_FILE);
}

/** Configuration complète. Crée NEWS.md avec les sources par défaut s'il n'existe pas encore. */
export async function readNewsConfig(): Promise<NewsConfig> {
  let cur = await readVersioned(NEWS_FILE);
  if (!cur.exists) {
    await updateFile(NEWS_FILE, "absent", (_t, exists) => ({ text: exists ? null : defaultNewsFile() }));
    cur = await readVersioned(NEWS_FILE);
  }
  const parsed = parseNews(cur.text);
  const local = await readLocal();
  const ids = new Set(parsed.sources.map((s) => s.id));
  return { ...parsed, sources: [...parsed.sources, ...local.filter((s) => !ids.has(s.id))], version: cur.version };
}

/* ------------------------------------------------------------------ */
/* Écriture (ligne par ligne)                                           */
/* ------------------------------------------------------------------ */

function sourceBlock(s: NewsSource): string[] {
  return [`## ${s.name}`, `id: ${s.id}`, `url: ${s.url}`, `category: ${s.category}`, `color: ${s.color}`, `enabled: ${s.enabled ? "yes" : "no"}`, ""];
}

function orderBlock(order: WidgetPref[]): string[] {
  return [ORDER, "", ...order.map((o) => `- [${o.visible ? "x" : " "}] ${o.key}`), ""];
}

export function defaultNewsFile(): string {
  const lines = [
    "# Actus",
    "",
    "> Sources d'actualités (flux RSS) de la page Actus. Modifiable ici ou depuis l'app.",
    "> Les sources privées (lien contenant une clé personnelle) ne sont pas ici : elles restent dans app/data/news.local.json.",
    "",
    SETTINGS,
    "widgets: source",
    "",
    ...orderBlock(DEFAULT_SOURCES.map((s) => ({ key: s.id, visible: true }))),
    ...DEFAULT_SOURCES.flatMap((s) => sourceBlock({ ...s, private: false })),
  ];
  return joinLines(lines);
}

/** Remplace (ou ajoute) une section réservée sans toucher au reste du fichier. */
function replaceSection(lines: string[], heading: string, replacement: string[]) {
  const b = blocks(lines).find((x) => x.heading === heading);
  if (b) lines.splice(b.start, b.end - b.start, ...replacement);
  else {
    const first = blocks(lines).find((x) => x.heading !== SETTINGS && x.heading !== ORDER);
    const at = first ? first.start : lines.length;
    lines.splice(at, 0, ...replacement);
  }
}

export async function saveLayout(version: string, patch: { mode?: WidgetMode; order?: WidgetPref[] }) {
  return updateFile(NEWS_FILE, version, (text) => {
    const lines = splitLines(text);
    if (patch.mode) replaceSection(lines, SETTINGS, [SETTINGS, `widgets: ${patch.mode}`, ""]);
    if (patch.order) {
      for (const o of patch.order) if (/[\r\n]/.test(o.key)) throw new UserError("Clé de widget invalide.");
      replaceSection(lines, ORDER, orderBlock(patch.order));
    }
    return { text: joinLines(lines) };
  });
}

export interface SourceInput { name: string; url: string; category: string; color: string; private: boolean }

export async function addSource(version: string, input: SourceInput): Promise<NewsSource> {
  const cfg = await readNewsConfig();
  const taken = new Set(cfg.sources.map((s) => s.id));
  let id = slugify(input.name) || "source";
  for (let n = 2; taken.has(id); n++) id = `${slugify(input.name) || "source"}-${n}`;
  if (cfg.sources.some((s) => s.url === input.url)) throw new UserError("Cette source est déjà ajoutée.", 409);
  const src: NewsSource = { id, name: input.name, url: input.url, category: input.category, color: input.color, enabled: true, private: input.private };

  if (src.private) {
    await writeLocal([...cfg.sources.filter((s) => s.private), src]);
  } else {
    await updateFile(NEWS_FILE, version, (text) => {
      const lines = splitLines(text);
      if (lines[lines.length - 1] === "") lines.pop();
      lines.push("", ...sourceBlock(src));
      return { text: joinLines(lines) };
    });
  }
  return src;
}

export async function updateSource(version: string, id: string, patch: Partial<Pick<NewsSource, "name" | "category" | "color" | "enabled">>) {
  const cfg = await readNewsConfig();
  const src = cfg.sources.find((s) => s.id === id);
  if (!src) throw new UserError("Source introuvable.", 404);
  const next = { ...src, ...patch };
  if (src.private) {
    await writeLocal(cfg.sources.map((s) => (s.id === id ? next : s)));
    return next;
  }
  await updateFile(NEWS_FILE, version, (text) => {
    const lines = splitLines(text);
    const b = blocks(lines).find((x) => readMeta(lines, x).id === id || (x.heading === `## ${src.name}` && readMeta(lines, x).url === src.url));
    if (!b) throw new UserError("Source introuvable dans NEWS.md.", 404);
    // Remplace uniquement les lignes connues ; les autres lignes du bloc (notes à la main) sont conservées.
    lines[b.start] = `## ${next.name}`;
    const values: Record<string, string> = { id: next.id, url: next.url, category: next.category, color: next.color, enabled: next.enabled ? "yes" : "no" };
    const present = new Set<string>();
    for (let i = b.start + 1; i < b.end; i++) {
      const m = lines[i].match(/^([a-z_]+)\s*:/i);
      const k = m?.[1].toLowerCase();
      if (k && k in values) {
        lines[i] = `${k}: ${values[k]}`;
        present.add(k);
      }
    }
    const missing = SOURCE_KEYS.filter((k) => !present.has(k)).map((k) => `${k}: ${values[k]}`);
    lines.splice(b.start + 1, 0, ...missing);
    return { text: joinLines(lines) };
  });
  return next;
}

export async function removeSource(version: string, id: string) {
  const cfg = await readNewsConfig();
  const src = cfg.sources.find((s) => s.id === id);
  if (!src) throw new UserError("Source introuvable.", 404);
  if (src.private) return writeLocal(cfg.sources.filter((s) => s.id !== id));
  await updateFile(NEWS_FILE, version, (text) => {
    const lines = splitLines(text);
    const b = blocks(lines).find((x) => readMeta(lines, x).id === id);
    if (!b) throw new UserError("Source introuvable dans NEWS.md.", 404);
    lines.splice(b.start, b.end - b.start);
    // Retire aussi la ligne correspondante de l'ordre des widgets.
    const ob = blocks(lines).find((x) => x.heading === ORDER);
    if (ob) {
      for (let i = ob.end - 1; i > ob.start; i--) {
        if (new RegExp(`^\\s*[-*]\\s+\\[[ xX]\\]\\s+${id}\\s*$`).test(lines[i])) lines.splice(i, 1);
      }
    }
    return { text: joinLines(lines) };
  });
}
