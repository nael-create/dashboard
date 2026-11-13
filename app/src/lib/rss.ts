/**
 * Flux RSS / Atom : téléchargement côté serveur, cache mémoire, analyse et dédoublonnage.
 * - Chaque flux est téléchargé AU PLUS une fois toutes les 5 minutes (un échec peut être retenté).
 * - On n'affiche que ce que fournit le flux (titre, lien, date, image) : aucun article n'est
 *   récupéré en entier, aucun contenu n'est écrit dans le dépôt.
 */
import { XMLParser } from "fast-xml-parser";
import { fold } from "./slug";
import { hashText } from "./content-file";
import type { NewsSource } from "./news-config";

const TTL_MS = 5 * 60 * 1000;
const RETRY_FAILED_MS = 60 * 1000;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ITEMS_PER_FEED = 40;

export interface Article {
  id: string;
  title: string;
  link: string;
  /** Éditeur (ex. « Reuters ») si le flux l'indique, sinon nom de la source. */
  publisher: string;
  sourceId: string;
  date: string | null;
  thumbnail: string | null;
}

interface FeedCache { url: string; at: number; ok: boolean; items: Article[]; error?: string; siteDomain: string }
const g = globalThis as unknown as { __rss?: Map<string, FeedCache> };
const cache = (g.__rss ??= new Map());

// Pas d'option « stopNodes » : la faille connue de fast-xml-parser 5.11.2 ne s'applique pas.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
  processEntities: true,
  htmlEntities: true,
});

const asArray = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
function text(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object" && "#text" in (v as Record<string, unknown>)) return String((v as Record<string, unknown>)["#text"]);
  return "";
}
const decode = (s: string) =>
  s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ").trim();

