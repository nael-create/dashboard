import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

/**
 * Bloc de contenu « éditorial » : pas de boîte, un fil fin en haut et beaucoup d'air.
 * (Le nom Card est conservé pour ne rien changer aux pages existantes.)
 */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rise border-t border-text/80 pt-4 sm:pt-5 ${className}`}>{children}</section>;
}

/** En-tête de bloc : numéro facultatif (« 03. »), titre en minuscules, lien en petites capitales. */
export function CardHeader({
  title, icon: _icon, href, linkLabel = "Tout voir", aside, n,
}: { title: string; icon?: ReactNode; href?: string; linkLabel?: string; aside?: ReactNode; n?: string }) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <h2 className="flex items-baseline gap-3">
        {n && <span className="label text-muted">{n}.</span>}
        <span className="title-md lowercase">{title}</span>
      </h2>
      <div className="flex items-center gap-3 pt-1">
        {aside}
        {href && (
          <Link href={href} className="label link-underline inline-flex items-center gap-1 text-muted transition-colors hover:text-text">
            {linkLabel} <ArrowUpRight className="size-3" aria-hidden />
          </Link>
        )}
      </div>
    </header>
  );
}

/** État vide ou « bientôt disponible ». */
export function Empty({ children }: { children: ReactNode }) {
  return <div className="border-y border-dashed border-border py-6 text-sm text-muted">{children}</div>;
}

/** En-tête de page : très grand titre en minuscules, sous-titre discret, actions à droite. */
export function PageHeader({ title, subtitle, children, n }: { title: string; subtitle?: ReactNode; children?: ReactNode; n?: string }) {
  return (
    <div className="rise mb-10 grid gap-6 sm:mb-14 lg:grid-cols-12 lg:items-end">
      <div className="lg:col-span-8">
        {n && <p className="label mb-3 text-muted">{n}</p>}
        <h1 className="display">{title}</h1>
        {subtitle && <p className="mt-4 max-w-2xl text-[15px] text-muted">{subtitle}</p>}
      </div>
      {children && <div className="flex lg:col-span-4 lg:justify-end">{children}</div>}
    </div>
  );
}

/** Section numérotée de l'accueil (« 01. agenda »). */
export function Section({ n, title, aside, children, className = "" }: { n: string; title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rise border-t border-text/80 pt-4 sm:pt-5 ${className}`} aria-label={title}>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
        <h2 className="flex items-baseline gap-3 sm:gap-4">
          <span className="label text-muted">{n}.</span>
          <span className="section-title">{title}</span>
        </h2>
        {aside}
      </header>
      {children}
    </section>
  );
}
