import Link from "next/link";

export interface Chip { value: string; label: string; count?: number }

/** Filtres sous forme de liens (fonctionnent sans JavaScript, et l'URL reste partageable). */
export function FilterChips({
  label, param, chips, current, otherParams,
}: { label: string; param: string; chips: Chip[]; current: string; otherParams: Record<string, string> }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-20 shrink-0 text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      {chips.map((c) => {
        const params = new URLSearchParams(otherParams);
        if (c.value !== "all") params.set(param, c.value);
        const qs = params.toString();
        const active = current === c.value;
        return (
          <Link
            key={c.value}
            href={qs ? `/projets?${qs}` : "/projets"}
            scroll={false}
            aria-current={active ? "true" : undefined}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              active
                ? "border-transparent bg-accent text-white"
                : "border-border text-muted hover:border-accent hover:text-text"
            }`}
          >
            {c.label}
            {c.count !== undefined && <span className="ml-1.5 opacity-70">{c.count}</span>}
          </Link>
        );
      })}
    </div>
  );
}
