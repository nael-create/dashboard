"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { relativeTime } from "@/lib/relative-time";
import type { Article } from "./use-news";
import { StarButton } from "@/components/favorites/favorites-context";

/** Favicon du site, avec repli sur l'initiale colorée si elle ne se charge pas. */
export function Favicon({ domain, color, label }: { domain: string; color: string; label: string }) {
  const [failed, setFailed] = useState(!domain);
  if (failed) {
    return (
      <span className="grid size-6 shrink-0 place-items-center rounded-md text-[11px] font-bold text-white" style={{ background: color }} aria-hidden>
        {label.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://${domain}/favicon.ico`}
      alt=""
      width={24}
      height={24}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="size-6 shrink-0 rounded-md bg-white object-contain p-0.5"
    />
  );
}

/** Vignette : celle du flux, sinon og:image demandée au serveur (une fois par article), sinon rien. */
function Thumb({ article }: { article: Article }) {
  const [src, setSrc] = useState<string | null>(article.thumbnail);
  const [hidden, setHidden] = useState(false);
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
  if (!src || hidden) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setHidden(true)}
      className="size-16 shrink-0 rounded-xl bg-surface-2 object-cover"
    />
  );
}

export function ArticleRow({
  a, isNew, showPublisher = true, actions,
}: { a: Article; isNew: boolean; showPublisher?: boolean; actions?: ReactNode }) {
  return (
    <li className="group -mx-2 flex items-start gap-1">
      <a
        href={a.link}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 flex-1 items-start gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-2"
      >
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 leading-snug">{a.title}</span>
          <span className="mt-1 flex items-center gap-1.5 text-xs text-muted">
            {isNew && <span className="rounded-full bg-accent px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-white">Nouveau</span>}
            {a.date && <time dateTime={a.date} suppressHydrationWarning>{relativeTime(a.date)}</time>}
            {showPublisher && a.publisher && <><span aria-hidden>·</span><span className="truncate">{a.publisher}</span></>}
          </span>
        </span>
        <Thumb article={a} />
      </a>
      <StarButton type="article" refId={a.link} title={a.title} source={a.publisher} published={a.date?.slice(0, 10) ?? null} className="mt-1.5" />
      {actions}
    </li>
  );
}

/** Carte « widget » inspirée d'iOS : grands arrondis, nom de la source en gras, favicon à droite. */
export function NewsCard({
  title, href, domain, color, items, isNew, error, children, footer, renderActions,
}: {
  title: string;
  href?: string;
  domain: string;
  color: string;
  items: Article[];
  isNew: (a: Article) => boolean;
  error?: string;
  children?: ReactNode;
  footer?: ReactNode;
  renderActions?: (a: Article) => ReactNode;
}) {
  return (
    <section className="rise flex h-full flex-col border-t border-text/80 pt-4">
      <header className="mb-3 flex items-center justify-between gap-3">
        {href ? (
          <Link href={href} className="flex min-w-0 items-center gap-2 title-md lowercase">
            <span className="size-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
            <span className="link-underline truncate">{title}</span>
          </Link>
        ) : (
          <h2 className="flex min-w-0 items-center gap-2 title-md lowercase">
            <span className="size-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
            <span className="truncate">{title}</span>
          </h2>
        )}
        <div className="flex shrink-0 items-center gap-1">
          {children}
          <Favicon domain={domain} color={color} label={title} />
        </div>
      </header>
      {error && <p className="mb-2 bg-amber-500/10 px-2 py-1 text-xs text-amber-800 dark:text-amber-300">{error}</p>}
      {items.length ? (
        <ul className="flex-1 divide-y divide-border">
          {items.map((a) => <ArticleRow key={a.id} a={a} isNew={isNew(a)} actions={renderActions?.(a)} />)}
        </ul>
      ) : (
        <p className="flex-1 py-4 text-sm text-muted">{error ? "Aucun article disponible." : "Aucun article pour l'instant."}</p>
      )}
      {footer}
    </section>
  );
}
