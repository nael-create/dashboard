import { FolderKanban, Mail, Newspaper, StickyNote } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader, Empty } from "@/components/ui/card";
import { DeadlineText, PriorityBadge, Value } from "@/components/ui/badges";
import { countInbox, listProjects } from "@/lib/content";
import { readMemo } from "@/lib/memo";
import { Pin } from "lucide-react";

/* Chaque widget est un composant serveur autonome : il lit lui-même ses données. */

/** Emplacement réservé à la phase 6 (actus RSS). La phase 6 DOIT remplir ce widget, pas en ajouter un autre. */
export function NewsWidget() {
  return (
    <Card className="h-full">
      <CardHeader title="À la une" icon={<Newspaper className="size-4" aria-hidden />} />
      <Empty>Les actus arrivent bientôt.</Empty>
    </Card>
  );
}

export async function ActiveProjectsWidget() {
  const [projects, inbox] = await Promise.all([listProjects(), countInbox()]);
  const active = projects.filter((p) => p.status === "active");
  return (
    <Card className="h-full">
      <CardHeader
        title="Projets actifs"
        icon={<FolderKanban className="size-4" aria-hidden />}
        href="/projets"
        aside={
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted" title="Éléments non traités dans INBOX.md">
            Inbox : {inbox}
          </span>
        }
      />
      {active.length === 0 ? (
        <Empty>Aucun projet actif pour l&apos;instant.</Empty>
      ) : (
        <ul className="-mx-2 divide-y divide-border">
          {active.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/projets/${p.slug}`}
                className="flex flex-col gap-1 rounded-xl px-2 py-3 transition-colors hover:bg-surface-2 sm:flex-row sm:items-center sm:gap-4"
              >
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <PriorityBadge priority={p.priority} />
                  <span className="truncate font-medium">{p.title}</span>
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-muted"><Value text={p.nextAction} /></span>
                <span className="text-sm sm:w-28 sm:text-right"><DeadlineText deadline={p.deadline} /></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function NewslettersWidget() {
  return (
    <Card className="h-full">
      <CardHeader title="Dernières newsletters" icon={<Mail className="size-4" aria-hidden />} href="/newsletters" />
      <Empty>La connexion Outlook arrive à la phase 5.</Empty>
    </Card>
  );
}

export async function MemoWidget() {
  const { entries } = await readMemo();
  const pinned = entries.filter((e) => e.pinned).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  return (
    <Card className="h-full">
      <CardHeader title="À retenir" icon={<StickyNote className="size-4" aria-hidden />} href="/memo" />
      {pinned.length === 0 ? (
        <Empty>Aucun mémo épinglé. Épingle un mémo pour le retrouver ici.</Empty>
      ) : (
        <ul className="space-y-2.5">
          {pinned.map((e) => (
            <li key={e.key} className="flex gap-2.5">
              <Pin className="mt-1 size-3.5 shrink-0 text-accent-text" aria-hidden />
              <div className="min-w-0">
                <p className="truncate font-medium">{e.title}</p>
                {e.text && <p className="line-clamp-2 text-sm text-muted">{e.text.replace(/[#*_>`[\]]/g, "")}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
