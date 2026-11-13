import type { Metadata } from "next";
import { Empty, PageHeader } from "@/components/ui/card";
import { FilterChips } from "@/components/projects/filter-chips";
import { EntryList } from "@/components/projects/entry-list";
import { FocusCard } from "@/components/focus/focus-card";
import { PRIORITIES, STATUSES, STATUS_LABELS, listAreas, listProjects } from "@/lib/content";

export const metadata: Metadata = { title: "Projets" };
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ProjectsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const pick = (k: string, allowed: readonly string[]) => {
    const v = typeof sp[k] === "string" ? (sp[k] as string) : "all";
    return allowed.includes(v) ? v : "all";
  };
  const status = pick("statut", STATUSES);
  const priority = pick("priorite", PRIORITIES);

  const [projects, areas] = await Promise.all([listProjects(), listAreas()]);
  const match = (e: { status: string | null; priority: string | null }) =>
    (status === "all" || e.status === status) && (priority === "all" || e.priority === priority);
  const shownProjects = projects.filter(match);
  const shownAreas = areas.filter(match);

  const keep = (k: string, v: string) => (v === "all" ? {} : { [k]: v });
  const filtered = status !== "all" || priority !== "all";

  return (
    <>
      <PageHeader
        title="Projets et domaines"
        subtitle="Lu directement depuis projects/ et areas/ (lecture seule)."
      />

      <div className="mb-6">
        <FocusCard />
      </div>

      <div className="mb-8 space-y-3 rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <FilterChips
          label="Statut" param="statut" current={status} otherParams={keep("priorite", priority)}
          chips={[
            { value: "all", label: "Tous" },
            ...STATUSES.map((s) => ({
              value: s, label: STATUS_LABELS[s],
              count: [...projects, ...areas].filter((e) => e.status === s).length,
            })),
          ]}
        />
        <FilterChips
          label="Priorité" param="priorite" current={priority} otherParams={keep("statut", status)}
          chips={[{ value: "all", label: "Toutes" }, ...PRIORITIES.map((p) => ({ value: p, label: p }))]}
        />
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          Projets <span className="text-sm font-normal text-muted">({shownProjects.length})</span>
        </h2>
        {shownProjects.length ? (
          <EntryList entries={shownProjects} hrefBase="/projets" />
        ) : (
          <Empty>{filtered ? "Aucun projet ne correspond à ces filtres." : "Aucun projet pour l'instant."}</Empty>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          Domaines <span className="text-sm font-normal text-muted">({shownAreas.length})</span>
        </h2>
        {shownAreas.length ? (
          <EntryList entries={shownAreas} hrefBase="/domaines" />
        ) : (
          <Empty>{filtered ? "Aucun domaine ne correspond à ces filtres." : "Aucun domaine pour l'instant."}</Empty>
        )}
      </section>
    </>
  );
}
