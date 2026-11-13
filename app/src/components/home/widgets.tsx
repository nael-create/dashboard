import Link from "next/link";
import { Card, CardHeader, Empty } from "@/components/ui/card";
import { DeadlineText, Value } from "@/components/ui/badges";
import { countInbox, listProjects } from "@/lib/content";
import { readMemo } from "@/lib/memo";
import { listNewsletters, OutlookError, type NewsletterSummary } from "@/lib/outlook";
import { relativeTime } from "@/lib/relative-time";
import { OutlookState } from "@/components/newsletters/outlook-state";
import { HeadlinesGrid } from "./headlines-grid";

/* Chaque bloc est un composant serveur autonome : il lit lui-même ses données. */

/** « À la une » : grille d'images éditoriale, juste sous le calendrier. */
export function NewsWidget() {
  return <HeadlinesGrid />;
}

const num = (i: number) => `${String(i + 1).padStart(2, "0")}.`;

export async function ActiveProjectsWidget({ n }: { n?: string }) {
  const [projects, inbox] = await Promise.all([listProjects(), countInbox()]);
  const active = projects.filter((p) => p.status === "active");
  return (
    <Card className="h-full">
      <CardHeader
        n={n}
        title="Projets actifs"
        href="/projets"
        aside={<span className="label text-muted" title="Éléments non traités dans INBOX.md">Inbox — {inbox}</span>}
      />
      {active.length === 0 ? (
        <Empty>Aucun projet actif pour l&apos;instant.</Empty>
      ) : (
        <ol className="divide-y divide-border border-y border-border">
          {active.map((p, i) => (
            <li key={p.slug}>
              <Link href={`/projets/${p.slug}`} className="group grid grid-cols-[2.5rem_1fr] gap-x-2 gap-y-1 py-4 sm:grid-cols-[2.5rem_1.2fr_1fr_7rem] sm:items-baseline">
                <span className="label pt-1 text-muted">{num(i)}</span>
                <span className="text-[clamp(1.15rem,1.8vw,1.5rem)] font-light leading-tight tracking-[-0.02em]">
                  <span className="link-underline">{p.title}</span>
                  {p.priority && <span className={`label ml-2 align-middle ${p.priority === "P1" ? "text-accent-text" : "text-muted"}`}>{p.priority}</span>}
                </span>
                <span className="col-start-2 text-sm text-muted sm:col-start-auto"><Value text={p.nextAction} /></span>
                <span className="label col-start-2 text-muted sm:col-start-auto sm:text-right"><DeadlineText deadline={p.deadline} /></span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export async function NewslettersWidget({ n }: { n?: string }) {
  let items: NewsletterSummary[] = [];
  let error: OutlookError | null = null;
  try {
    items = (await listNewsletters()).slice(0, 3);
  } catch (e) {
    error = e instanceof OutlookError ? e : new OutlookError("Newsletters indisponibles pour le moment.");
  }
  return (
    <Card className="h-full">
      <CardHeader n={n} title="Newsletters" href="/newsletters" />
      {error ? (
        <OutlookState error={error} compact />
      ) : items.length === 0 ? (
        <Empty>Aucune newsletter pour l&apos;instant.</Empty>
      ) : (
        <ol className="divide-y divide-border border-y border-border">
          {items.map((m, i) => (
            <li key={m.id}>
              <Link href={`/newsletters/${encodeURIComponent(m.id)}`} className="group grid grid-cols-[2.5rem_1fr] gap-x-2 py-3">
                <span className="label pt-1 text-muted">{num(i)}</span>
                <span className="min-w-0">
                  <span className={`block truncate ${m.isRead ? "" : "font-medium"}`}><span className="link-underline">{m.subject}</span></span>
                  <span className="label mt-1 flex justify-between gap-2 text-muted">
                    <span className="truncate">{m.from}</span>
                    <span className="shrink-0">{relativeTime(m.received)}</span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export async function MemoWidget({ n }: { n?: string }) {
  const { entries } = await readMemo();
  const pinned = entries.filter((e) => e.pinned).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  return (
    <Card className="h-full">
      <CardHeader n={n} title="Mémo" href="/memo" />
      {pinned.length === 0 ? (
        <Empty>Aucun mémo épinglé. Épingle un mémo pour le retrouver ici.</Empty>
      ) : (
        <ol className="divide-y divide-border border-y border-border">
          {pinned.map((e, i) => (
            <li key={e.key} className="grid grid-cols-[2.5rem_1fr] gap-x-2 py-3">
              <span className="label pt-1 text-muted">{num(i)}</span>
              <Link href={`/memo#memo-${e.id ?? e.key}`} className="min-w-0">
                <span className="block truncate"><span className="link-underline">{e.title}</span></span>
                {e.text && <span className="mt-0.5 line-clamp-2 block text-sm text-muted">{e.text.replace(/[#*_>`[\]]/g, "")}</span>}
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
