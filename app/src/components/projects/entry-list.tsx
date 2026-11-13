import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { Entry } from "@/lib/content";
import { DeadlineText, PriorityBadge, StatusBadge, Value } from "@/components/ui/badges";
import { formatISODate } from "@/lib/dates";

export function EntryList({ entries, hrefBase }: { entries: Entry[]; hrefBase: string }) {
  const isProject = hrefBase === "/projets";
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {entries.map((e) => (
        <li key={e.slug}>
          <Link
            href={`${hrefBase}/${e.slug}`}
            className="group flex h-full flex-col gap-3 rounded-2xl border border-border bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-md sm:p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-medium leading-snug group-hover:text-accent-text">{e.title}</h3>
              <div className="flex shrink-0 gap-1.5">
                <PriorityBadge priority={e.priority} />
                <StatusBadge status={e.status} />
              </div>
            </div>
            {isProject && (
              <p className="text-sm text-muted">
                <span className="text-text/80">Prochaine action : </span>
                <Value text={e.nextAction} />
              </p>
            )}
            {e.error && (
              <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                {e.error}
              </p>
            )}
            <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              {isProject && <span>Deadline : <DeadlineText deadline={e.deadline} /></span>}
              <span>Mis à jour : {formatISODate(e.updated) || "—"}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
