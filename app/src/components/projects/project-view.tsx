"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, Check, FileText, Pencil, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { apiJson, isConflict } from "@/lib/client-api";
import { btnDanger, btnGhost, btnPrimary, field, iconBtn } from "@/components/ui/forms";
import { Notice } from "@/components/ui/notice";
import { StarButton } from "@/components/favorites/favorites-context";
import { TaskQuickAdd, type ProjectRef } from "@/components/tasks/task-quick-add";
import { TaskRow } from "@/components/tasks/task-row";
import { TASKS_EVENT, useTasks } from "@/components/tasks/use-tasks";
import { projectTasks } from "@/lib/tasks-view";
import { relativeDay } from "@/lib/task-format";
import {
  Actions, extraSections, InlineText, isTodo, Journal, PRIORITIES, SectionEditor, STATUSES, type Change, type Editable,
} from "./entry-editor";

export const PROJECT_PAGE_TABS = [
  { id: "vue", label: "vue d'ensemble" },
  { id: "taches", label: "tâches" },
  { id: "jalons", label: "jalons" },
  { id: "docs", label: "docs" },
  { id: "journal", label: "journal" },
] as const;
type TabId = (typeof PROJECT_PAGE_TABS)[number]["id"];

export const OVERVIEW_SECTIONS = ["Objectif", "Pourquoi", "Critères de réussite", "Ressources", "Risques"];

export interface DocListItem { slug: string; title: string; updated: string | null; order: number }
export interface TemplateItem { id: string; title: string; description: string }

/**
 * Page d'un projet : en-tête (titre, statut, étapes cliquables, priorité, deadline, avancement des jalons,
 * dernière activité) et onglets vue d'ensemble / tâches / jalons / docs / journal (?onglet=…).
 */
