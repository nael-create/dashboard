"use client";

import Link from "next/link";
import { AlarmClock, Check, GripVertical, MoreHorizontal, Repeat } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { addDays, formatDuration, type Task } from "@/lib/tasks-core";
import { relativeDay } from "@/lib/task-format";
import { btnDanger, btnGhost, btnPrimary, field } from "@/components/ui/forms";
import type { ProjectRef } from "./task-quick-add";
import type { TasksApi } from "./use-tasks";

const DRAG_TYPE = "application/x-dashboard-task";

/**
 * Une tâche : case à cocher, heure, titre, projet ; actions au survol (ou appui long / « ⋯ » sur téléphone).
 * Clavier : Espace coche, ⌥/Ctrl + ↑/↓ déplace dans la journée. Glisser-déposer entre tâches du même jour.
 */
export function TaskRow({
  task, api, today, projects, showDate = false, overdue = false, draggable = true, hideProject = false,
}: {
  task: Task; api: TasksApi; today: string; projects: ProjectRef[];
  showDate?: boolean; overdue?: boolean; draggable?: boolean; hideProject?: boolean;
}) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dropHint, setDropHint] = useState(false);
  const rowRef = useRef<HTMLLIElement>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = task.status !== "todo";
  const project = task.project ? projects.find((p) => p.slug === task.project) : null;

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !rowRef.current?.contains(e.target as Node) && setMenu(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);

  const setStatus = (status: Task["status"]) =>
    api.run({ action: "status", id: task.id, status }, (ts) => ts.map((t) => (t.id === task.id ? { ...t, status, closedOn: status === "todo" ? null : today } : t)));
  const toggle = () => setStatus(done ? "todo" : "done");
  const reschedule = (date: string) => {
    setMenu(false);
    return api.run({ action: "update", id: task.id, patch: { date } }, (ts) => ts.map((t) => (t.id === task.id ? { ...t, date } : t)));
  };
  const move = (dir: -1 | 1) => api.run({ action: "move", id: task.id, dir }).then(() => requestAnimationFrame(() => document.getElementById(`task-${task.id}`)?.focus()));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === " ") {
      e.preventDefault();
      toggle();
    } else if ((e.altKey || e.ctrlKey || e.metaKey) && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      move(e.key === "ArrowUp" ? -1 : 1);
    } else if (e.key === "Enter") {
      setEditing(true);
    }
  };

  if (editing) return <TaskEditor task={task} api={api} projects={projects} onClose={() => setEditing(false)} />;

  return (
    <li
      ref={rowRef}
      id={`task-${task.id}`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label={`${task.title}${task.time ? `, ${task.time}` : ""}${done ? ", faite" : ""}`}
      draggable={draggable && !done}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ id: task.id, date: task.date }));
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        if (!draggable || done || !e.dataTransfer.types.includes(DRAG_TYPE)) return;
        e.preventDefault();
        setDropHint(true);
      }}
      onDragLeave={() => setDropHint(false)}
      onDrop={(e) => {
        setDropHint(false);
        const raw = e.dataTransfer.getData(DRAG_TYPE);
        if (!raw) return;
        const src = JSON.parse(raw) as { id: string; date: string };
        e.preventDefault();
        if (src.id === task.id) return;
        if (src.date !== task.date) api.run({ action: "update", id: src.id, patch: { date: task.date } });
        else api.run({ action: "place", id: src.id, before: task.id });
      }}
      onTouchStart={() => {
        pressTimer.current = setTimeout(() => setMenu(true), 550);
      }}
      onTouchEnd={() => pressTimer.current && clearTimeout(pressTimer.current)}
      onTouchMove={() => pressTimer.current && clearTimeout(pressTimer.current)}
      className={`group relative flex items-start gap-3 border-b border-border py-2.5 outline-none focus-visible:bg-surface-2 ${dropHint ? "border-t-2 border-t-accent" : ""} ${done ? "opacity-60" : ""}`}
    >
      {draggable && !done && (
        <GripVertical className="mt-1 hidden size-3.5 shrink-0 cursor-grab text-muted/50 opacity-0 transition-opacity group-hover:opacity-100 sm:block" aria-hidden />
      )}
      <button
        type="button"
        role="checkbox"
        aria-checked={task.status === "done"}
        aria-label={done ? `Remettre « ${task.title} » à faire` : `Cocher « ${task.title} »`}
        onClick={toggle}
        className={`mt-0.5 grid size-[18px] shrink-0 place-items-center border transition-colors ${
          task.status === "done" ? "border-accent bg-accent text-white" : "border-text/60 hover:border-accent"
        }`}
      >
        {task.status === "done" && <Check className="size-3" strokeWidth={3} aria-hidden />}
      </button>

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[15px] leading-snug">
          {task.time && <span className="tabular-nums text-[13px] text-muted">{task.time}</span>}
          <span className={done ? "line-through" : ""}>{task.title}</span>
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-muted empty:hidden">
          {showDate && <span className={overdue ? "text-rose-700 dark:text-rose-400" : ""}>{relativeDay(task.date, today)}</span>}
          {task.duration && <span>{formatDuration(task.duration)}</span>}
          {task.reminder !== null && (
            <span className="inline-flex items-center gap-1" title="Rappel par e-mail (au passage horaire suivant)">
              <AlarmClock className="size-3" aria-hidden />{task.reminder === 0 ? "à l'heure" : `${task.reminder} min avant`}
            </span>
          )}
          {task.recurrence && <Repeat className="size-3" aria-label="Récurrente" />}
          {task.status === "dropped" && <span>abandonnée</span>}
          {project && !hideProject && (
            <Link href={`/projets/${project.slug}`} className="label rounded-full border border-border px-2 py-px text-[10px] hover:border-text hover:text-text">
              {project.title}
            </Link>
          )}
          {!project && task.project && !hideProject && <span className="label text-[10px]">#{task.project}</span>}
        </p>
        {overdue && !done && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            <button type="button" onClick={() => reschedule(today)} className={`${btnGhost} border border-border !px-2.5 !py-1 text-[11px]`}>Reporter à aujourd&apos;hui</button>
            <button type="button" onClick={() => reschedule(addDays(today, 1))} className={`${btnGhost} border border-border !px-2.5 !py-1 text-[11px]`}>Reporter à demain</button>
            <button type="button" onClick={() => setStatus("dropped")} className={`${btnGhost} !px-2.5 !py-1 text-[11px]`}>Abandonner</button>
          </div>
        )}
        {confirmDelete && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm" role="alert">
            Supprimer cette tâche ?
            <button type="button" className={btnDanger} onClick={() => api.run({ action: "delete", id: task.id }, (ts) => ts.filter((t) => t.id !== task.id))}>Supprimer</button>
            <button type="button" className={btnGhost} onClick={() => setConfirmDelete(false)}>Annuler</button>
          </div>
        )}
      </div>

      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenu((m) => !m)}
          aria-haspopup="menu"
          aria-expanded={menu}
          aria-label={`Actions pour « ${task.title} »`}
          className="grid size-7 place-items-center rounded-full text-muted opacity-60 transition hover:bg-surface-2 hover:text-text focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </button>
        {menu && (
          <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-56 border border-border bg-surface py-1 text-sm shadow-lg">
            {!done && (
              <>
                <MenuItem onClick={() => reschedule(today)}>Aujourd&apos;hui</MenuItem>
                <MenuItem onClick={() => reschedule(addDays(today, 1))}>Demain</MenuItem>
                <label className="flex items-center justify-between gap-2 px-3 py-1.5 text-muted">
                  <span>Choisir une date</span>
                  <input
                    type="date"
                    defaultValue={task.date}
                    onChange={(e) => e.target.value && reschedule(e.target.value)}
                    className="w-[8.5rem] border border-border bg-surface px-1 py-0.5 text-[12px] text-text"
                    aria-label="Nouvelle date"
                  />
                </label>
                <hr className="my-1 border-border" />
              </>
            )}
            <MenuItem onClick={() => { setMenu(false); setEditing(true); }}>Modifier</MenuItem>
            {!done && <MenuItem onClick={() => { setMenu(false); setStatus("dropped"); }}>Abandonner</MenuItem>}
            <MenuItem onClick={() => { setMenu(false); setConfirmDelete(true); }} danger>Supprimer…</MenuItem>
          </div>
        )}
      </div>
    </li>
  );
}

function MenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className={`block w-full px-3 py-1.5 text-left hover:bg-surface-2 ${danger ? "text-rose-700 dark:text-rose-400" : ""}`}>
      {children}
    </button>
  );
}

const REMINDERS: { value: string; label: string }[] = [
  { value: "", label: "Pas de rappel propre" },
  { value: "0", label: "À l'heure" },
  { value: "15", label: "15 min avant" },
  { value: "30", label: "30 min avant" },
  { value: "60", label: "1 h avant" },
];

/** Modification d'une tâche : titre, date, heure, durée, projet, rappel. */
function TaskEditor({ task, api, projects, onClose }: { task: Task; api: TasksApi; projects: ProjectRef[]; onClose: () => void }) {
  const [title, setTitle] = useState(task.title);
  const [date, setDate] = useState(task.date);
  const [time, setTime] = useState(task.time ?? "");
  const [duration, setDuration] = useState(task.duration ? String(task.duration) : "");
  const [project, setProject] = useState(task.project ?? "");
  const [reminder, setReminder] = useState(task.reminder === null ? "" : String(task.reminder));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await api.run({
      action: "update", id: task.id,
      patch: {
        title, date, time: time || null, duration: duration ? Number(duration) : null, project: project || null,
        reminder: time && reminder !== "" ? Number(reminder) : null,
      },
    });
    if (ok) onClose();
  };
  return (
    <li className="border-b border-border py-3">
      <form onSubmit={save} onKeyDown={(e) => e.key === "Escape" && onClose()} className="grid gap-2 sm:grid-cols-6">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={`${field} sm:col-span-6`} aria-label="Titre" required maxLength={300} autoFocus />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${field} sm:col-span-2`} aria-label="Date" required />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={`${field} sm:col-span-1`} aria-label="Heure" />
        <input type="number" min={1} max={1440} value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Durée (min)" className={`${field} sm:col-span-1`} aria-label="Durée en minutes" />
        <select value={project} onChange={(e) => setProject(e.target.value)} className={`${field} sm:col-span-2`} aria-label="Projet">
          <option value="">Aucun projet</option>
          {projects.map((p) => <option key={p.slug} value={p.slug}>{p.title}</option>)}
          {task.project && !projects.some((p) => p.slug === task.project) && <option value={task.project}>#{task.project}</option>}
        </select>
        <select value={reminder} onChange={(e) => setReminder(e.target.value)} disabled={!time} className={`${field} sm:col-span-3`} aria-label="Rappel par e-mail">
          {REMINDERS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <div className="flex items-center justify-end gap-2 sm:col-span-3">
          <button type="button" onClick={onClose} className={btnGhost}>Annuler</button>
          <button type="submit" disabled={api.busy} className={btnPrimary}>Enregistrer</button>
        </div>
      </form>
    </li>
  );
}
