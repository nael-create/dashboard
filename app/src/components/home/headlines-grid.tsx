import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { readNewsConfig } from "@/lib/news-config";
import { dedupe, loadFeed, type Article } from "@/lib/rss";
import { HeadlineCard } from "./headline-card";
import { AutoRefresh } from "./auto-refresh";

const COUNT = 10;

/**
 * « À la une » : les grands sujets, dans l'ordre éditorial du flux FT International
 * (ordre du flux, pas l'ordre chronologique), entrecoupés de Reuters (2 FT, 1 Reuters…).
 * Utilise uniquement les fonctions existantes (cache des flux, dédoublonnage).
 */
export async function HeadlinesGrid() {
  const cfg = await readNewsConfig();
  const enabled = cfg.sources.filter((s) => s.enabled);
  const primary = enabled.find((s) => s.id === "ft-international") ?? enabled[0];
  const secondary = enabled.find((s) => s.id === "reuters") ?? enabled.find((s) => s !== primary);
  if (!primary) {
    return <p className="border-y border-dashed border-border py-6 text-sm text-muted">Aucune source d&apos;actus active. Ajoute-en depuis la page News.</p>;
  }
  const [p, s] = await Promise.all([loadFeed(primary), secondary ? loadFeed(secondary) : Promise.resolve(null)]);

  const a = [...p.items];
  const b = [...(s?.items ?? [])];
  const mixed: Article[] = [];
  while ((a.length || b.length) && mixed.length < COUNT * 2) {
    if (a.length) mixed.push(a.shift()!);
    if (a.length) mixed.push(a.shift()!);
    if (b.length) mixed.push(b.shift()!);
  }
  const items = dedupe(mixed).slice(0, COUNT);
  const names = new Map(enabled.map((x) => [x.id, x.name]));
  const colors = new Map(enabled.map((x) => [x.id, x.color]));
  const errors = [p, s].filter((f) => f && !f.ok);

  if (!items.length) {
    return (
      <p className="border-y border-dashed border-border py-6 text-sm text-muted">
        {errors.length ? "Les sources d'actus ne répondent pas pour le moment." : "Aucune actu pour l'instant."}
      </p>
    );
  }

  // Grille éditoriale : un grand sujet + un sujet vertical, puis des rangées de quatre.
  const layout = (i: number) =>
    i === 0 ? "lg:col-span-8" : i === 1 ? "lg:col-span-4" : "sm:col-span-1 lg:col-span-3";
  // Photos plus basses : le grand sujet et son voisin gardent la même hauteur (2/1 sur 8 colonnes = 1/1 sur 4).
  const ratio = (i: number) => (i === 0 ? "aspect-[16/9] lg:aspect-[2/1]" : i === 1 ? "aspect-[16/9] sm:aspect-[4/3] lg:aspect-square" : "aspect-[16/9] sm:aspect-[4/3]");

  return (
    <div>
      <AutoRefresh minutes={5} />
      <ol className="grid grid-cols-1 gap-x-2 gap-y-8 sm:grid-cols-2 lg:grid-cols-12">
        {items.map((it, i) => (
          <li key={it.id} className={`${i < 2 ? "sm:col-span-2" : ""} ${layout(i)}`}>
            <HeadlineCard
              article={it}
              index={i}
              big={i === 0}
              ratio={ratio(i)}
              sourceName={names.get(it.sourceId) ?? it.publisher}
              color={colors.get(it.sourceId) ?? "#888888"}
            />
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
      <div className="aspect-[2/1] animate-pulse bg-surface-2 lg:col-span-8" />
      <div className="aspect-square animate-pulse bg-surface-2 lg:col-span-4" />
    </div>
  );
}
