"use client";

import { Check, CornerDownLeft, GripVertical, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { field } from "@/components/ui/forms";
import { Notice } from "@/components/ui/notice";
import { DatePopover } from "@/components/ui/date-popover";
import type { TasksApi } from "@/components/tasks/use-tasks";
import { taskDateChip, taskPresets } from "@/lib/fr-dates";
import { parseTaskInput } from "@/lib/task-input";
import type { Task } from "@/lib/tasks-core";
import { entryTasks } from "@/lib/tasks-view";

const UNDO_MS = 5000;

/**
 * Colonne « tâches » d'un projet / domaine : une seule saisie (« vendredi », « demain », « 15/12 »,
 * « dans 3 jours » deviennent l'échéance ; sinon la tâche reste sans date), puis la liste : en retard,
 * datées, sans date (ordre réglable : glisser-déposer ou Alt+↑/↓), et « terminées (n) » repliées.
 * Supprimer : action discrète au survol, avec « Annuler » pendant 5 s (pas de fenêtre de confirmation).
 */
export function EntryTasks({ api, slug, slugs, autoFocus }: { api: TasksApi; slug: string; slugs: string[]; autoFocus?: boolean }) {
  const s = api.state;
  const [undo, setUndo] = useState<Task | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const remove = async (t: Task) => {
    const ok = await api.run({ action: "delete", id: t.id }, (ts) => ts.filter((x) => x.id !== t.id));
    if (!ok) return;
    if (timer.current) clearTimeout(timer.current);
    setUndo(t);
    timer.current = setTimeout(() => setUndo(null), UNDO_MS);
  };
  const restore = async () => {
    if (!undo) return;
    const t = undo;
    setUndo(null);
    if (timer.current) clearTimeout(timer.current);
    await api.run({ action: "restore", task: { ...t } }, (ts) => [...ts, t].sort((a, b) => a.line - b.line));
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (!s) return <p className="text-sm text-muted">Chargement des tâches…</p>;
  const { open, closed } = entryTasks(s.tasks, slug, s.today);
  const group = (t: Task) => t.date ?? "";

  return (
    <section aria-labelledby={`taches-${slug}`}>
      <h2 id={`taches-${slug}`} className="section-title mb-4">tâches</h2>
      <AddTask api={api} slug={slug} slugs={slugs} today={s.today} autoFocus={autoFocus} />
      {api.error && <div className="mt-3"><Notice>{api.error}</Notice></div>}

      <ul className="mt-4 border-t border-text/80" aria-label="Tâches à faire">
        {open.map((t) => (
          <TaskItem
            key={t.id} task={t} api={api} today={s.today} onDelete={() => remove(t)}
            dragging={dragging === t.id}
            onDragStart={() => setDragging(t.id)}
            onDragEnd={() => setDragging(null)}
            canDrop={(id) => { const src = open.find((x) => x.id === id); return !!src && src.id !== t.id && group(src) === group(t); }}
            onDropBefore={(id) => { setDragging(null); api.run({ action: "place", id, before: t.id }); }}
            draggingId={dragging}
          />
        ))}
      </ul>
      {open.length === 0 && <p className="py-4 text-sm text-muted">{closed.length ? "Tout est fait." : "Aucune tâche pour l'instant : écris la première ci-dessus."}</p>}

      {closed.length > 0 && (
        <details className="mt-6">
          <summary className="label cursor-pointer text-muted hover:text-text">terminées ({closed.length})</summary>
          <ul className="mt-2">
            {closed.slice(0, 100).map((t) => <TaskItem key={t.id} task={t} api={api} today={s.today} onDelete={() => remove(t)} />)}
          </ul>
        </details>
      )}

      <div aria-live="polite">
        {undo && (
          <div className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center justify-between gap-4 bg-text px-4 py-3 text-sm text-bg shadow-lg sm:left-auto sm:right-6 sm:mx-0">
            <span>Tâche supprimée</span>
            <button type="button" onClick={restore} className="font-medium uppercase tracking-[0.04em] underline underline-offset-4">Annuler</button>
          </div>
        )}
      </div>
    </section>
  );
}

function AddTask({ api, slug, slugs, today, autoFocus }: { api: TasksApi; slug: string; slugs: string[]; today: string; autoFocus?: boolean }) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
  const parsed = useMemo(() => (value.trim() ? parseTaskInput(value, today, slugs, null) : null), [value, today, slugs]);

  const submit = async () => {
    if (!parsed?.title) return;
    const ok = await api.run({
      action: "add",
      task: {
        title: parsed.title, date: parsed.date, time: parsed.time, duration: parsed.duration,
        project: parsed.project ?? slug, reminder: parsed.reminder, recurrence: parsed.recurrence,
      },
    });
    if (ok) setValue("");
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); submit(); }
            if (e.key === "Escape") setValue("");
          }}
          placeholder="Ajouter une tâche…"
          aria-label="Ajouter une tâche"
          aria-describedby={`aide-${slug}`}
          maxLength={300}
          className={field}
        />
        <button type="button" onClick={submit} disabled={!parsed?.title || api.busy} aria-label="Ajouter la tâche"
          className="grid size-[42px] shrink-0 place-items-center border border-border text-muted transition-colors hover:border-text hover:text-text disabled:opacity-40">
          <CornerDownLeft className="size-4" aria-hidden />
        </button>
      </div>
      <p id={`aide-${slug}`} className="mt-1.5 min-h-5 text-[12px] text-muted" aria-live="polite">
        {parsed?.title
          ? <>« {parsed.title} » · {parsed.date ? <span className="text-accent-text">{taskDateChip(parsed.date, today).text}{parsed.time ? ` ${parsed.time}` : ""}</span> : "sans date"}{parsed.ambiguous ? " · date incertaine, gardée dans le titre" : ""}</>
          : <>Une date dans le texte devient l&apos;échéance : « vendredi », « demain », « 15/12 », « dans 3 jours ».</>}
      </p>
    </div>
  );
}

