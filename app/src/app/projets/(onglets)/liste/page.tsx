import type { Metadata } from "next";
import { Empty } from "@/components/ui/card";
import { FilterChips } from "@/components/projects/filter-chips";
import { EntryList } from "@/components/projects/entry-list";
import { Notice } from "@/components/ui/notice";
import { PRIORITIES, STATUSES, STATUS_LABELS, listProjects } from "@/lib/content";

export const metadata: Metadata = { title: "Liste · Projets" };
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ListTab({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const pick = (k: string, allowed: readonly string[]) => {
    const v = typeof sp[k] === "string" ? (sp[k] as string) : "all";
    return allowed.includes(v) ? v : "all";
  };
  const status = pick("statut", STATUSES);
  const priority = pick("priorite", PRIORITIES);
  const archived = typeof sp.archive === "string" && /^[a-z0-9-]+$/.test(sp.archive) ? sp.archive : null;

  const projects = await listProjects();
  const shown = projects.filter((e) => (status === "all" || e.status === status) && (priority === "all" || e.priority === priority));
  const keep = (k: string, v: string) => (v === "all" ? {} : { [k]: v });
  const filtered = status !== "all" || priority !== "all";

  return (
    <>
      {archived && <div className="mb-6"><Notice>Projet archivé : son dossier a été déplacé tel quel dans archive/{archived}/.</Notice></div>}
      <div className="mb-10 space-y-3 border-b border-border pb-4">
        <FilterChips
          label="Statut" param="statut" current={status} otherParams={keep("priorite", priority)}
          chips={[{ value: "all", label: "Tous" }, ...STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s], count: projects.filter((e) => e.status === s).length }))]}
        />
        <FilterChips
          label="Priorité" param="priorite" current={priority} otherParams={keep("statut", status)}
          chips={[{ value: "all", label: "Toutes" }, ...PRIORITIES.map((p) => ({ value: p, label: p }))]}
        />
      </div>
      {shown.length ? <EntryList entries={shown} hrefBase="/projets" /> : <Empty>{filtered ? "Aucun projet ne correspond à ces filtres." : "Aucun projet pour l'instant."}</Empty>}
    </>
  );
}
