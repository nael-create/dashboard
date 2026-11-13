import { CalendarDays, FolderKanban, Mail, StickyNote, Target } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader, Empty } from "@/components/ui/card";
import { DeadlineText, PriorityBadge, Value } from "@/components/ui/badges";
import { countInbox, getWeeklyFocus, listProjects } from "@/lib/content";
import { formatLongToday } from "@/lib/dates";

/* Chaque widget est un composant serveur autonome : il lit lui-même ses données. */

export function CalendarWidget() {
  return (
    <Card className="min-h-[340px]">
      <CardHeader title="Calendrier" icon={<CalendarDays className="size-4" aria-hidden />} />
      <p className="mb-4 text-2xl font-semibold tracking-tight">{formatLongToday()}</p>
      <Empty>
        Le calendrier (vues jour / semaine / mois et abonnements ICS) arrive à la phase 3.
      </Empty>
    </Card>
  );
}

export async function FocusWidget() {
  const focus = await getWeeklyFocus();
  return (
    <Card className="h-full">
      <CardHeader
        title="Focus de la semaine"
        icon={<Target className="size-4" aria-hidden />}
        aside={focus.review && <span className="text-xs text-muted">d&apos;après {focus.review}</span>}
      />
      {focus.items.length === 0 ? (
        <p className="italic text-muted">TODO: fill in</p>
      ) : (
        <ol className="space-y-3">
          {focus.items.map((item, i) => (
            <li key={i} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent-text">
                {i + 1}
              </span>
              <span className="pt-0.5"><Value text={item} /></span>
            </li>
          ))}
        </ol>
      )}
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

export function MemoWidget() {
  return (
    <Card className="h-full">
      <CardHeader title="À retenir" icon={<StickyNote className="size-4" aria-hidden />} href="/memo" />
      <Empty>Les choses à retenir (MEMO.md) arrivent à la phase 4.</Empty>
    </Card>
  );
}
