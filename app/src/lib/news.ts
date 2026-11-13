/** Assemblage des widgets d'actus à partir de NEWS.md et des flux (en cache). */
import { readNewsConfig, type NewsSource, type WidgetMode } from "./news-config";
import { byDateDesc, dedupe, loadFeed, type Article } from "./rss";
import { displayTimeZone } from "./display-tz";
import { localStamp } from "./tz";

export interface NewsWidget {
  key: string;
  title: string;
  color: string;
  domain: string;
  sourceIds: string[];
  visible: boolean;
  items: Article[];
}

export interface NewsError { sourceId: string; name: string; message: string; staleSince?: string }

export interface NewsPayload {
  mode: WidgetMode;
  version: string;
  sources: (Omit<NewsSource, "url"> & { host: string; domain: string })[];
  widgets: NewsWidget[];
  latest: Article[];
  errors: NewsError[];
  fetchedAt: string;
}

export const widgetKeyFor = (mode: WidgetMode, s: NewsSource) => (mode === "category" ? `cat:${s.category}` : s.id);

export async function buildNews(retryFailed = false): Promise<NewsPayload> {
  const cfg = await readNewsConfig();
  const enabled = cfg.sources.filter((s) => s.enabled);
  const feeds = new Map(await Promise.all(enabled.map(async (s) => [s.id, await loadFeed(s, retryFailed)] as const)));

  const errors: NewsError[] = [];
  for (const s of enabled) {
    const f = feeds.get(s.id)!;
    if (!f.ok) {
      errors.push({
        sourceId: s.id, name: s.name, message: f.error ?? "erreur inconnue",
        staleSince: f.items.length ? localStamp(f.at, displayTimeZone()).slice(11) : undefined,
      });
    }
  }

  // Clés de widgets dans l'ordre choisi (les nouvelles à la fin, visibles).
  const keys: string[] = [];
  for (const s of enabled) {
    const k = widgetKeyFor(cfg.mode, s);
    if (!keys.includes(k)) keys.push(k);
  }
  const prefs = new Map(cfg.order.map((o) => [o.key, o.visible]));
  const ordered = [...cfg.order.map((o) => o.key).filter((k) => keys.includes(k)), ...keys.filter((k) => !prefs.has(k))];

  // Dédoublonnage global, dans l'ordre des widgets : un article déjà montré n'est pas répété.
  const seen: Article[] = [];
  const widgets: NewsWidget[] = ordered.map((key) => {
    const srcs = enabled.filter((s) => widgetKeyFor(cfg.mode, s) === key);
    const items = srcs.flatMap((s) => feeds.get(s.id)!.items).sort(byDateDesc);
    const unique = dedupe([...seen, ...items]).slice(seen.length);
    seen.push(...unique);
    const first = srcs[0];
    return {
      key,
      title: cfg.mode === "category" ? first.category : first.name,
      color: first.color,
      domain: feeds.get(first.id)!.siteDomain,
      sourceIds: srcs.map((s) => s.id),
      visible: prefs.get(key) ?? true,
      items: unique.slice(0, 30),
    };
  });

  const visibleIds = new Set(widgets.filter((w) => w.visible).flatMap((w) => w.sourceIds));
  const latest = dedupe(widgets.flatMap((w) => w.items).filter((a) => visibleIds.has(a.sourceId)).sort(byDateDesc)).slice(0, 5);

  return {
    mode: cfg.mode,
    version: cfg.version,
    sources: cfg.sources.map(({ url, ...s }) => {
      let host = "";
      try {
        host = new URL(url).hostname;
      } catch {
        /* lien invalide */
      }
      return { ...s, host, domain: feeds.get(s.id)?.siteDomain ?? host };
    }),
    widgets,
    latest,
    errors,
    fetchedAt: new Date().toISOString(),
  };
}
