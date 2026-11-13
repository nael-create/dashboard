"use client";

import { useEffect, useState } from "react";
import { StarButton } from "@/components/favorites/favorites-context";
import { relativeTime } from "@/lib/relative-time";
import type { Article } from "@/lib/rss";

/**
 * Sujet de la grille « à la une ».
 * - Avec image (flux ou og:image déjà autorisée) : image bord franc, titre dessous.
 * - Sans image (ex. Reuters via Google News) : carte typographique volontaire, grand titre sur aplat.
 */
export function HeadlineCard({
  article, index, big, ratio, sourceName, color,
}: { article: Article; index: number; big: boolean; ratio: string; sourceName: string; color: string }) {
  const [src, setSrc] = useState<string | null>(article.thumbnail);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    if (article.thumbnail || /news\.google\.com/.test(article.link)) return;
    let alive = true;
    fetch(`/api/news/thumb?id=${encodeURIComponent(article.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && j?.image && setSrc(j.image))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [article]);

  const hasImage = !!src && !broken;
  // Cartes typographiques : trois traitements en alternance (teinté, inversé, neutre) pour une grille composée.
  const variant = index % 3;
  const typoStyle =
    variant === 1
      ? { background: "var(--text)", color: "var(--bg)" }
      : variant === 2
        ? { background: "var(--surface-2)" }
        : { background: `color-mix(in oklab, ${color} 22%, var(--surface-2))` };
  const n = String(index + 1).padStart(2, "0");
  const meta = (
    <p className="label mt-3 flex items-center gap-2 text-muted">
      <span>{n}.</span>
      <span className="truncate">{sourceName}</span>
      {article.date && (
        <>
          <span aria-hidden>·</span>
          <time dateTime={article.date} className="shrink-0">{relativeTime(article.date)}</time>
        </>
      )}
      <span className="ml-auto -my-2 -mr-2 normal-case">
        <StarButton type="article" refId={article.link} title={article.title} source={article.publisher} published={article.date?.slice(0, 10) ?? null} />
      </span>
    </p>
  );

  return (
    <article className="group">
      <a href={article.link} target="_blank" rel="noopener noreferrer" className="block focus-visible:outline-offset-4">
        <div
          className={`relative overflow-hidden ${ratio}`}
          style={hasImage ? undefined : typoStyle}
        >
          {hasImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src!}
              alt=""
              loading={index < 2 ? "eager" : "lazy"}
              referrerPolicy="no-referrer"
              onError={() => setBroken(true)}
              className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-[var(--ease)] group-hover:scale-[1.03]"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col justify-between p-5 sm:p-6">
              <span className="label opacity-70">{sourceName}</span>
              <p
                className={`font-light leading-[1.02] tracking-[-0.035em] ${
                  big ? "text-[clamp(1.9rem,4vw,3.6rem)] line-clamp-5" : "text-[clamp(1.5rem,2.1vw,1.9rem)] line-clamp-6"
                } transition-transform duration-700 ease-[var(--ease)] group-hover:-translate-y-1`}
              >
                {article.title}
              </p>
            </div>
          )}
        </div>
        {hasImage && (
          <h3 className={`mt-3 font-normal leading-snug tracking-[-0.01em] ${big ? "text-[clamp(1.25rem,2vw,1.75rem)] font-light tracking-[-0.025em]" : "text-[15px]"}`}>
            <span className="link-underline">{article.title}</span>
          </h3>
        )}
      </a>
      {meta}
    </article>
  );
}
