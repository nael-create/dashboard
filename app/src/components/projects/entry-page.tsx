"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MoreHorizontal } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiJson, isConflict } from "@/lib/client-api";
import { btnDanger, btnGhost } from "@/components/ui/forms";
import { Notice } from "@/components/ui/notice";
import { DatePopover } from "@/components/ui/date-popover";
import { StarButton } from "@/components/favorites/favorites-context";
import { TASKS_EVENT, useTasks } from "@/components/tasks/use-tasks";
import { deadlineChip, deadlinePresets, isIsoDate } from "@/lib/fr-dates";
import { entryTasks } from "@/lib/tasks-view";
import { DailyNotes, type SaveNote } from "./daily-notes";
import { DocsBlock, type DocListItem, type TemplateItem } from "./docs-block";
import { EntryTasks } from "./entry-tasks";

export interface EntryData {
  kind: "project" | "area";
  slug: string;
  version: string;
  fields: Record<string, string>;
  notes: { date: string; text: string; done: string[] }[];
  extra: [string, string][];
  legacy: boolean;
}

const STATUS_SEGMENTS = [["idea", "idée"], ["active", "en cours"], ["paused", "en pause"], ["done", "terminé"]] as const;
const PRIORITIES = ["P1", "P2", "P3"] as const;

/**
 * Page unique d'un projet ou d'un domaine (sans onglets) : en-tête (titre modifiable sur place,
 * deadline lisible, statut, priorité, avancement), tâches à gauche, notes du jour à droite, documents
 * repliés en bas. Sur téléphone : tâches, puis notes, puis documents. Un domaine n'a ni deadline ni statut.
 */