function imageFrom(item: Record<string, unknown>): string | null {
  const candidates: unknown[] = [
    ...asArray(item["media:thumbnail"] as unknown),
    ...asArray(item["media:content"] as unknown).filter((m) => {
      const r = m as Record<string, string>;
      return !r["@_medium"] || r["@_medium"] === "image" || /^image\//.test(r["@_type"] ?? "");
    }),
    ...asArray((item["media:group"] as Record<string, unknown> | undefined)?.["media:content"] as unknown),
    ...asArray(item.enclosure as unknown).filter((e) => /^image\//.test((e as Record<string, string>)["@_type"] ?? "")),
  ];
  for (const c of candidates) {
    const url = (c as Record<string, string>)?.["@_url"];
    if (url && /^https?:\/\//.test(url)) return url;
  }
  return null;
}

/** Domaine du site d'une source (pour la favicon). Google News « site:reuters.com » → reuters.com. */
export function siteDomain(feedUrl: string, channelLink?: string): string {
  try {
    const u = new URL(feedUrl);
    if (u.hostname === "news.google.com") {
      const m = (u.searchParams.get("q") ?? "").match(/site:([a-z0-9.-]+\.[a-z]{2,})/i);
      if (m) return m[1].toLowerCase();
    }
    if (channelLink) return new URL(channelLink).hostname.replace(/^www\./, "");
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function parseFeed(xml: string, source: Pick<NewsSource, "id" | "name" | "url">): { items: Article[]; siteDomain: string } {
  const doc = parser.parse(xml) as Record<string, Record<string, unknown>>;
  const rss = doc.rss?.channel as Record<string, unknown> | undefined;
  const atom = doc.feed as Record<string, unknown> | undefined;
  const rdf = doc["rdf:RDF"] as Record<string, unknown> | undefined;
  if (!rss && !atom && !rdf) throw new Error("ce n'est pas un flux RSS ou Atom");

  let channelLink = "";
  let raw: Record<string, unknown>[] = [];
  if (rss) {
    channelLink = text(rss.link);
    raw = asArray(rss.item as Record<string, unknown>[]);
  } else if (rdf) {
    raw = asArray(rdf.item as Record<string, unknown>[]);
  } else if (atom) {
    const links = asArray(atom.link as Record<string, string>[]);
    channelLink = links.find((l) => !l["@_rel"] || l["@_rel"] === "alternate")?.["@_href"] ?? "";
    raw = asArray(atom.entry as Record<string, unknown>[]);
  }

  const items: Article[] = [];
  for (const it of raw.slice(0, MAX_ITEMS_PER_FEED)) {
    let link = text(it.link);
    if (!link) {
      const links = asArray(it.link as Record<string, string>[]);
      link = links.find((l) => !l["@_rel"] || l["@_rel"] === "alternate")?.["@_href"] ?? links[0]?.["@_href"] ?? "";
    }
    if (!/^https?:\/\//.test(link)) continue;
    const publisher = decode(text(it.source)) || source.name;
    let title = decode(text(it.title));
    // Google News ajoute « - Reuters » à la fin des titres.
    if (publisher && title.endsWith(` - ${publisher}`)) title = title.slice(0, -(publisher.length + 3));
    if (!title) continue;
    const dateRaw = text(it.pubDate) || text(it["dc:date"]) || text(it.published) || text(it.updated);
    const t = Date.parse(dateRaw);
    items.push({
      id: hashText(link),
      title,
      link,
      publisher,
      sourceId: source.id,
      date: Number.isNaN(t) ? null : new Date(t).toISOString(),
      thumbnail: imageFrom(it),
    });
  }
  return { items, siteDomain: siteDomain(source.url, channelLink) };
}

async function download(url: string): Promise<string> {
  const host = new URL(url).hostname;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.5", "User-Agent": "personal-dashboard/1.0" },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) throw new Error(`délai dépassé : ${host} ne répond pas`);
    throw new Error(`impossible de joindre ${host}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}${res.status === 404 ? " (flux introuvable)" : res.status === 403 ? " (accès refusé)" : ""}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) throw new Error("flux trop volumineux");
  return new TextDecoder("utf-8").decode(buf);
}

/** Articles d'une source, depuis le cache si possible. */
export async function loadFeed(source: NewsSource, retryFailed = false): Promise<FeedCache> {
  const hit = cache.get(source.id);
  if (hit && hit.url === source.url) {
    const age = Date.now() - hit.at;
    if (hit.ok && age < TTL_MS) return hit;
    if (!hit.ok && age < (retryFailed ? RETRY_FAILED_MS : TTL_MS)) return hit;
  }
  try {
    const { items, siteDomain: domain } = parseFeed(await download(source.url), source);
    const entry: FeedCache = { url: source.url, at: Date.now(), ok: true, items, siteDomain: domain };
    cache.set(source.id, entry);
    return entry;
  } catch (e) {
    const entry: FeedCache = {
      url: source.url, at: Date.now(), ok: false,
      items: hit?.url === source.url ? hit.items : [],
      error: e instanceof Error ? e.message : String(e),
      siteDomain: hit?.siteDomain ?? siteDomain(source.url),
    };
    cache.set(source.id, entry);
    return entry;
  }
}

/** Vérifie un lien avant de l'enregistrer comme source. */
export async function probeFeed(source: Pick<NewsSource, "id" | "name" | "url">): Promise<number> {
  return parseFeed(await download(source.url), source).items.length;
}

/* ------------------------------------------------------------------ */
/* Dédoublonnage                                                        */
/* ------------------------------------------------------------------ */

export function normalizeUrl(link: string): string {
  try {
    const u = new URL(link);
    const keepQuery = u.hostname === "news.google.com";
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}${keepQuery ? u.search : ""}`;
  } catch {
    return link;
  }
}

const words = (title: string) => fold(title).replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter((w) => w.length > 1);

function similar(a: string[], b: string[]): boolean {
  if (a.join(" ") === b.join(" ")) return true;
  if (a.length < 5 || b.length < 5) return false;
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter) >= 0.8;
}

/** Retire les doublons (même URL ou titre quasi identique) ; garde la première occurrence. */
export function dedupe(articles: Article[]): Article[] {
  const out: Article[] = [];
  const urls = new Set<string>();
  const titles: string[][] = [];
  for (const a of articles) {
    const u = normalizeUrl(a.link);
    if (urls.has(u)) continue;
    const w = words(a.title);
    if (titles.some((t) => similar(t, w))) continue;
    urls.add(u);
    titles.push(w);
    out.push(a);
  }
  return out;
}

export const byDateDesc = (a: Article, b: Article) => (b.date ?? "").localeCompare(a.date ?? "");

/** Articles actuellement en cache (pour la recherche et les vignettes), sans réseau. */
export function cachedArticles(): Article[] {
  return [...cache.values()].flatMap((c) => c.items);
}
