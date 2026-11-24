import Link from "next/link";
import { Target } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Value } from "@/components/ui/badges";
import { getWeeklyFocus } from "@/lib/content";

/** Focus de la semaine : 3 éléments max, tirés de la dernière revue (reviews/YYYY-Www.md). */
export async function FocusCard({ compact = false }: { compact?: boolean }) {
  const focus = await getWeeklyFocus();
  if (compact) {
    return (
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 border-y border-border py-3 text-sm">
        <span className="label shrink-0 text-muted">focus de la semaine</span>
        {focus.items.length === 0 ? (
          <span className="italic text-muted">TODO: fill in</span>
        ) : (
          <ol className="flex min-w-0 flex-1 flex-wrap gap-x-5 gap-y-1">
            {focus.items.map((item, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="tabular-nums text-accent-text">{i + 1}.</span>
                <Value text={item} />
              </li>
            ))}
          </ol>
        )}
        <Link href="/revue" className="label link-underline shrink-0 text-muted hover:text-text">revue →</Link>
      </div>
    );
  }
  return (
    <Card>
      <CardHeader
        title="Focus de la semaine"
        icon={<Target className="size-4" aria-hidden />}
        aside={
          <span className="flex items-center gap-3 text-xs text-muted">
            {focus.review && <span>d&apos;après {focus.review}</span>}
            <Link href="/revue" className="text-sm hover:text-accent-text">Faire la revue →</Link>
          </span>
        }
      />
      {focus.items.length === 0 ? (
        <p className="italic text-muted">TODO: fill in</p>
      ) : (
        <ol className="grid gap-3 sm:grid-cols-3">
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
