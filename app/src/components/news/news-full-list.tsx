"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Notice } from "@/components/ui/notice";
import { ArticleRow, Favicon } from "./news-card";
import { useNews } from "./use-news";

/** Liste complète des articles d'un widget (source ou catégorie). */
export function NewsFullList({ widgetKey }: { widgetKey: string }) {
  const { data, error, isNew } = useNews();
  const w = data?.widgets.find((x) => x.key === widgetKey);
  return (
    <div>
      <Link href="/news" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-accent-text">
        <ArrowLeft className="size-4" aria-hidden /> Actus
      </Link>
      {error && <Notice>{error}</Notice>}
      {!data ? (
        <div className="h-96 animate-pulse rounded-[28px] bg-surface-2" />
      ) : !w ? (
        <Notice>Ce widget n&apos;existe plus (source retirée ou désactivée).</Notice>
      ) : (
        <section className="rounded-[28px] border border-border bg-surface p-5 sm:p-7">
          <header className="mb-4 flex items-center justify-between gap-3">
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: w.color }}>{w.title}</h1>
            <Favicon domain={w.domain} color={w.color} label={w.title} />
          </header>
          {w.items.length ? (
            <ul className="space-y-1">{w.items.map((a) => <ArticleRow key={a.id} a={a} isNew={isNew(a)} />)}</ul>
          ) : (
            <p className="text-sm text-muted">Aucun article pour l&apos;instant.</p>
          )}
        </section>
      )}
    </div>
  );
}