export function EntryPage({
  initial, docs, templates, slugs, today, docsApi, focusTask = false,
}: {
  initial: EntryData; docs: DocListItem[] | null; templates: TemplateItem[]; slugs: string[]; today: string;
  docsApi: { api: string; hrefBase: string } | null; focusTask?: boolean;
}) {
  const router = useRouter();
  const [e, setE] = useState(initial);
  const [error, setError] = useState<{ text: string; conflict: boolean } | null>(null);
  const [ask, setAsk] = useState<"done" | "dropped" | "delete" | null>(null);
  const versionRef = useRef(initial.version);
  const isProject = e.kind === "project";
  const base = `/api/entries/${e.kind}/${e.slug}`;
  const tasks = useTasks();

  const reload = useCallback(async () => {
    const fresh = await apiJson<EntryData>(base);
    versionRef.current = fresh.version;
    setE(fresh);
  }, [base]);
  // Une tâche cochée inscrit « ✓ … » dans la note du jour : on relit le README.
  useEffect(() => {
    const on = () => reload().catch(() => {});
    window.addEventListener(TASKS_EVENT, on);
    return () => window.removeEventListener(TASKS_EVENT, on);
  }, [reload]);

  const patch = async (change: Record<string, unknown>, confirmArchive = false) => {
    const res = await apiJson<{ version: string; archivedTo: string | null }>(base, "PATCH", { version: versionRef.current, change, confirmArchive });
    versionRef.current = res.version;
    return res;
  };

  const setFields = async (fields: Record<string, string>, confirmArchive = false) => {
    setError(null);
    const before = e.fields;
    setE((x) => ({ ...x, fields: { ...x.fields, ...fields } }));
    try {
      const res = await patch({ op: "fields", fields }, confirmArchive);
      if (res.archivedTo) {
        router.push(`/projets/liste?archive=${encodeURIComponent(res.archivedTo)}`);
        router.refresh();
        return;
      }
      await reload();
    } catch (err) {
      setE((x) => ({ ...x, fields: before }));
      setError({ text: err instanceof Error ? err.message : String(err), conflict: isConflict(err) });
    }
  };

  /** Note d'un jour ; sur un conflit (fichier modifié entre-temps, ex. tâche cochée), on relit et on réessaie une fois. */
  const saveNote: SaveNote = useCallback(async (date, text) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await apiJson<{ version: string }>(base, "PATCH", { version: versionRef.current, change: { op: "note", date, text } });
        versionRef.current = res.version;
        setE((x) => {
          const notes = x.notes.filter((n) => n.date !== date);
          const cur = x.notes.find((n) => n.date === date);
          return { ...x, notes: [...notes, { date, text, done: cur?.done ?? [] }] };
        });
        return null;
      } catch (err) {
        if (isConflict(err) && attempt === 0) {
          const fresh = await apiJson<EntryData>(base).catch(() => null);
          if (fresh) versionRef.current = fresh.version;
          continue;
        }
        return err instanceof Error ? err.message : String(err);
      }
    }
    return "Non enregistré.";
  }, [base]);

  const title = e.fields.title && e.fields.title !== "TODO: fill in" ? e.fields.title : e.slug;
  const progress = tasks.state ? entryTasks(tasks.state.tasks, e.slug, tasks.state.today).progress : null;

  return (
    <article>
      <Link href={isProject ? "/projets/liste" : "/projets/domaines"} className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-accent-text">
        <ArrowLeft className="size-4" aria-hidden /> {isProject ? "Projets" : "Domaines"}
      </Link>
      {error && (
        <div className="mb-4">
          <Notice action={error.conflict ? <button type="button" className="text-sm font-medium underline" onClick={() => { setError(null); reload(); }}>Recharger</button> : undefined}>
            {error.text}
          </Notice>
        </div>
      )}

      <header className="rise border-t border-text/80 pt-5">
        <div className="label mb-1 flex items-center justify-between text-muted">
          {isProject ? "projet" : "domaine"}
          <span className="flex items-center gap-1">
            {isProject && <StarButton type="project" refId={`project:${e.slug}`} title={title} />}
            {isProject && <MoreMenu onDrop={() => setAsk("dropped")} onDelete={() => setAsk("delete")} />}
          </span>
        </div>
        <InlineTitle value={title} onSave={(v) => setFields({ title: v })} />

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          {isProject && <DeadlineChip value={isIsoDate(e.fields.deadline) ? e.fields.deadline : null} today={today} onPick={(d) => setFields({ deadline: d ?? "" })} />}
          {isProject && (
            <div role="radiogroup" aria-label="Statut" className="inline-flex border border-border">
              {STATUS_SEGMENTS.map(([v, l]) => (
                <button key={v} type="button" role="radio" aria-checked={e.fields.status === v}
                  onClick={() => { if (e.fields.status === v) return; if (v === "done") setAsk("done"); else setFields({ status: v }); }}
                  className={`px-3 py-1 text-[12px] lowercase transition-colors ${e.fields.status === v ? "bg-text text-bg" : "text-muted hover:text-text"}`}>
                  {l}
                </button>
              ))}
            </div>
          )}
          <div role="radiogroup" aria-label="Priorité" className="inline-flex gap-1">
            {PRIORITIES.map((p) => (
              <button key={p} type="button" role="radio" aria-checked={e.fields.priority === p}
                onClick={() => e.fields.priority !== p && setFields({ priority: p })}
                className={`rounded-full border px-2.5 py-0.5 text-[12px] tabular-nums transition-colors ${e.fields.priority === p ? "border-accent bg-accent text-white" : "border-border text-muted hover:border-text hover:text-text"}`}>
                {p}
              </button>
            ))}
          </div>
          {progress && progress.total > 0 && (
            <div className="min-w-40 flex-1 sm:max-w-56">
              <span className="text-[13px] tabular-nums">{progress.done} / {progress.total} tâches</span>
              <span className="mt-1 block h-0.5 bg-border" aria-hidden><span className="block h-0.5 bg-accent transition-[width]" style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} /></span>
            </div>
          )}
        </div>

        {(ask === "done" || ask === "dropped") && (
          <div role="alertdialog" aria-label="Confirmer l'archivage" className="mt-4 bg-amber-500/10 p-3 text-sm">
            <p className="mb-2">Marquer ce projet « {ask === "done" ? "terminé" : "abandonné"} » : son dossier sera déplacé tel quel dans <code>archive/</code> et il disparaîtra des listes. Continuer ?</p>
            <div className="flex justify-end gap-2">
              <button type="button" className={btnGhost} onClick={() => setAsk(null)} autoFocus>Annuler</button>
              <button type="button" className={btnDanger} onClick={async () => { const s = ask; setAsk(null); await setFields({ status: s }, true); }}>
                {ask === "done" ? "Terminer et archiver" : "Abandonner et archiver"}
              </button>
            </div>
          </div>
        )}
        {ask === "delete" && <DeleteProject slug={e.slug} title={title} version={() => versionRef.current} onCancel={() => setAsk(null)} onError={(t) => { setAsk(null); setError({ text: t, conflict: true }); }} />}
      </header>

      {e.legacy && (
        <div className="mt-6"><Notice>Ce fichier est encore à l&apos;ancien format (sections, jalons ou journal). Lance la migration décrite dans <code>app/README.md</code> pour le convertir sans rien perdre.</Notice></div>
      )}

      <div className="mt-10 grid gap-12 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7">
          <EntryTasks api={tasks} slug={e.slug} slugs={slugs} autoFocus={focusTask} />
        </div>
        <div className="min-w-0 lg:col-span-5">
          <DailyNotes notes={e.notes} today={today} save={saveNote} />
          {e.extra.length > 0 && (
            <div className="mt-10 space-y-6 border-t border-border pt-6">
              {e.extra.map(([name, text]) => (
                <section key={name}>
                  <h3 className="label mb-1 text-muted">{name}</h3>
                  <pre className="whitespace-pre-wrap font-sans text-sm text-muted">{text}</pre>
                </section>
              ))}
              <p className="text-xs text-muted">Sections écrites à la main : modifiables dans le fichier.</p>
            </div>
          )}
        </div>
      </div>

      {docsApi && docs && (
        <div className="mt-14">
          <DocsBlock api={docsApi.api} hrefBase={docsApi.hrefBase} initial={docs} templates={templates} />
        </div>
      )}

      <footer className="mt-10 border-t border-border pt-4">
        <p className="text-xs text-muted">Source : <code className="break-all">{isProject ? "projects" : "areas"}/{e.slug}/README.md</code> · tâches dans <code>TACHES.md</code> (#{e.slug})</p>
      </footer>
    </article>
  );
}

