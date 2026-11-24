"use client";

import { useState } from "react";
import { StarButton } from "@/components/favorites/favorites-context";
import { relativeTime } from "@/lib/relative-time";
import type { Article } from "@/lib/rss";

/**
 * Sujet de la grille « à la une » : toujours une image (choisie côté serveur : flux, sinon og:image),
 * bord franc, titre dessous. Première rangée : grande image, hauteur plafonnée (≈ moitié de l'écran).
 * Une image qui ne se charge pas retire simplement le sujet (jamais d'image cassée ni de carte texte).
 */
export function HeadlineCard({
  article, image, index, big, small = false, sourceName,
}: { article: Article; image: string; index: number; big: boolean; small?: boolean; sourceName: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  const n = String(index + 1).padStart(2, "0");

  return (
    <article className="group">
      <a href={article.link} target="_blank" rel="noopener noreferrer" className="block focus-visible:outline-offset-4">
        <div className={`relative w-full overflow-hidden bg-surface-2 ${big ? "aspect-[16/10] max-h-[50vh] min-h-56" : "aspect-[4/3]"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt=""
            loading={index < 2 ? "eager" : "lazy"}
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
            className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-[var(--ease)] group-hover:scale-[1.03]"
          />
        </div>
        <h3 className={`leading-snug ${big ? "mt-3 text-[clamp(1.1rem,1.6vw,1.4rem)] font-light tracking-[-0.025em]" : small ? "mt-2 line-clamp-3 text-[14px] font-normal tracking-[-0.01em] lg:text-[13px]" : "mt-3 text-[15px] font-normal tracking-[-0.01em]"}`}>
          <span className="link-underline">{article.title}</span>
        </h3>
      </a>
      <p className={`label flex items-center gap-2 text-muted ${small ? "mt-2 lg:gap-1.5 lg:text-[10px]" : "mt-3"}`}>
        <span>{n}.</span>
        <span className="truncate">{sourceName}</span>
        {article.date && (
          <>
            <span aria-hidden>·</span>
            <time dateTime={article.date} className="shrink-0" suppressHydrationWarning>{relativeTime(article.date)}</time>
          </>
        )}
        <span className="ml-auto -my-2 -mr-2 normal-case">
          <StarButton type="article" refId={article.link} title={article.title} source={article.publisher} published={article.date?.slice(0, 10) ?? null} />
        </span>
      </p>
    </article>
  );
}
