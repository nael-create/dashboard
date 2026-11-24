"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BROKEN_HREF, headings, linkify, type LinkContext } from "@/lib/wiki-links";

/** Image relative d'une page de docs (« ../assets/x.png ») → adresse servie par l'app. */
export function assetSrc(project: string, src: string | undefined): string | undefined {
  if (!src) return undefined;
  const m = src.match(/^(?:\.\.\/)?assets\/([a-z0-9][a-z0-9._-]*)$/i);
  if (m) return `/api/projects/${project}/assets/${m[1]}`;
  // Images distantes ou autres chemins : non chargées (rien ne part vers l'extérieur sans le vouloir).
  return undefined;
}

/**
 * Rendu d'une page de docs : liens [[…]] (cassés = visibles, barrés en pointillés), ancres des titres
 * (pour le sommaire), images du projet. Pas de HTML brut (skipHtml).
 */
export function DocMarkdown({ text, ctx }: { text: string; ctx: LinkContext }) {
  // Identifiants stables (même calcul que le sommaire), retrouvés par numéro de ligne.
  const md = linkify(text, ctx);
  const ids = new Map(headings(text).map((h) => [h.line, h.id]));
  const heading = (Tag: "h2" | "h3") =>
    function H({ children, node }: { children?: React.ReactNode; node?: { position?: { start: { line: number } } } }) {
      return <Tag id={ids.get(node?.position?.start.line ?? -1)} className="scroll-mt-24">{children}</Tag>;
    };
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      components={{
        h2: heading("h2"),
        h3: heading("h3"),
        a: ({ href, children }) => {
          if (href === BROKEN_HREF) {
            return <span className="cursor-help text-rose-700 underline decoration-dotted underline-offset-4 dark:text-rose-400" title="Lien interne introuvable (page ou projet inexistant)">{children}</span>;
          }
          if (href?.startsWith("/")) return <Link href={href} className="link-underline text-accent-text">{children}</Link>;
          return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
        },
        img: ({ src, alt }) => {
          const url = assetSrc(ctx.project, typeof src === "string" ? src : undefined);
          // eslint-disable-next-line @next/next/no-img-element
          return url ? <img src={url} alt={alt ?? ""} loading="lazy" className="my-4 max-h-[70vh] max-w-full border border-border" /> : <span className="text-xs text-muted">[image non affichée : {alt || (typeof src === "string" ? src : "")}]</span>;
        },
      }}
    >
      {md}
    </ReactMarkdown>
  );
}