function InlineTitle({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const cls = "block w-full text-[clamp(2.25rem,5.5vw,4.5rem)] font-light leading-[1.05] tracking-[-0.04em]";
  if (!editing) {
    return (
      <h1>
        <button type="button" onClick={() => { setDraft(value); setEditing(true); }} className={`${cls} text-left hover:text-accent-text`} title="Cliquer pour renommer">
          {value}
        </button>
      </h1>
    );
  }
  const save = () => {
    setEditing(false);
    const v = draft.replace(/\s+/g, " ").trim();
    if (v && v !== value) onSave(v);
  };
  return (
    <input
      value={draft} autoFocus maxLength={200} aria-label="Titre"
      onChange={(ev) => setDraft(ev.target.value)}
      onBlur={save}
      onKeyDown={(ev) => {
        if (ev.key === "Enter") { ev.preventDefault(); save(); }
        if (ev.key === "Escape") setEditing(false);
      }}
      className={`${cls} border-b border-text bg-transparent outline-none`}
    />
  );
}

function DeadlineChip({ value, today, onPick }: { value: string | null; today: string; onPick: (d: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const chip = value ? deadlineChip(value, today) : null;
  return (
    <span className="relative">
      <button
        type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open}
        aria-label={chip ? `Deadline : ${chip.text}. Changer` : "Ajouter une deadline"}
        className={chip
          ? `rounded-full border px-3 py-1 text-[13px] transition-colors ${chip.tone === "overdue" ? "border-accent bg-accent text-white" : chip.tone === "soon" ? "border-accent text-accent-text" : "border-text/60 hover:border-text"}`
          : "rounded-full border border-dashed border-border px-3 py-1 text-[13px] text-muted transition-colors hover:border-text hover:text-text"}
      >
        {chip ? chip.text : "+ deadline"}
      </button>
      {open && <DatePopover label="Deadline du projet" presets={deadlinePresets(today)} value={value} today={today} onPick={(d) => { setOpen(false); onPick(d); }} onClose={() => setOpen(false)} />}
    </span>
  );
}

function MoreMenu({ onDrop, onDelete }: { onDrop: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    ref.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
    const down = (ev: MouseEvent) => { if (ref.current && !ref.current.contains(ev.target as Node)) setOpen(false); };
    const key = (ev: KeyboardEvent) => { if (ev.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open]);
  const item = "block w-full px-3 py-2 text-left text-sm normal-case tracking-normal transition-colors hover:bg-surface-2 focus-visible:bg-surface-2";
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Plus d'actions"
        className="grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text">
        <MoreHorizontal className="size-4" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1 min-w-52 border border-border bg-bg py-1 text-text shadow-lg">
          <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); onDrop(); }}>Abandonner…</button>
          <button type="button" role="menuitem" className={`${item} text-rose-700 dark:text-rose-400`} onClick={() => { setOpen(false); onDelete(); }}>Supprimer le projet…</button>
        </div>
      )}
    </div>
  );
}

