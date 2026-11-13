import { Target } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Value } from "@/components/ui/badges";
import { getWeeklyFocus } from "@/lib/content";

/** Focus de la semaine : 3 éléments max, tirés de la dernière revue (reviews/YYYY-Www.md). */
export async function FocusCard() {
  const focus = await getWeeklyFocus();
  return (
    <Card>
      <CardHeader
        title="Focus de la semaine"
        icon={<Target className="size-4" aria-hidden />}
        aside={focus.review && <span className="text-xs text-muted">d&apos;après {focus.review}</span>}
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
