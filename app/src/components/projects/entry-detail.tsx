import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { EntryWithBody } from "@/lib/content";
import { DeadlineText, PriorityBadge, StatusBadge, Value } from "@/components/ui/badges";
import { formatISODate } from "@/lib/dates";

/** Affiche un README : métadonnées du frontmatter + contenu Markdown (HTML brut ignoré). */
export function EntryDetail({ entry }: { entry: EntryWithBody }) {
  const isProject = entry.kind === "project";
  const folder = `${isProject ? "projects" : "areas"}/${entry.slug}/README.md`;
  // Le titre « # … » en tête du README fait doublon avec l'en-tête de la page.
  const body = entry.body.replace(/^\s*#\s+[^\n]*\n/, "");

  const meta: [string, React.ReactNode][] = [
    ["Statut", <StatusBadge key="s" status={entry.status} />],
    ["Priorité", <PriorityBadge key="p" priority={entry.priority} />],
    ...(isProject
      ? ([
          ["Prochaine action", <Value key="n" text={entry.nextAction} />],
          ["Deadline", <DeadlineText key="d" deadline={entry.deadline} />],
        ] as [string, React.ReactNode][])
      : []),
    ["Créé le", formatISODate(entry.created) || "—"],
    ["Mis à jour le", formatISODate(entry.updated) || "—"],
  ];

  return (
    <article>
      <Link href="/projets" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-accent-text">
        <ArrowLeft className="size-4" aria-hidden /> Projets et domaines
      </Link>
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0 rounded-2xl border border-border bg-surface p-5 sm:p-8">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{isProject ? "Projet" : "Domaine"}</p>
          <h1 className="mb-6 text-2xl font-semibold tracking-tight sm:text-3xl">{entry.title}</h1>
          {entry.error && (
            <p className="mb-6 flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {entry.error}
            </p>
          )}
          <div className="md">
            <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>{body}</ReactMarkdown>
          </div>
        </div>
        <aside className="h-fit rounded-2xl border border-border bg-surface p-5 lg:sticky lg:top-20">
          <dl className="space-y-3 text-sm">
            {meta.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 border-t border-border pt-4 text-xs text-muted">
            Source : <code className="break-all">{folder}</code>
          </p>
        </aside>
      </div>
    </article>
  );
}
