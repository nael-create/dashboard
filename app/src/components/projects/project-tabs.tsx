"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const PROJECT_TABS = [
  { href: "/projets/aujourdhui", label: "aujourd'hui" },
  { href: "/projets/liste", label: "projets" },
  { href: "/projets/domaines", label: "domaines" },
];

/** Onglets de la section « projets » : aujourd'hui, projets (/projets/liste), domaines. */
export function ProjectTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Onglets projets" className="-mx-4 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
      <ul className="flex gap-6 sm:gap-8">
        {PROJECT_TABS.map(({ href, label }, i) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`-mb-px flex items-baseline gap-2 whitespace-nowrap border-b-2 pb-3 text-[15px] lowercase transition-colors ${
                  active ? "border-text text-text" : "border-transparent text-muted hover:text-text"
                }`}
              >
                <span className="label text-[10px] text-muted">{String(i + 1).padStart(2, "0")}</span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