/**
 * Confirmation de suppression : dit exactement ce qui sera effacé et rappelle qu'on peut plutôt
 * abandonner le projet (rangé dans archive/). Suppression définitive du dossier projects/<nom>/.
 */
function DeleteProject({ slug, title, version, onCancel, onError }: { slug: string; title: string; version: () => string; onCancel: () => void; onError: (t: string) => void }) {
  const router = useRouter();
  const [info, setInfo] = useState<{ docs: number; images: number; files: number } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { apiJson<{ docs: number; images: number; files: number }>(`/api/entries/project/${slug}?contenu=1`).then(setInfo, () => setInfo(null)); }, [slug]);
  const remove = async () => {
    setBusy(true);
    try {
      const r = await apiJson<{ title: string }>(`/api/entries/project/${slug}?version=${encodeURIComponent(version())}`, "DELETE");
      router.push(`/projets/liste?supprime=${encodeURIComponent(r.title)}`);
      router.refresh();
    } catch (err) {
      setBusy(false);
      onError(err instanceof Error ? err.message : String(err));
    }
  };
  return (
    <div role="alertdialog" aria-label="Confirmer la suppression" className="mt-4 bg-rose-500/10 p-4 text-sm">
      <p className="font-medium">Supprimer définitivement « {title} » ?</p>
      <p className="mt-2 text-muted">
        Le dossier <code>projects/{slug}/</code> sera effacé de ton ordinateur
        {info ? <> : le README{info.docs ? `, ${info.docs} document${info.docs > 1 ? "s" : ""}` : ""}{info.images ? `, ${info.images} image${info.images > 1 ? "s" : ""}` : ""} ({info.files} fichier{info.files > 1 ? "s" : ""} en tout)</> : null}.
        Les tâches liées restent dans TACHES.md. Si le projet avait déjà été envoyé avec « Sauvegarder », une copie reste dans l&apos;historique GitHub.
      </p>
      <p className="mt-2 text-muted">Pour seulement le ranger (récupérable), choisis plutôt <strong>… → Abandonner</strong>.</p>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" className={btnGhost} onClick={onCancel} autoFocus>Annuler</button>
        <button type="button" className={btnDanger} disabled={busy} onClick={remove}>{busy ? "Suppression…" : "Supprimer définitivement"}</button>
      </div>
    </div>
  );
}
