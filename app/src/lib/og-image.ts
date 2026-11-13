/**
 * Image d'aperçu d'un article quand le flux n'en fournit pas : on lit UNIQUEMENT la balise
 * <meta property="og:image"> du début de la page, au plus une fois par article.
 * Cache sur le serveur, hors du dépôt (dossier temporaire du système).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CACHE_FILE = path.join(/*turbopackIgnore: true*/ os.tmpdir(), "personal-dashboard-og-cache.json");
const MAX_ENTRIES = 3000;
const g = globalThis as unknown as { __og?: Map<string, string | null>; __ogPending?: Map<string, Promise<string | null>> };

function cache(): Map<string, string | null> {
  if (!g.__og) {
    g.__og = new Map();
    try {
      const data = JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ CACHE_FILE, "utf8")) as [string, string | null][];
      for (const [k, v] of data.slice(-MAX_ENTRIES)) g.__og.set(k, v);
    } catch {
      /* pas encore de cache */
    }
  }
  return g.__og;
}

let saveTimer: NodeJS.Timeout | null = null;
function persist() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.writeFileSync(/*turbopackIgnore: true*/ CACHE_FILE, JSON.stringify([...cache().entries()].slice(-MAX_ENTRIES)), { mode: 0o600 });
    } catch {
      /* cache facultatif */
    }
  }, 2000);
}

function extract(html: string, base: string): string | null {
  const metas = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const wanted of ["og:image", "og:image:url", "twitter:image"]) {
    for (const m of metas) {
      const key = m.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
      if (key !== wanted) continue;
      const content = m.match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1];
      if (!content) continue;
      try {
        const u = new URL(content.replace(/&amp;/g, "&"), base);
        if (u.protocol === "https:" || u.protocol === "http:") return u.toString();
      } catch {
        /* URL invalide */
      }
    }
  }
  return null;
}

async function fetchHead(link: string): Promise<string | null> {
  const res = await fetch(link, {
    headers: { Accept: "text/html", "User-Agent": "personal-dashboard/1.0" },
    redirect: "follow",
    signal: AbortSignal.timeout(6000),
    cache: "no-store",
  });
  if (!res.ok || !res.body) return null;
  // On ne lit que le début de la page (l'en-tête), jamais l'article.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let html = "";
  while (html.length < 200_000) {
    const { value, done } = await reader.read();
    if (done) break;
    html += decoder.decode(value, { stream: true });
    if (/<\/head>/i.test(html)) break;
  }
  await reader.cancel().catch(() => {});
  return extract(html.split(/<\/head>/i)[0], res.url || link);
}

export async function ogImage(link: string): Promise<string | null> {
  const c = cache();
  if (c.has(link)) return c.get(link)!;
  // Les liens Google News sont des redirections sans image utile.
  if (/^https?:\/\/news\.google\.com\//.test(link)) {
    c.set(link, null);
    return null;
  }
  const pending = (g.__ogPending ??= new Map());
  if (!pending.has(link)) {
    pending.set(
      link,
      fetchHead(link)
        .catch(() => null)
        .then((img) => {
          c.set(link, img);
          pending.delete(link);
          persist();
          return img;
        }),
    );
  }
  return pending.get(link)!;
}
