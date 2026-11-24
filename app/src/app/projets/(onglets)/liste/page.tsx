import type { Metadata } from "next";
import Link from "next/link";
import config from "@config";
import { Empty } from "@/components/ui/card";
import { FilterChips } from "@/components/projects/filter-chips";
import { Notice } from "@/components/ui/notice";
import { PriorityBadge, StatusBadge } from "@/components/ui/badges";
import { StarButton } from "@/components/favorites/favorites-context";
import { PRIORITIES, STATUSES, STATUS_LABELS, stageLabel } from "@/lib/content";
import { boardProjects } from "@/lib/project-board";
import { relativeDay } from "@/lib/task-format";

export const metadata: Metadata = { title: "Liste · Projets" };
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;
const SORTS = [
  { id: "priorite", label: "Priorité" },
  { id: "deadline", label: "Deadline" },
  { id: "activite", label: "Dernière activité" },
] as const;
const RANK: Record<string, number> = { P1: 1, P2: 2, P3: 3 };

/** Liste des projets en cours : filtres (statut, priorité, étape, tags) et tri (priorité, deadline, dernière activité). */
export default async function ListTab({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const pick = (k: string, allowed: readonly string[]) => (allowed.includes(str(k)) ? str(k) : "all");
  const stages = config.projectStages.map((s) => s.id);
  const status = pick("statut", STATUSES);
  const priority = pick("priorite", PRIORITIES);
  const stage = pick("etape", stages);
  const { projects: all, today } = await boardProjects(false);
  const allTags = [...new Set(all.flatMap((p) => p.tags))].sort((a, b) => a.localeCompare(b, "fr"));
  const tag = pick("tag", allTags);
  const sort = pick("tri", SORTS.map((s) => s.id)) === "all" ? "priorite" : str("tri");
  const archived = /^[a-z0-9-]+$/.test(str("archive")) ? str("archive") : null;
  const deleted = str("supprime").slice(0, 120);

  const shown = all
    .filter((p) => (status === "all" || p.status === status) && (priority === "all" || p.priority === priority) && (stage === "all" || p.stage === stage) && (tag === "all" || p.tags.includes(tag)))
    .sort((a, b) => {
      if (sort === "deadline") return (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999") || a.title.localeCompare(b.title, "fr");
      if (sort === "activite") return (b.stats.lastActivity ?? "").localeCompare(a.stats.lastActivity ?? "") || a.title.localeCompare(b.title, "fr");
      return (RANK[a.priority ?? ""] ?? 9) - (RANK[b.priority ?? ""] ?? 9) || (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999") || a.title.localeCompare(b.title, "fr");
    });

  const current = { statut: status, priorite: priority, etape: stage, tag, tri: sort === "priorite" ? "all" : sort };
  const others = (except: keyof typeof current) =>
    Object.fromEntries(Object.entries(current).filter(([k, v]) => k !== except && v !== "all")) as Record<string, string>;
  const filtered = status !== "all" || priority !== "all" || stage !== "all" || tag !== "all";

  return (
    <>
      {archived && <div className="mb-6"><Notice>Projet archivé : son dossier a été déplacé tel quel dans archive/{archived}/.</Notice></div>}
      {deleted && <div className="mb-6"><Notice>Projet « {deleted} » supprimé. Clique sur « Sauvegarder » pour envoyer la suppression sur GitHub.</Notice></div>}
      <div className="mb-10 space-y-3 border-b border-border pb-4">
        <FilterChips label="Statut" param="statut" current={status} otherParams={others("statut")}
          chips={[{ value: "all", label: "Tous" }, ...STATUSES.filter((s) => s !== "done" && s !== "dropped").map((s) => ({ value: s, label: STATUS_LABELS[s], count: all.filter((e) => e.status === s).length }))]} />
        <FilterChips label="Priorité" param="priorite" current={priority} otherParams={others("priorite")}
          chips={[{ value: "all", label: "Toutes" }, ...PRIORITIES.map((p) => ({ value: p, label: p }))]} />
        <FilterChips label="Étape" param="etape" current={stage} otherParams={others("etape")}
          chips={[{ value: "all", label: "Toutes" }, ...config.projectStages.map((s) => ({ value: s.id, label: s.label, count: all.filter((e) => e.stage === s.id).length }))]} />
        {allTags.length > 0 && (
          <FilterChips label="Tags" param="tag" current={tag} otherParams={others("tag")}
            chips={[{ value: "all", label: "Tous" }, ...allTags.map((t) => ({ value: t, label: `#${t}` }))]} />
        )}
        <FilterChips label="Trier" param="tri" current={sort === "priorite" ? "all" : sort} otherParams={others("tri")}
          chips={SORTS.map((s) => ({ value: s.id === "priorite" ? "all" : s.id, label: s.label }))} />
      </div>

      {shown.length === 0 ? (
        <Empty>{filtered ? "Aucun projet ne correspond à ces filtres." : "Aucun projet pour l'instant. « Nouveau projet » en crée un à partir du modèle."}</Empty>
      ) : (
        <ul className="border-t border-text/80">
          {shown.map((p) => (
            <li key={p.slug} className="relative grid gap-x-6 gap-y-1 border-b border-border py-4 sm:grid-cols-12 sm:items-center">
              <div className="min-w-0 sm:col-span-5">
                <Link href={`/projets/${p.slug}`} className="text-[17px] leading-snug hover:text-accent-text">{p.title}</Link>
                <p className="mt-0.5 truncate text-[13px] text-muted">
                  {p.stats.nextTask ? <>suite : {p.stats.nextTask.title} · {relativeDay(p.stats.nextTask.date, today)}</> : p.nextAction ? <>suite : {p.nextAction}</> : <>pas de prochaine action</>}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:col-span-3">
                <PriorityBadge priority={p.priority as never} />
                <StatusBadge status={p.status as never} />
                <span className="label text-muted">· {stageLabel(p.stage)}</span>
                {p.tags.map((t) => <span key={t} className="label text-muted">#{t}</span>)}
              </div>
              <div className="text-[13px] sm:col-span-2">
                {p.stats.progress.pct !== null ? (
                  <span title={`${p.stats.progress.done}/${p.stats.progress.total} jalons`}>
                    <span className="block h-1 bg-border" aria-hidden><span className="block h-1 bg-accent" style={{ width: `${p.stats.progress.pct}%` }} /></span>
                    <span className="label mt-1 block text-muted">{p.stats.progress.pct} %</span>
                  </span>
                ) : <span className="label text-muted">sans jalon</span>}
              </div>
              <div className="text-[12px] text-muted sm:col-span-2 sm:text-right">
                {p.deadline && <span className={`block ${p.deadline < today ? "text-rose-700 dark:text-rose-400" : ""}`}>échéance {relativeDay(p.deadline, today)}</span>}
                <span className="block">activité {p.stats.lastActivity ? relativeDay(p.stats.lastActivity, today) : "—"}{p.stats.stalled ? " · à l'arrêt" : ""}</span>
              </div>
              <StarButton type="project" refId={`project:${p.slug}`} title={p.title} className="absolute right-0 top-3 sm:hidden" />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
