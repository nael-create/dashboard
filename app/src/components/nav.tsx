"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** Pages de l'en-tête (ordre et libellés de la refonte). */
export const HEADER_ITEMS: { href: string; label: string }[] = [
  { href: "/", label: "Accueil" },
  { href: "/projets", label: "Projets" },
  { href: "/notions", label: "Notions" },
  { href: "/memo", label: "Mémo" },
  { href: "/newsletters", label: "Newsletters" },
  { href: "/news", label: "News" },
  { href: "/favoris", label: "Favoris" },
  { href: "/revue", label: "Revue" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Heure locale (fuseau de l'ordinateur), mise à jour chaque minute. */
function useLocalTime() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  if (!now) return { hh: "--", mm: "--", zone: "" };
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone?.split("/").pop()?.replace(/_/g, " ") ?? "";
  return { hh: String(now.getHours()).padStart(2, "0"), mm: String(now.getMinutes()).padStart(2, "0"), zone };
}

/**
 * En-tête éditorial : nom, navigation en petites capitales, heure locale, actions discrètes.
 * Sur téléphone : « Menu » ouvre un menu plein écran en très grands caractères.
 */
export function SiteHeader({ title, actions, mobileExtras }: { title: string; actions: ReactNode; mobileExtras: ReactNode }) {
  const pathname = usePathname();
  const { hh, mm, zone } = useLocalTime();
  const [menu, setMenu] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMenu(false), [pathname]);
  useEffect(() => {
    if (!menu) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menu]);

  const time = (
    <span className="tabular-nums">
      {hh}<span className="mx-1 animate-pulse motion-reduce:animate-none">:</span>{mm}
    </span>
  );

  return (
    <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur-md print:hidden">
      <div className="mx-auto grid max-w-[1600px] grid-cols-12 items-start gap-x-4 px-4 pb-3 pt-4 text-[11px] uppercase leading-[1.35] tracking-[0.04em] sm:px-6 sm:pt-5">
        {/* Nom */}
        <Link href="/" className="col-span-5 sm:col-span-4 lg:col-span-3">
          <span className="block font-medium">{title}</span>
          <span className="block text-muted">Tableau de bord</span>
        </Link>

        {/* Navigation (grands écrans) */}
        <nav aria-label="Navigation principale" className="hidden lg:col-span-4 lg:block">
          <ul className="grid grid-flow-col grid-cols-2 grid-rows-4 gap-x-6">
            {HEADER_ITEMS.map(({ href, label }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`group inline-flex items-center gap-1.5 transition-colors ${active ? "text-text" : "text-muted hover:text-text"}`}
                  >
                    <span className={`size-1.5 rounded-full transition-colors ${active ? "bg-accent" : "bg-transparent group-hover:bg-text/40"}`} aria-hidden />
                    <span className="link-underline">{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Heure locale */}
        <div className="col-span-3 hidden sm:block lg:col-span-2">
          <span className="block text-muted">Heure locale{zone ? ` — ${zone}` : ""}</span>
          <span className="block">{time}</span>
        </div>

        {/* Actions (Sauvegarder, recherche, ajout rapide, thème) */}
        <div className="col-span-7 flex items-start justify-end gap-1 sm:col-span-5 lg:col-span-3">
          {actions}
          <button
            type="button"
            onClick={() => setMenu(true)}
            aria-expanded={menu}
            aria-controls="menu-plein-ecran"
            className="ml-1 grid h-9 place-items-center rounded-full border border-text px-3 transition-colors hover:bg-text hover:text-bg lg:hidden"
          >
            Menu
          </button>
        </div>
      </div>

      {/* Menu plein écran (téléphone, tablette) — rendu hors de l'en-tête (son flou enfermerait le menu). */}
      {menu && createPortal(
        <div id="menu-plein-ecran" role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-50 flex flex-col bg-bg px-4 pb-8 pt-4 sm:px-6 lg:hidden">
          <div className="flex items-start justify-between text-[11px] uppercase tracking-[0.04em]">
            <span>
              <span className="block font-medium">{title}</span>
              <span className="block text-muted">Heure locale — {time}</span>
            </span>
            <button ref={closeRef} type="button" onClick={() => setMenu(false)} aria-label="Fermer le menu"
              className="grid size-11 place-items-center rounded-full border border-text transition-colors hover:bg-text hover:text-bg">
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <nav aria-label="Navigation principale" className="mt-10 flex-1 overflow-y-auto">
            <ol className="space-y-1">
              {HEADER_ITEMS.map(({ href, label }, i) => {
                const active = isActive(pathname, href);
                return (
                  <li key={href} className="rise" style={{ animationDelay: `${i * 40}ms` }}>
                    <Link href={href} aria-current={active ? "page" : undefined} className="flex items-baseline gap-4 py-1">
                      <span className="label w-6 text-muted">{String(i + 1).padStart(2, "0")}.</span>
                      <span className={`text-[clamp(2.5rem,12vw,4rem)] font-light lowercase leading-[1] tracking-[-0.04em] ${active ? "text-accent-text" : ""}`}>{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </nav>
          <div className="flex items-center gap-2 border-t border-border pt-4">{mobileExtras}</div>
        </div>,
        document.body,
      )}
    </header>
  );
}
