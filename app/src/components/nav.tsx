"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NAV_ITEMS } from "@/lib/navigation";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Navigation horizontale (grands écrans). */
export function TopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation principale" className="hidden items-center gap-0.5 lg:flex">
      {NAV_ITEMS.map(({ href, label }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
              active ? "bg-accent-soft font-medium text-accent-text" : "text-muted hover:bg-surface-2 hover:text-text"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Barre d'onglets en bas de l'écran (téléphone, tablette) ; les pages secondaires sont dans « Plus ». */
export function BottomNav() {
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  const primary = NAV_ITEMS.filter((i) => i.mobile);
  const secondary = NAV_ITEMS.filter((i) => !i.mobile);
  const secondaryActive = secondary.some((i) => isActive(pathname, i.href));

  useEffect(() => setMore(false), [pathname]);
  useEffect(() => {
    if (!more) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setMore(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [more]);

  const tab = (active: boolean) =>
    `flex w-full flex-col items-center gap-0.5 py-2 text-[11px] transition-colors ${active ? "text-accent-text" : "text-muted"}`;

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden"
    >
      <ul className="flex">
        {primary.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link href={href} aria-current={active ? "page" : undefined} className={tab(active)}>
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
        <li className="relative flex-1" ref={ref}>
          <button type="button" aria-expanded={more} onClick={() => setMore(!more)} className={tab(secondaryActive)}>
            <MoreHorizontal className="size-5" aria-hidden />
            Plus
          </button>
          {more && (
            <ul className="absolute bottom-full right-2 mb-2 w-48 overflow-hidden rounded-2xl border border-border bg-surface py-1 shadow-xl">
              {secondary.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={isActive(pathname, href) ? "page" : undefined}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-surface-2 ${
                      isActive(pathname, href) ? "text-accent-text" : ""
                    }`}
                  >
                    <Icon className="size-4" aria-hidden /> {label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </li>
      </ul>
    </nav>
  );
}