function TaskItem({
  task: t, api, today, onDelete, dragging, draggingId, onDragStart, onDragEnd, canDrop, onDropBefore,
}: {
  task: Task; api: TasksApi; today: string; onDelete: () => void;
  dragging?: boolean; draggingId?: string | null; onDragStart?: () => void; onDragEnd?: () => void;
  canDrop?: (id: string) => boolean; onDropBefore?: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(t.title);
  const [picking, setPicking] = useState(false);
  const done = t.status !== "todo";
  const chip = t.date ? taskDateChip(t.date, today) : null;
  const sortable = !!onDropBefore && !done;

  const toggle = () => {
    const status = done ? "todo" : "done";
    api.run({ action: "status", id: t.id, status }, (ts) => ts.map((x) => (x.id === t.id ? { ...x, status, closedOn: status === "todo" ? null : today } : x)));
  };
  const setDate = (date: string | null) => {
    setPicking(false);
    const patch = date ? { date } : { date: null, time: null, recurrence: null, reminder: null };
    api.run({ action: "update", id: t.id, patch }, (ts) => ts.map((x) => (x.id === t.id ? { ...x, ...patch } : x)));
  };
  const saveTitle = async () => {
    const v = draft.replace(/\s+/g, " ").trim();
    setEditing(false);
    if (!v || v === t.title) { setDraft(t.title); return; }
    await api.run({ action: "update", id: t.id, patch: { title: v } }, (ts) => ts.map((x) => (x.id === t.id ? { ...x, title: v } : x)));
  };

  return (
    <li
      id={`task-${t.id}`}
      draggable={sortable && !editing}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", t.id); onDragStart?.(); }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => { if (draggingId && canDrop?.(draggingId)) e.preventDefault(); }}
      onDrop={(e) => { e.preventDefault(); if (draggingId && canDrop?.(draggingId)) onDropBefore?.(draggingId); }}
      onKeyDown={(e) => {
        if (!sortable || editing || !e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
        e.preventDefault();
        api.run({ action: "move", id: t.id, dir: e.key === "ArrowUp" ? -1 : 1 }).then(() =>
          requestAnimationFrame(() => document.querySelector<HTMLElement>(`#task-${t.id} [data-check]`)?.focus()));
      }}
      className={`group relative flex items-center gap-2 border-b border-border py-2.5 ${dragging ? "opacity-40" : ""}`}
    >
      {sortable && (
        <span className="-ml-1 hidden cursor-grab text-muted/50 group-hover:text-muted sm:block" aria-hidden title="Glisser pour réordonner (ou Alt+↑/↓)">
          <GripVertical className="size-4" />
        </span>
      )}
      <button
        type="button" role="checkbox" data-check aria-checked={t.status === "done"} onClick={toggle}
        aria-label={`${done ? "Rouvrir" : "Cocher"} « ${t.title} »`}
        aria-keyshortcuts={sortable ? "Alt+ArrowUp Alt+ArrowDown" : undefined}
        className={`grid size-[18px] shrink-0 place-items-center border transition-colors ${t.status === "done" ? "border-accent bg-accent text-white" : "border-text/60 hover:border-accent"}`}
      >
        {t.status === "done" && <Check className="size-3" strokeWidth={3} aria-hidden />}
      </button>

      {editing ? (
        <input
          value={draft} autoFocus maxLength={300} aria-label="Titre de la tâche"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); saveTitle(); }
            if (e.key === "Escape") { setDraft(t.title); setEditing(false); }
          }}
          className="min-w-0 flex-1 border-b border-text bg-transparent py-0.5 text-[15px] outline-none"
        />
      ) : (
        <button type="button" onClick={() => { setDraft(t.title); setEditing(true); }} title="Modifier"
          className={`min-w-0 flex-1 truncate py-0.5 text-left text-[15px] ${done ? "text-muted line-through" : "hover:text-accent-text"}`}>
          {t.title}
          {t.status === "dropped" && <span className="label ml-2 no-underline">abandonnée</span>}
        </button>
      )}

      {!done && (
        <span className="relative shrink-0">
          <button
            type="button"
            onClick={() => setPicking((p) => !p)}
            aria-haspopup="dialog" aria-expanded={picking}
            aria-label={chip ? `Échéance : ${chip.text}. Changer` : "Ajouter une date"}
            className={chip
              ? `rounded-full border px-2.5 py-0.5 text-[12px] tabular-nums transition-colors ${chip.tone === "overdue" ? "border-accent bg-accent-soft text-accent-text" : "border-border text-muted hover:border-text hover:text-text"}`
              : "rounded-full px-2.5 py-0.5 text-[12px] text-muted opacity-0 transition-opacity hover:text-text focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-60"}
          >
            {chip ? `${chip.text}${t.time ? ` · ${t.time}` : ""}` : "+ date"}
          </button>
          {picking && <DatePopover label="Date de la tâche" align="right" presets={taskPresets(today)} value={t.date} today={today} onPick={setDate} onClose={() => setPicking(false)} />}
        </span>
      )}
      {done && t.closedOn && <span className="label shrink-0 text-muted">{taskDateChip(t.closedOn, today).text.replace(/^en retard de (\d+) j$/, "il y a $1 j")}</span>}

      <button type="button" onClick={onDelete} aria-label={`Supprimer « ${t.title} »`}
        className="grid size-7 shrink-0 place-items-center rounded-full text-muted opacity-0 transition-opacity hover:text-rose-700 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:text-rose-400 [@media(hover:none)]:opacity-60">
        <Trash2 className="size-3.5" aria-hidden />
      </button>
    </li>
  );
}
