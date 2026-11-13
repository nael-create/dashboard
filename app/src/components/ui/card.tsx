import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow sm:p-6 ${className}`}>
      {children}
    </section>
  );
}

export function CardHeader({
  title, icon, href, linkLabel = "Tout voir", aside,
}: { title: string; icon?: ReactNode; href?: string; linkLabel?: string; aside?: ReactNode }) {
  return (
    <header className="mb-4 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
        {icon && <span className="text-accent-text">{icon}</span>}
        {title}
      </h2>
      <div className="flex items-center gap-2">
        {aside}
        {href && (
          <Link href={href} className="group inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-accent-text">
            {linkLabel}
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        )}
      </div>
    </header>
  );
}

/** État vide ou « bientôt disponible ». */
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