export function ProjectView({
  initial, stages, projects, docs: initialDocs, templates, today, lastActivity,
}: {
  initial: Editable; stages: { id: string; label: string }[]; projects: ProjectRef[];
  docs: DocListItem[]; templates: TemplateItem[]; today: string; lastActivity: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const tab = (PROJECT_PAGE_TABS.some((t) => t.id === sp.get("onglet")) ? sp.get("onglet") : "vue") as TabId;
  const [e, setE] = useState(initial);
  const [error, setError] = useState<{ text: string; conflict: boolean } | null>(null);
  const [archiveAsk, setArchiveAsk] = useState<string | null>(null);
  const base = `/api/entries/project/${e.slug}`;
  const versionRef = useRef(initial.version);

  const reload = useCallback(async () => {
    const fresh = await apiJson<Editable>(base);
    versionRef.current = fresh.version;
    setE(fresh);
  }, [base]);
  // Une tâche liée cochée ailleurs ajoute une entrée au journal : on relit.
  useEffect(() => {
    const on = () => reload().catch(() => {});
    window.addEventListener(TASKS_EVENT, on);
    return () => window.removeEventListener(TASKS_EVENT, on);
  }, [reload]);

  const change = async (c: Change, confirmArchive = false): Promise<boolean> => {
    setError(null);
    try {
      const res = await apiJson<{ version: string; archivedTo: string | null }>(base, "PATCH", { version: versionRef.current, change: c, confirmArchive });
      versionRef.current = res.version;
      if (res.archivedTo) {
        router.push(`/projets/liste?archive=${encodeURIComponent(res.archivedTo)}`);
        router.refresh();
        return true;
      }
      await reload();
      return true;
    } catch (err) {
      setError({ text: err instanceof Error ? err.message : String(err), conflict: isConflict(err) });
      return false;
    }
  };
  const setFields = (fields: Record<string, string>) => change({ op: "fields", fields });

  const plan = async (index: number, text: string, date: string, time: string | null): Promise<boolean> => {
    setError(null);
    try {
      const res = await apiJson<{ projectVersion: string }>("/api/tasks", "POST", { action: "plan", slug: e.slug, projectVersion: versionRef.current, index, text, date, time });
      versionRef.current = res.projectVersion;
      window.dispatchEvent(new Event(TASKS_EVENT));
      await reload();
      return true;
    } catch (err) {
      setError({ text: err instanceof Error ? err.message : String(err), conflict: isConflict(err) });
      return false;
    }
  };

  const ms = e.milestones ?? [];
  const done = ms.filter((m) => m.done).length;
  const pct = ms.length ? Math.round((done / ms.length) * 100) : null;
  const stage = stages.some((s) => s.id === e.fields.stage) ? e.fields.stage : stages[0].id;
  const stageIdx = stages.findIndex((s) => s.id === stage);
  const tabHref = (id: TabId) => (id === "vue" ? pathname : `${pathname}?onglet=${id}`);

  return (
    <article>
      <Link href="/projets/liste" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-accent-text">
        <ArrowLeft className="size-4" aria-hidden /> Projets
      </Link>
      {error && (
        <div className="mb-4">
          <Notice action={error.conflict ? <button type="button" className="text-sm font-medium underline" onClick={() => { setError(null); reload(); }}>Recharger</button> : undefined}>
            {error.text}
          </Notice>
        </div>
      )}

      {/* En-tête */}
      <header className="rise border-t border-text/80 pt-5">
        <p className="label mb-1 flex items-center justify-between text-muted">
          projet
          <StarButton type="project" refId={`project:${e.slug}`} title={e.fields.title || e.slug} />
        </p>
        <InlineText value={e.fields.title ?? ""} label="Titre" className="text-[clamp(2.25rem,5.5vw,4.5rem)] font-light leading-[1] tracking-[-0.04em]" onSave={(v) => setFields({ title: v })} />

        {/* Étapes : cliquer pour changer */}
        <ol className="mt-6 grid grid-cols-3 gap-1 sm:grid-cols-6" aria-label="Étape du projet">
          {stages.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => s.id !== stage && setFields({ stage: s.id })}
                aria-current={s.id === stage ? "step" : undefined}
                className={`group w-full text-left transition-colors ${i <= stageIdx ? "text-text" : "text-muted hover:text-text"}`}
              >
                <span className={`block h-1 transition-colors ${i < stageIdx ? "bg-text/70" : i === stageIdx ? "bg-accent" : "bg-border group-hover:bg-text/30"}`} />
                <span className={`label mt-1.5 block ${s.id === stage ? "text-accent-text" : ""}`}>{String(i + 1).padStart(2, "0")} {s.label}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="mt-6 grid gap-4 border-b border-border pb-5 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block text-sm">
            <span className="label mb-1 block text-muted">statut</span>
            <select
              value={e.fields.status ?? ""}
              onChange={(ev) => {
                const v = ev.target.value;
                if (v === "done" || v === "dropped") setArchiveAsk(v);
                else setFields({ status: v });
              }}
              className={field}
            >
              {!STATUSES.some(([v]) => v === e.fields.status) && <option value={e.fields.status ?? ""}>{e.fields.status || "—"}</option>}
              {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="label mb-1 block text-muted">priorité</span>
            <select value={e.fields.priority ?? ""} onChange={(ev) => setFields({ priority: ev.target.value })} className={field}>
              {!PRIORITIES.includes(e.fields.priority ?? "") && <option value={e.fields.priority ?? ""}>{e.fields.priority || "—"}</option>}
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="label mb-1 flex items-center justify-between text-muted">
              deadline
              {e.fields.deadline && <button type="button" className="normal-case hover:underline" onClick={() => setFields({ deadline: "" })}>effacer</button>}
            </span>
            <input type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(e.fields.deadline ?? "") ? e.fields.deadline : ""} onChange={(ev) => setFields({ deadline: ev.target.value })} className={field} />
          </label>
          <div className="text-sm">
            <span className="label mb-1 block text-muted">avancement</span>
            {pct === null ? (
              <Link href={tabHref("jalons")} className="block py-2 text-muted hover:text-text">aucun jalon — en ajouter</Link>
            ) : (
              <div className="py-1.5">
                <span className="tabular-nums">{pct} %</span> <span className="text-muted">· {done}/{ms.length} jalons</span>
                <span className="mt-1.5 block h-1 bg-border" aria-hidden><span className="block h-1 bg-accent" style={{ width: `${pct}%` }} /></span>
              </div>
            )}
          </div>
          <div className="text-sm">
            <span className="label mb-1 block text-muted">dernière activité</span>
            <span className="block py-2">{lastActivity ? relativeDay(lastActivity, today) : "—"}</span>
          </div>
        </div>
        {archiveAsk && (
          <div className="mt-4 bg-amber-500/10 p-3 text-sm">
            <p className="mb-2">Marquer ce projet « {archiveAsk === "done" ? "Terminé" : "Abandonné"} » : son dossier sera déplacé tel quel dans <code>archive/</code> et il disparaîtra des tableaux. Continuer ?</p>
            <div className="flex justify-end gap-2">
              <button type="button" className={btnGhost} onClick={() => setArchiveAsk(null)}>Annuler</button>
              <button type="button" className={btnDanger} onClick={async () => { await change({ op: "fields", fields: { status: archiveAsk } }, true); setArchiveAsk(null); }}>Archiver</button>
            </div>
          </div>
        )}
      </header>

      {/* Onglets */}
      <nav aria-label="Onglets du projet" className="-mx-4 mt-2 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
        <ul className="flex gap-6">
          {PROJECT_PAGE_TABS.map((t) => (
            <li key={t.id}>
              <Link href={tabHref(t.id)} scroll={false} aria-current={tab === t.id ? "page" : undefined}
                className={`-mb-px block whitespace-nowrap border-b-2 py-3 text-[15px] lowercase transition-colors ${tab === t.id ? "border-text" : "border-transparent text-muted hover:text-text"}`}>
                {t.label}
                {t.id === "jalons" && ms.length > 0 && <span className="label ml-1.5 text-muted">{ms.length}</span>}
                {t.id === "docs" && initialDocs.length > 0 && <span className="label ml-1.5 text-muted">{initialDocs.length}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="pt-8">
        {tab === "vue" && <Overview e={e} change={change} plan={plan} setFields={setFields} />}
        {tab === "taches" && <ProjectTasks slug={e.slug} projects={projects} />}
        {tab === "jalons" && <Milestones items={ms} change={change} today={today} />}
        {tab === "docs" && <Docs project={e.slug} initial={initialDocs} templates={templates} />}
        {tab === "journal" && <div className="max-w-3xl"><Journal entries={e.journal} change={change} /></div>}
      </div>
      <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-xs text-muted">Source : <code className="break-all">projects/{e.slug}/README.md</code></p>
        <DeleteProject slug={e.slug} title={e.fields.title || e.slug} version={() => versionRef.current} onError={(t) => setError({ text: t, conflict: true })} />
      </footer>
    </article>
  );
}

function Overview({ e, change, plan, setFields }: {
  e: Editable; change: (c: Change) => Promise<boolean>;
  plan: (index: number, text: string, date: string, time: string | null) => Promise<boolean>;
  setFields: (f: Record<string, string>) => Promise<boolean>;
}) {
  const extra = extraSections(e.body);
  const tags = e.fields.tags ?? "";
  return (
    <div className="grid gap-12 lg:grid-cols-12">
      <div className="min-w-0 space-y-10 lg:col-span-7">
        {OVERVIEW_SECTIONS.map((name) => (
          <SectionEditor key={name} name={name} text={e.sections[name] ?? ""} onSave={(t) => change({ op: "section", name, text: t })} />
        ))}
        {["Notes", "Liens"].map((name) => (
          <SectionEditor key={name} name={name} text={e.sections[name] ?? ""} onSave={(t) => change({ op: "section", name, text: t })} />
        ))}
        {extra.map(([name, text]) => (
          <section key={name}>
            <h2 className="mb-3 border-b border-border pb-2 title-md lowercase">{name}</h2>
            <div className="md text-sm"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>{text}</ReactMarkdown></div>
            <p className="mt-1 text-xs text-muted">Section ajoutée à la main : modifiable dans le fichier.</p>
          </section>
        ))}
      </div>
      <aside className="space-y-10 lg:col-span-5">
        <div className="text-sm">
          <span className="label mb-1 block text-muted">prochaine action</span>
          <InlineText value={e.fields.next_action ?? ""} label="Prochaine action" boxed onSave={(v) => setFields({ next_action: v })} />
        </div>
        <Actions items={e.actions} change={change} plan={plan} />
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <label className="block">
            <span className="label mb-1 block text-muted">début</span>
            <input type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(e.fields.started ?? "") ? e.fields.started : ""} onChange={(ev) => setFields({ started: ev.target.value })} className={field} />
          </label>
          <div>
            <span className="label mb-1 block text-muted">tags</span>
            <InlineText value={isTodo(tags) ? "" : tags} label="Tags (séparés par des virgules)" boxed onSave={(v) => setFields({ tags: v === "TODO: fill in" ? "" : v })} />
          </div>
        </div>
      </aside>
    </div>
  );
}

function ProjectTasks({ slug, projects }: { slug: string; projects: ProjectRef[] }) {
  const api = useTasks();
  const s = api.state;
  if (!s) return <p className="text-sm text-muted">Chargement des tâches…</p>;
  const { todo, closed } = projectTasks(s.tasks, slug);
  return (
    <div className="max-w-3xl space-y-6">
      <TaskQuickAdd api={api} projects={projects} today={s.today} defaultProject={slug} placeholder="Nouvelle tâche pour ce projet… (ex. « Relire le brief jeudi 10h »)" />
      {api.error && <Notice>{api.error}</Notice>}
      <ul>
        {todo.map((t) => <TaskRow key={t.id} task={t} api={api} today={s.today} projects={projects} showDate overdue={t.date < s.today} draggable={false} hideProject />)}
      </ul>
      {todo.length === 0 && <p className="text-sm text-muted">Aucune tâche à faire pour ce projet. « Planifier » une prochaine action (vue d&apos;ensemble) en crée une.</p>}
      {closed.length > 0 && (
        <details>
          <summary className="label cursor-pointer text-muted hover:text-text">faites et abandonnées · {closed.length}</summary>
          <ul className="mt-2">
            {closed.slice(0, 50).map((t) => <TaskRow key={t.id} task={t} api={api} today={s.today} projects={projects} draggable={false} hideProject />)}
          </ul>
        </details>
      )}
    </div>
  );
}

function Milestones({ items, change, today }: { items: { date: string; text: string; done: boolean }[]; change: (c: Change) => Promise<boolean>; today: string }) {
  const [date, setDate] = useState("");
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState({ date: "", text: "" });
  const [confirm, setConfirm] = useState<number | null>(null);
  return (
    <section className="max-w-3xl">
      <form className="mb-6 flex flex-wrap gap-2" onSubmit={async (ev) => {
        ev.preventDefault();
        if (text.trim() && date && (await change({ op: "milestone-add", date, text }))) { setText(""); setDate(""); }
      }}>
        <input type="date" required value={date} onChange={(ev) => setDate(ev.target.value)} aria-label="Date du jalon" className={`${field} w-auto`} />
        <input value={text} onChange={(ev) => setText(ev.target.value)} placeholder="Nouveau jalon… (ex. Prototype prêt)" aria-label="Nouveau jalon" maxLength={300} className={`${field} min-w-0 flex-1`} />
        <button type="submit" className={btnPrimary} disabled={!text.trim() || !date}><Plus className="size-4" aria-hidden /> Ajouter</button>
      </form>
      {items.length === 0 && <p className="text-sm text-muted">Aucun jalon. Les jalons datés mesurent l&apos;avancement du projet et apparaissent dans le calendrier et le pipeline.</p>}
      <ol className="border-t border-text/80">
        {items.map((m, i) => (
          <li key={`${i}-${m.text}`} className="group flex items-center gap-3 border-b border-border py-3">
            <button type="button" role="checkbox" aria-checked={m.done} aria-label={`${m.done ? "Décocher" : "Cocher"} le jalon « ${m.text} »`}
              onClick={() => change({ op: "milestone-check", index: i, text: m.text, done: !m.done })}
              className={`grid size-[18px] shrink-0 place-items-center border transition-colors ${m.done ? "border-accent bg-accent text-white" : "border-text/60 hover:border-accent"}`}>
              {m.done && <Check className="size-3" strokeWidth={3} aria-hidden />}
            </button>
            {editing === i ? (
              <form className="flex flex-1 flex-wrap gap-2" onSubmit={async (ev) => {
                ev.preventDefault();
                if (await change({ op: "milestone-edit", index: i, text: m.text, date: draft.date, newText: draft.text })) setEditing(null);
              }}>
                <input type="date" required value={draft.date} onChange={(ev) => setDraft({ ...draft, date: ev.target.value })} className={`${field} w-auto py-1`} aria-label="Date" />
                <input value={draft.text} onChange={(ev) => setDraft({ ...draft, text: ev.target.value })} className={`${field} min-w-0 flex-1 py-1`} aria-label="Jalon" autoFocus onKeyDown={(ev) => ev.key === "Escape" && setEditing(null)} />
                <button type="submit" className={iconBtn} aria-label="Enregistrer"><Check className="size-4" /></button>
                <button type="button" className={iconBtn} aria-label="Annuler" onClick={() => setEditing(null)}><X className="size-4" /></button>
              </form>
            ) : (
              <>
                <time className={`label w-28 shrink-0 tabular-nums ${!m.done && m.date < today ? "text-rose-700 dark:text-rose-400" : "text-muted"}`}>{relativeDay(m.date, today)}</time>
                <span className={`min-w-0 flex-1 ${m.done ? "text-muted line-through" : ""}`}>{m.text}</span>
                <span className="flex shrink-0 opacity-60 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <button type="button" className={iconBtn} aria-label={`Modifier « ${m.text} »`} onClick={() => { setEditing(i); setDraft({ date: m.date, text: m.text }); }}><Pencil className="size-4" /></button>
                  <button type="button" className={iconBtn} aria-label={`Supprimer « ${m.text} »`} onClick={() => setConfirm(i)}><Trash2 className="size-4" /></button>
                </span>
              </>
            )}
            {confirm === i && (
              <span className="flex items-center gap-2 text-sm" role="alert">
                Supprimer ?
                <button type="button" className={btnDanger} onClick={async () => { await change({ op: "milestone-remove", index: i, text: m.text }); setConfirm(null); }}>Supprimer</button>
                <button type="button" className={btnGhost} onClick={() => setConfirm(null)}>Annuler</button>
              </span>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-muted">Cocher un jalon ajoute « Jalon atteint : … » au journal. Stockés dans la section « ## Jalons » du README.</p>
    </section>
  );
}

function Docs({ project, initial, templates }: { project: string; initial: DocListItem[]; templates: TemplateItem[] }) {
  const router = useRouter();
  const [docs, setDocs] = useState(initial);
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const base = `/api/projects/${project}/docs`;

  const create = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(null);
    try {
      const { doc } = await apiJson<{ doc: string }>(base, "POST", { title: title || templates.find((t) => t.id === template)?.title || "", template: template || null });
      router.push(`/projets/${project}/docs/${doc}?modifier=1`);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const reorder = async (order: string[]) => {
    setDocs((d) => order.map((s) => d.find((x) => x.slug === s)!));
    try {
      const r = await apiJson<{ docs: DocListItem[] }>(base, "PATCH", { order });
      setDocs(r.docs);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const move = (i: number, dir: -1 | 1) => {
    const order = docs.map((d) => d.slug);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    reorder(order);
  };

  return (
    <section className="max-w-3xl">
      <form onSubmit={create} className="mb-6 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <input value={title} onChange={(ev) => setTitle(ev.target.value)} placeholder="Titre de la nouvelle page…" aria-label="Titre de la nouvelle page" maxLength={120} className={field} />
        <select value={template} onChange={(ev) => setTemplate(ev.target.value)} aria-label="Modèle" className={`${field} sm:w-56`}>
          <option value="">Page vide</option>
          {templates.map((t) => <option key={t.id} value={t.id} title={t.description}>{t.title}</option>)}
        </select>
        <button type="submit" className={btnPrimary} disabled={!title.trim() && !template}><Plus className="size-4" aria-hidden /> Créer</button>
      </form>
      {error && <div className="mb-4"><Notice>{error}</Notice></div>}
      {docs.length === 0 ? (
        <p className="text-sm text-muted">Aucune page. Commence par un « Brief » : choisis le modèle et clique sur « Créer ».</p>
      ) : (
        <ol className="border-t border-text/80">
          {docs.map((d, i) => (
            <li
              key={d.slug}
              draggable
              onDragStart={() => setDragging(d.slug)}
              onDragOver={(ev) => dragging && ev.preventDefault()}
              onDrop={() => {
                if (!dragging || dragging === d.slug) return;
                const order = docs.map((x) => x.slug).filter((s) => s !== dragging);
                order.splice(order.indexOf(d.slug), 0, dragging);
                setDragging(null);
                reorder(order);
              }}
              className={`group flex items-center gap-3 border-b border-border py-3 ${dragging === d.slug ? "opacity-50" : ""}`}
            >
              <FileText className="size-4 shrink-0 text-muted" aria-hidden />
              <Link href={`/projets/${project}/docs/${d.slug}`} className="min-w-0 flex-1 text-[15px] hover:text-accent-text">{d.title}</Link>
              <span className="label hidden text-muted sm:inline">{d.updated ?? ""}</span>
              <span className="flex shrink-0 opacity-60 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <button type="button" className={iconBtn} aria-label={`Monter « ${d.title} »`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-4" /></button>
                <button type="button" className={iconBtn} aria-label={`Descendre « ${d.title} »`} disabled={i === docs.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-4" /></button>
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-3 text-xs text-muted">Pages dans <code>projects/{project}/docs/</code> · glisser-déposer ou ↑ ↓ pour réordonner · liens entre pages : <code>[[nom]]</code>.</p>
    </section>
  );
}

/**
 * « Supprimer le projet » : confirmation qui dit exactement ce qui sera effacé, et rappelle qu'on peut
 * plutôt archiver (Statut → Abandonné). Suppression définitive du dossier projects/<nom>/.
 */
function DeleteProject({ slug, title, version, onError }: { slug: string; title: string; version: () => string; onError: (t: string) => void }) {
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const [info, setInfo] = useState<{ docs: number; images: number; files: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setAsk(true);
    try {
      setInfo(await apiJson(`/api/entries/project/${slug}?contenu=1`));
    } catch {
      setInfo(null);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      const r = await apiJson<{ title: string }>(`/api/entries/project/${slug}?version=${encodeURIComponent(version())}`, "DELETE");
      router.push(`/projets/liste?supprime=${encodeURIComponent(r.title)}`);
      router.refresh();
    } catch (err) {
      setBusy(false);
      setAsk(false);
      onError(err instanceof Error ? err.message : String(err));
    }
  };
  if (!ask) {
    return (
      <button type="button" onClick={open} className={`${btnGhost} hover:text-rose-700 dark:hover:text-rose-400`}>
        <Trash2 className="size-3.5" aria-hidden /> Supprimer le projet…
      </button>
    );
  }
  return (
    <div role="alertdialog" aria-label="Confirmer la suppression" className="w-full bg-rose-500/10 p-4 text-sm">
      <p className="font-medium">Supprimer définitivement « {title} » ?</p>
      <p className="mt-2 text-muted">
        Le dossier <code>projects/{slug}/</code> sera effacé de ton ordinateur
        {info ? <> : le README{info.docs ? `, ${info.docs} page${info.docs > 1 ? "s" : ""} de docs` : ""}{info.images ? `, ${info.images} image${info.images > 1 ? "s" : ""}` : ""} ({info.files} fichier{info.files > 1 ? "s" : ""} en tout)</> : null}.
        Les tâches liées restent dans TACHES.md. Si le projet avait déjà été envoyé avec « Sauvegarder », une copie reste dans l&apos;historique GitHub.
      </p>
      <p className="mt-2 text-muted">Pour seulement le ranger (récupérable), choisis plutôt <strong>Statut → Abandonné</strong>.</p>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" className={btnGhost} onClick={() => setAsk(false)} autoFocus>Annuler</button>
        <button type="button" className={btnDanger} disabled={busy} onClick={remove}>{busy ? "Suppression…" : "Supprimer définitivement"}</button>
      </div>
    </div>
  );
}
