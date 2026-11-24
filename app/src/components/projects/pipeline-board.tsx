"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { apiJson } from "@/lib/client-api";
import type { BoardProject } from "@/lib/project-board";
import { relativeDay } from "@/lib/task-format";
import { Notice } from "@/components/ui/notice";
import { chip } from "@/components/ui/forms";

const STATUS_LABEL: Record<string, string> = { idea: "idée", active: "actif", paused: "en pause", done: "terminé", dropped: "abandonné" };
const DRAG = "application/x-dashboard-project";

/**
 * Pipeline : une colonne par étape, une carte par projet actif ou en pause. Glisser une carte (ou choisir
 * dans son menu « étape », au clavier) change l'étape. Bascules : projets terminés / abandonnés (archive,
 * lecture seule, pâlis) et « chronologie » (jalons des 3 prochains mois, une ligne par projet).
 */
export function PipelineBoard({
  projects: initial, stages, today, showArchived, timeline, stalledDays,
}: {
  projects: BoardProject[]; stages: { id: string; label: string }[]; today: string;
  showArchived: boolean; timeline: boolean; stalledDays: number;
}) {
  const router = useRouter();
  const [projects, setProjects] = useState(initial);
  const [over, setOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = projects.filter((p) => p.archived || p.status === "active" || p.status === "paused");
  const toggleHref = (key: "termines" | "chronologie", on: boolean) => {
    const sp = new URLSearchParams();
    if (key === "termines" ? !on : showArchived) sp.set("termines", "1");
    if (key === "chronologie" ? !on : timeline) sp.set("chronologie", "1");
    const qs = sp.toString();
    return qs ? `/projets/pipeline?${qs}` : "/projets/pipeline";
  };

  const moveTo = async (slug: string, stage: string) => {
    const p = projects.find((x) => x.slug === slug);
    if (!p || p.archived || p.stage === stage) return;
    setError(null);
    setProjects((list) => list.map((x) => (x.slug === slug ? { ...x, stage } : x)));
    try {
      const base = `/api/entries/project/${slug}`;
      const { version } = await apiJson<{ version: string }>(base);
      await apiJson(base, "PATCH", { version, change: { op: "fields", fields: { stage } } });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setProjects((list) => list.map((x) => (x.slug === slug ? { ...x, stage: p.stage } : x)));
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Link href={toggleHref("chronologie", timeline)} scroll={false} className={chip(timeline)} aria-pressed={timeline}>chronologie</Link>
        <Link href={toggleHref("termines", showArchived)} scroll={false} className={chip(showArchived)} aria-pressed={showArchived}>terminés et abandonnés</Link>
        <span className="ml-auto text-[12px] text-muted">« à l&apos;arrêt » : projet actif sans activité depuis {stalledDays} jours</span>
      </div>
      {error && <div className="mb-4"><Notice>{error}</Notice></div>}

      {timeline ? (
        <Timeline projects={visible} today={today} />
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          <div className="grid min-w-[960px] gap-3" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}>
            {stages.map((s, i) => {
              const list = visible.filter((p) => p.stage === s.id);
              return (
                <section
                  key={s.id}
                  aria-label={`Étape ${s.label}`}
                  onDragOver={(e) => {
                    if (!e.dataTransfer.types.includes(DRAG)) return;
                    e.preventDefault();
                    setOver(s.id);
                  }}
                  onDragLeave={() => setOver((o) => (o === s.id ? null : o))}
                  onDrop={(e) => {
                    setOver(null);
                    const slug = e.dataTransfer.getData(DRAG);
                    if (slug) moveTo(slug, s.id);
                  }}
                  className={`min-h-48 border-t-2 pt-3 transition-colors ${over === s.id ? "border-accent bg-accent-soft/40" : "border-text/80"}`}
                >
                  <h3 className="mb-3 flex items-baseline justify-between gap-2 px-1">
                    <span className="flex items-baseline gap-2"><span className="label text-muted">{String(i + 1).padStart(2, "0")}</span><span className="text-[15px] lowercase">{s.label}</span></span>
                    <span className="label text-muted">{list.filter((p) => !p.archived).length}</span>
                  </h3>
                  <ul className="space-y-2">
                    {list.map((p) => <Card key={`${p.archived ? "a" : "p"}-${p.slug}`} p={p} stages={stages} today={today} onMove={moveTo} />)}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ p, stages, today, onMove }: { p: BoardProject; stages: { id: string; label: string }[]; today: string; onMove: (slug: string, stage: string) => void }) {
  const pct = p.stats.progress.pct;
  const next = p.stats.nextTask;
  return (
    <li
      draggable={!p.archived}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG, p.slug);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={`group border border-border bg-surface p-3 text-sm transition-shadow hover:shadow-md ${p.archived ? "opacity-55" : "cursor-grab active:cursor-grabbing"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={p.archived ? "#" : `/projets/${p.slug}`} aria-disabled={p.archived} className={`font-medium leading-snug ${p.archived ? "pointer-events-none" : "hover:text-accent-text"}`}>{p.title}</Link>
        {p.priority && <span className="label shrink-0 text-muted">{p.priority}</span>}
      </div>
      <p className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[12px] text-muted">
        {p.status !== "active" && <span>{STATUS_LABEL[p.status ?? ""] ?? p.status}</span>}
        {p.deadline && <span className={!p.archived && p.deadline < today ? "text-rose-700 dark:text-rose-400" : ""}>échéance {relativeDay(p.deadline, today)}</span>}
        {p.stats.stalled && !p.archived && <span className="text-amber-800 dark:text-amber-300" title={`Dernière activité : ${p.stats.lastActivity ?? "inconnue"}`}>à l&apos;arrêt</span>}
      </p>
      {pct !== null && (
        <div className="mt-2" title={`${p.stats.progress.done}/${p.stats.progress.total} jalons`}>
          <span className="block h-1 bg-border" aria-hidden><span className="block h-1 bg-accent" style={{ width: `${pct}%` }} /></span>
          <span className="label mt-1 block text-muted">{pct} % · {p.stats.progress.done}/{p.stats.progress.total} jalons</span>
        </div>
      )}
      {(next || p.nextAction) && !p.archived && (
        <p className="mt-2 border-t border-border pt-2 text-[12px] leading-snug">
          <span className="label mr-1 text-muted">suite</span>
          {next ? <>{next.title} <span className="text-muted">· {relativeDay(next.date, today)}{next.time ? ` ${next.time}` : ""}</span></> : p.nextAction}
        </p>
      )}
      {!p.archived && (
        <label className="mt-2 flex items-center gap-2 text-[11px] text-muted">
          <span className="label">étape</span>
          <select value={p.stage} onChange={(e) => onMove(p.slug, e.target.value)} aria-label={`Étape de « ${p.title} »`}
            className="min-w-0 flex-1 border border-border bg-surface px-1 py-0.5 text-[12px] text-text">
            {stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
      )}
    </li>
  );
}

/** Jalons des 3 prochains mois, une ligne par projet (projets sans jalon à venir omis). */
function Timeline({ projects, today }: { projects: BoardProject[]; today: string }) {
  const start = Date.parse(`${today}T00:00:00Z`);
  const endDate = new Date(start);
  endDate.setUTCMonth(endDate.getUTCMonth() + 3);
  const end = endDate.getTime();
  const span = end - start;
  const pos = (iso: string) => ((Date.parse(`${iso}T00:00:00Z`) - start) / span) * 100;
  const months = useMemo(() => {
    const out: { label: string; left: number }[] = [];
    const d = new Date(start);
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + 1);
    while (d.getTime() < end) {
      out.push({ label: new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" }).format(d), left: ((d.getTime() - start) / span) * 100 });
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
    return out;
  }, [start, end, span]);
  const endIso = new Date(end).toISOString().slice(0, 10);
  const rows = projects
    .map((p) => ({ p, ms: p.milestones.filter((m) => m.date >= today && m.date < endIso) }))
    .filter((r) => r.ms.length);

  if (!rows.length) return <p className="border-y border-dashed border-border py-6 text-sm text-muted">Aucun jalon dans les 3 prochains mois. Ajoute des jalons datés dans l&apos;onglet « jalons » d&apos;un projet.</p>;
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="min-w-[720px]">
        <div className="relative ml-48 h-6 border-b border-text/80">
          <span className="label absolute bottom-1 left-0 text-accent-text">aujourd&apos;hui</span>
          {months.map((m) => <span key={m.label} className="label absolute bottom-1 border-l border-border pl-1 text-muted" style={{ left: `${m.left}%` }}>{m.label}</span>)}
        </div>
        <ul>
          {rows.map(({ p, ms }) => (
            <li key={p.slug} className={`flex items-center border-b border-border ${p.archived ? "opacity-55" : ""}`}>
              <Link href={`/projets/${p.slug}?onglet=jalons`} className="w-48 shrink-0 truncate py-3 pr-3 text-sm hover:text-accent-text">{p.title}</Link>
              <div className="relative h-12 flex-1">
                {months.map((m) => <span key={m.label} className="absolute inset-y-0 border-l border-border/60" style={{ left: `${m.left}%` }} aria-hidden />)}
                {ms.map((m) => (
                  <span key={`${m.date}-${m.text}`} className="absolute top-1/2 flex -translate-y-1/2 items-center gap-1.5" style={{ left: `${pos(m.date)}%` }} title={`${m.date} — ${m.text}`}>
                    <span className={`size-2.5 rotate-45 ${m.done ? "bg-text/40" : "bg-accent"}`} aria-hidden />
                    <span className={`max-w-40 truncate text-[12px] ${m.done ? "text-muted line-through" : ""}`}>{m.text}</span>
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
