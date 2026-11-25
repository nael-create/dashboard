import Link from "next/link";
import { StarButton } from "@/components/favorites/favorites-context";
import { deadlineChip, taskDateChip } from "@/lib/fr-dates";
import type { ListedEntry } from "@/lib/project-list";

/**
 * Carte d'un projet (ou domaine) dans les listes : titre, deadline lisible (couleur d'accent si en
 * retard), avancement « 3 / 7 », prochaine tâche, priorité.
 */
export function EntryCard({ e, today }: { e: ListedEntry; today: string }) {
  const href = e.kind === "project" ? `/projets/${e.slug}` : `/domaines/${e.slug}`;
  const chip = e.deadline ? deadlineChip(e.deadline, today) : null;
  const next = e.stats.nextTask;
  const { done, total, pct } = e.stats.progress;
  return (
    <li className={`group relative flex flex-col border-t border-text/80 pt-4 ${e.archived ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <Link href={href} className="min-w-0 text-[clamp(1.15rem,1.6vw,1.4rem)] font-light leading-tight tracking-[-0.02em] after:absolute after:inset-0 hover:text-accent-text">
          {e.title}
        </Link>
        {e.priority && (
          <span className={`relative shrink-0 rounded-full border px-2 py-0.5 text-[11px] tabular-nums ${e.priority === "P1" ? "border-accent bg-accent text-white" : "border-border text-muted"}`}>
            {e.priority}
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
        {chip && (
          <span className={`rounded-full border px-2.5 py-0.5 ${chip.tone === "overdue" ? "border-accent bg-accent text-white" : chip.tone === "soon" ? "border-accent text-accent-text" : "border-border text-muted"}`}>
            {chip.text}
          </span>
        )}
        {e.status === "idea" && <span className="label text-muted">idée</span>}
        {e.status === "paused" && <span className="label text-muted">en pause</span>}
        {e.archived && <span className="label text-muted">{e.status === "dropped" ? "abandonné" : "terminé"}</span>}
      </div>
      <div className="mt-3">
        <div className="flex items-baseline justify-between text-[12px] text-muted">
          <span className="tabular-nums">{total ? `${done} / ${total}` : "aucune tâche"}</span>
        </div>
        <span className="mt-1 block h-0.5 bg-border" aria-hidden><span className="block h-0.5 bg-accent" style={{ width: `${pct ?? 0}%` }} /></span>
      </div>
      <p className="mt-2 truncate text-[13px] text-muted">
        {next ? <>→ {next.title}{next.date ? <> · <span className={next.date < today ? "text-accent-text" : ""}>{taskDateChip(next.date, today).text}</span></> : null}</> : e.archived ? "" : "pas de tâche à faire"}
      </p>
      {e.kind === "project" && !e.archived && (
        <span className="absolute right-0 top-12 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <StarButton type="project" refId={`project:${e.slug}`} title={e.title} />
        </span>
      )}
    </li>
  );
}
