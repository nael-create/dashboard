"use client";

import { Newspaper } from "lucide-react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ArticleRow } from "./news-card";
import { useNews } from "./use-news";

/** « À la une » sur l'accueil : les 5 derniers titres, toutes sources visibles confondues. */
export function HeadlinesWidget() {
  const { data, error, isNew } = useNews();
  return (
    <section className="flex h-full flex-col rounded-[28px] border border-border bg-surface p-5 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <Newspaper className="size-4 text-accent-text" aria-hidden /> À la une
        </h2>
        <Link href="/news" className="group inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-accent-text">
          Tout voir <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </header>
      {!data ? (
        <div className="space-y-3" aria-label="Chargement des actus">
          {[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-xl bg-surface-2" />)}
          {error && <p className="text-sm text-muted">{error}</p>}
        </div>
      ) : data.latest.length === 0 ? (
        <p className="py-4 text-sm text-muted">
          {data.errors.length ? "Les sources d'actus ne répondent pas pour le moment." : "Aucune actu pour l'instant."}
        </p>
      ) : (
        <ul className="space-y-0.5">
          {data.latest.map((a) => <ArticleRow key={a.id} a={a} isNew={isNew(a)} />)}
        </ul>
      )}
    </section>
  );
}
