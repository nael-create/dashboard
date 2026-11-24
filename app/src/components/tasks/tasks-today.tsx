"use client";

import { useEffect, useMemo, useState } from "react";
import { groupTasks, historyByWeek, SECTION_LABELS, todayProgress, type SectionKey } from "@/lib/tasks-view";
import { addDays, type Task } from "@/lib/tasks-core";
import { longDay, relativeDay } from "@/lib/task-format";
import { Notice } from "@/components/ui/notice";
import { TaskQuickAdd, type ProjectRef } from "./task-quick-add";
import { TaskRow } from "./task-row";
import { useTasks, type TasksApi } from "./use-tasks";

/**
 * Onglet « aujourd'hui » de /projets : saisie rapide, sections en retard / aujourd'hui / demain /
 * cette semaine (vides masquées, sauf « aujourd'hui »), progression discrète, historique par semaine.
 */
export function TasksToday({ projects, settingsSlot }: { projects: ProjectRef[]; settingsSlot?: (api: TasksApi) => React.ReactNode }) {
  const api = useTasks();
  const [history, setHistory] = useState(false);

  useEffect(() => {
    setHistory(new URLSearchParams(window.location.search).get("vue") === "historique");
  }, []);
  const toggleHistory = () => {
    const next = !history;
    setHistory(next);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("vue", "historique");
    else url.searchParams.delete("vue");
    window.history.replaceState(null, "", url);
  };

  const s = api.state;
  // Arrivée depuis la palette (« Nouvelle tâche ») : curseur dans la saisie rapide.
  const loaded = !!s;
  useEffect(() => {
    if (loaded && new URLSearchParams(window.location.search).has("nouvelle")) document.querySelector<HTMLInputElement>('input[aria-label="Nouvelle tâche"]')?.focus();
  }, [loaded]);
  const sections = useMemo(() => (s ? groupTasks(s.tasks, s.today) : null), [s]);
  const progress = s ? todayProgress(s.tasks, s.today) : { done: 0, total: 0 };

  return (
    <div className="space-y-8">
      <div>
        {s ? <TaskQuickAdd api={api} projects={projects} today={s.today} /> : <div className="h-[42px] border border-border bg-surface" />}
        {api.error && <div className="mt-3"><Notice>{api.error}</Notice></div>}
      </div>

      {!s || !sections ? (
        <p className="text-sm text-muted">Chargement des tâches…</p>
      ) : history ? (
        <History tasks={s.tasks} today={s.today} onBack={toggleHistory} />
      ) : (
        <>
          {(["overdue", "today", "tomorrow", "week"] as SectionKey[]).map((key) => {
            const list = sections[key];
            if (key !== "today" && list.length === 0) return null;
            return (
              <section key={key} aria-label={SECTION_LABELS[key]}>
                <header className="mb-1 flex items-baseline justify-between gap-3 border-b border-text/80 pb-2">
                  <h3 className="flex items-baseline gap-3">
                    <span className={`title-md lowercase ${key === "overdue" ? "text-rose-700 dark:text-rose-400" : ""}`}>{SECTION_LABELS[key]}</span>
                    {key === "today" && <span className="label text-muted">{longDay(s.today)}</span>}
                    {key === "tomorrow" && <span className="label text-muted">{longDay(addDays(s.today, 1))}</span>}
                  </h3>
                  {key === "today" && progress.total > 0 && (
                    <span className="label tabular-nums text-muted" aria-label={`${progress.done} tâches faites sur ${progress.total}`}>
                      {progress.done} / {progress.total}
                    </span>
                  )}
                </header>
                <ul>
                  {list.map((t) => (
                    <TaskRow key={t.id} task={t} api={api} today={s.today} projects={projects} overdue={key === "overdue"} showDate={key === "overdue" || key === "week"} draggable={key !== "overdue"} />
                  ))}
                  {key === "today" && sections.todayDone.map((t) => (
                    <TaskRow key={t.id} task={t} api={api} today={s.today} projects={projects} draggable={false} />
                  ))}
                </ul>
                {key === "today" && list.length === 0 && sections.todayDone.length === 0 && (
                  <p className="py-4 text-sm text-muted">Rien de prévu aujourd&apos;hui. Ajoute une tâche ci-dessus.</p>
                )}
              </section>
            );
          })}
          {sections.later.length > 0 && (
            <details className="group">
              <summary className="label cursor-pointer list-none text-muted hover:text-text">
                plus tard · {sections.later.length} <span className="inline-block transition-transform group-open:rotate-90">›</span>
              </summary>
              <ul className="mt-2">
                {sections.later.map((t) => (
                  <TaskRow key={t.id} task={t} api={api} today={s.today} projects={projects} showDate draggable={false} />
                ))}
              </ul>
            </details>
          )}
          <p className="flex flex-wrap items-center justify-between gap-3 text-[12px] text-muted">
            <span className="hidden sm:inline">Espace coche · ⌥↑ / ⌥↓ déplace · Entrée modifie · glisser-déposer pour réordonner</span>
            <button type="button" onClick={toggleHistory} className="label link-underline hover:text-text">historique →</button>
          </p>
        </>
      )}

      {s && settingsSlot?.(api)}
    </div>
  );
}

function History({ tasks, today, onBack }: { tasks: Task[]; today: string; onBack: () => void }) {
  const weeks = historyByWeek(tasks);
  return (
    <section aria-label="Historique">
      <header className="mb-4 flex items-baseline justify-between border-b border-text/80 pb-2">
        <h3 className="title-md lowercase">historique</h3>
        <button type="button" onClick={onBack} className="label link-underline text-muted hover:text-text">← retour</button>
      </header>
      {weeks.length === 0 && <p className="text-sm text-muted">Aucune tâche faite ou abandonnée pour l&apos;instant.</p>}
      <div className="space-y-8">
        {weeks.map(({ week, tasks: list }) => (
          <div key={week}>
            <p className="label mb-2 text-muted">semaine du {relativeDay(week, today)} · {list.filter((t) => t.status === "done").length} faite{list.filter((t) => t.status === "done").length > 1 ? "s" : ""}</p>
            <ul className="divide-y divide-border border-y border-border">
              {list.map((t) => (
                <li key={t.id} className="flex items-baseline gap-3 py-2 text-sm">
                  <span className="label w-24 shrink-0 text-muted">{t.closedOn ? relativeDay(t.closedOn, today) : ""}</span>
                  <span className={`${t.status === "dropped" ? "text-muted line-through" : ""}`}>{t.title}</span>
                  {t.status === "dropped" && <span className="text-[12px] text-muted">abandonnée</span>}
                  {t.project && <span className="label ml-auto text-[10px] text-muted">#{t.project}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
