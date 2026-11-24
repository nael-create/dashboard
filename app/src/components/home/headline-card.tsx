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
  article, image, index, big, sourceName,
}: { article: Article; image: string; index: number; big: boolean; sourceName: string }) {
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
        <h3 className={`mt-3 leading-snug ${big ? "text-[clamp(1.1rem,1.6vw,1.4rem)] font-light tracking-[-0.025em]" : "text-[15px] font-normal tracking-[-0.01em]"}`}>
          <span className="link-underline">{article.title}</span>
        </h3>
      </a>
      <p className="label mt-3 flex items-center gap-2 text-muted">
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
