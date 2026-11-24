import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { readNewsConfig, type NewsSource } from "@/lib/news-config";
import { dedupe, loadFeed, type Article } from "@/lib/rss";
import { ogImage } from "@/lib/og-image";
import { gridLayout, interleave } from "@/lib/headlines";
import { HeadlineCard } from "./headline-card";
import { AutoRefresh } from "./auto-refresh";

const COUNT = 14; // 2 grands + 2 rangées de 6
/** Sujets examinés par source (image du flux, sinon og:image, mise en cache). */
const PER_SOURCE = 14;

/** Image d'un article : celle du flux, sinon og:image (au plus une fois par article, en cache). */
async function withImage(a: Article): Promise<(Article & { image: string }) | null> {
  const image = a.thumbnail ?? (await ogImage(a.link).catch(() => null));
  return image ? { ...a, image } : null;
}

/**
 * « À la une » : uniquement des sujets AVEC image. Colonne vertébrale : l'ordre éditorial du flux
 * FT International (ordre du flux, pas l'ordre chronologique) ; les autres sources actives, une par
 * site (ex. The Verge, Maddyness), s'intercalent à tour de rôle, jamais plus de 2 sujets d'affilée de
 * la même source. Les articles sans image (Reuters via Google News…) restent sur la page News, dans le Fil.
 */
export async function HeadlinesGrid() {
  const cfg = await readNewsConfig();
  const enabled = cfg.sources.filter((s) => s.enabled);
  const primary = enabled.find((s) => s.id === "ft-international") ?? enabled[0];
  if (!primary) {
    return <p className="border-y border-dashed border-border py-6 text-sm text-muted">Aucune source d&apos;actus active. Ajoute-en depuis la page News.</p>;
  }
  const feeds = new Map(await Promise.all(enabled.map(async (s) => [s.id, await loadFeed(s)] as const)));
  const domainOf = (s: NewsSource) => feeds.get(s.id)!.siteDomain;
  // Une source par site, hors site principal (les autres rubriques FT feraient doublon).
  const others: NewsSource[] = [];
  for (const s of enabled) {
    if (s === primary || domainOf(s) === domainOf(primary) || others.some((o) => domainOf(o) === domainOf(s))) continue;
    others.push(s);
  }

  // Dédoublonnage dans l'ordre de priorité, puis recherche des images (en parallèle, en cache).
  const unique = new Set(dedupe([primary, ...others].flatMap((s) => feeds.get(s.id)!.items.slice(0, PER_SOURCE))).map((a) => a.id));
  const resolve = async (s: NewsSource) =>
    (await Promise.all(feeds.get(s.id)!.items.slice(0, PER_SOURCE).filter((a) => unique.has(a.id)).map(withImage)))
      .filter((a): a is Article & { image: string } => !!a);
  const [main, ...rest] = await Promise.all([primary, ...others].map(resolve));
  const items = interleave(main, rest, COUNT);
  const cells = gridLayout(items.length);
  const names = new Map(enabled.map((x) => [x.id, x.name]));
  const failed = [primary, ...others].filter((s) => !feeds.get(s.id)!.ok).length;

  if (!items.length) {
    return (
      <p className="border-y border-dashed border-border py-6 text-sm text-muted">
        {failed ? "Les sources d'actus ne répondent pas pour le moment." : "Aucun sujet illustré pour l'instant."}{" "}
        <Link href="/news" className="link-underline text-text">Voir toutes les news</Link>
      </p>
    );
  }

  return (
    <div>
      <AutoRefresh minutes={5} />
      <ol className="grid grid-cols-1 gap-x-2 gap-y-8 sm:grid-cols-2 lg:grid-cols-12 lg:gap-y-6">
        {items.map((it, i) => (
          <li key={it.id} className={`${items.length === 1 ? "sm:col-span-2" : ""} ${cells[i].span}`}>
            <HeadlineCard article={it} image={it.image} index={i} big={cells[i].big} small={cells[i].span === "lg:col-span-2"} sourceName={names.get(it.sourceId) ?? it.publisher} />
          </li>
        ))}
      </ol>
      <p className="mt-8 flex justify-end">
        <Link href="/news" className="label link-underline inline-flex items-center gap-1 text-muted hover:text-text">
          Toutes les news <ArrowUpRight className="size-3" aria-hidden />
        </Link>
      </p>
    </div>
  );
}

/** Squelette affiché pendant le chargement des flux. */
export function HeadlinesSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-12" aria-label="Chargement des actus">
      <div className="aspect-[16/10] max-h-[50vh] animate-pulse bg-surface-2 lg:col-span-6" />
      <div className="aspect-[16/10] max-h-[50vh] animate-pulse bg-surface-2 lg:col-span-6" />
    </div>
  );
}
