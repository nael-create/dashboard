import type { Metadata } from "next";
import { Empty } from "@/components/ui/card";
import { EntryCard } from "@/components/projects/entry-card";
import { FilterChips } from "@/components/projects/filter-chips";
import { Notice } from "@/components/ui/notice";
import { PRIORITIES } from "@/lib/content";
import { listedEntries } from "@/lib/project-list";

export const metadata: Metadata = { title: "Projets" };
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;
const STATUS_FILTERS = [
  { value: "idee", label: "Idée", status: "idea" },
  { value: "en-cours", label: "En cours", status: "active" },
  { value: "en-pause", label: "En pause", status: "paused" },
  { value: "termines", label: "Terminés", status: null },
] as const;
const SORTS = [
  { id: "deadline", label: "Deadline" },
  { id: "priorite", label: "Priorité" },
  { id: "activite", label: "Dernière activité" },
] as const;
const RANK: Record<string, number> = { P1: 1, P2: 2, P3: 3 };
/** Anciennes adresses (?statut=active…) → nouvelles valeurs. */
const LEGACY_STATUS: Record<string, string> = { idea: "idee", active: "en-cours", paused: "en-pause", done: "termines", dropped: "termines" };

/** Onglet « projets » : cartes simples, filtres statut et priorité, tri deadline (par défaut), priorité, dernière activité. */
export default async function ProjectsTab({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const rawStatus = LEGACY_STATUS[str("statut")] ?? str("statut");
  const status = STATUS_FILTERS.some((s) => s.value === rawStatus) ? rawStatus : "all";
  const priority = (PRIORITIES as readonly string[]).includes(str("priorite")) ? str("priorite") : "all";
  const sort = SORTS.some((s) => s.id === str("tri")) ? str("tri") : "deadline";
  const archived = /^[a-z0-9-]+$/.test(str("archive")) ? str("archive") : null;
  const deleted = str("supprime").slice(0, 120);

  const { entries: all, today } = await listedEntries("project", status === "termines");
  const statusOf = STATUS_FILTERS.find((s) => s.value === status);
  const shown = all
    .filter((p) => (status === "all" ? !p.archived : status === "termines" ? p.archived || p.status === "done" : !p.archived && p.status === statusOf?.status))
    .filter((p) => priority === "all" || p.priority === priority)
    .sort((a, b) => {
      const byDeadline = (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999");
      const byPriority = (RANK[a.priority ?? ""] ?? 9) - (RANK[b.priority ?? ""] ?? 9);
      const byTitle = a.title.localeCompare(b.title, "fr");
      if (sort === "priorite") return byPriority || byDeadline || byTitle;
      if (sort === "activite") return (b.stats.lastActivity ?? "").localeCompare(a.stats.lastActivity ?? "") || byTitle;
      return byDeadline || byPriority || byTitle;
    });

  const current = { statut: status, priorite: priority, tri: sort === "deadline" ? "all" : sort };
  const others = (except: keyof typeof current) =>
    Object.fromEntries(Object.entries(current).filter(([k, v]) => k !== except && v !== "all")) as Record<string, string>;
  const filtered = status !== "all" || priority !== "all";
  const count = (s: string | null) => all.filter((p) => !p.archived && p.status === s).length;

  return (
    <>
      {archived && <div className="mb-6"><Notice>Projet archivé : son dossier a été déplacé tel quel dans archive/{archived}/.</Notice></div>}
      {deleted && <div className="mb-6"><Notice>Projet « {deleted} » supprimé. Clique sur « Sauvegarder » pour envoyer la suppression sur GitHub.</Notice></div>}
      <div className="mb-10 space-y-3 border-b border-border pb-4">
        <FilterChips label="Statut" param="statut" current={status} otherParams={others("statut")}
          chips={[{ value: "all", label: "Tous" }, ...STATUS_FILTERS.map((s) => ({ value: s.value, label: s.label, count: s.status ? count(s.status) : undefined }))]} />
        <FilterChips label="Priorité" param="priorite" current={priority} otherParams={others("priorite")}
          chips={[{ value: "all", label: "Toutes" }, ...PRIORITIES.map((p) => ({ value: p, label: p }))]} />
        <FilterChips label="Trier" param="tri" current={current.tri} otherParams={others("tri")}
          chips={SORTS.map((s) => ({ value: s.id === "deadline" ? "all" : s.id, label: s.label }))} />
      </div>

      {shown.length === 0 ? (
        <Empty>{filtered ? "Aucun projet ne correspond à ces filtres." : "Aucun projet pour l'instant. « Nouveau projet » en crée un."}</Empty>
      ) : (
        <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => <EntryCard key={`${p.archived}-${p.slug}`} e={p} today={today} />)}
        </ul>
      )}
    </>
  );
}
