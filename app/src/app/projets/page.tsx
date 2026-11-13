import type { Metadata } from "next";
import { Empty, PageHeader } from "@/components/ui/card";
import { FilterChips } from "@/components/projects/filter-chips";
import { EntryList } from "@/components/projects/entry-list";
import { FocusCard } from "@/components/focus/focus-card";
import { NewEntryButtons } from "@/components/projects/new-entry";
import { Notice } from "@/components/ui/notice";
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
  const archived = typeof sp.archive === "string" && /^[a-z0-9-]+$/.test(sp.archive) ? sp.archive : null;
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
      <PageHeader title="Projets et domaines" subtitle="Lu et modifié directement dans projects/ et areas/.">
        <NewEntryButtons />
      </PageHeader>
      {archived && (
        <div className="mb-6">
          <Notice>Projet archivé : son dossier a été déplacé tel quel dans archive/{archived}/.</Notice>
        </div>
      )}

      <div className="mb-6">
        <FocusCard />
      </div>

      <div className="mb-16 space-y-3 border-y border-border py-4">
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

      <section className="mb-16">
        <h2 className="mb-5 flex items-baseline gap-3 border-t border-text/80 pt-4"><span className="title-md lowercase">Projets</span>
          <span className="label text-muted">{String(shownProjects.length).padStart(2, "0")}</span>
        </h2>
        {shownProjects.length ? (
          <EntryList entries={shownProjects} hrefBase="/projets" />
        ) : (
          <Empty>{filtered ? "Aucun projet ne correspond à ces filtres." : "Aucun projet pour l'instant."}</Empty>
        )}
      </section>

      <section>
        <h2 className="mb-5 flex items-baseline gap-3 border-t border-text/80 pt-4"><span className="title-md lowercase">Domaines</span>
          <span className="label text-muted">{String(shownAreas.length).padStart(2, "0")}</span>
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
