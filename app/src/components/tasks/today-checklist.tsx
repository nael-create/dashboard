"use client";

import { groupTasks, todayProgress } from "@/lib/tasks-view";
import { Card, CardHeader } from "@/components/ui/card";
import { TaskQuickAdd, type ProjectRef } from "./task-quick-add";
import { TaskRow } from "./task-row";
import { useTasks } from "./use-tasks";

/**
 * Accueil : la liste du jour (en retard + aujourd'hui), cochable sur place, avec saisie rapide.
 * La vue complète est l'onglet projets → aujourd'hui.
 */
export function TodayChecklist({ n, projects }: { n?: string; projects: ProjectRef[] }) {
  const api = useTasks();
  const s = api.state;
  const g = s ? groupTasks(s.tasks, s.today) : null;
  const progress = s ? todayProgress(s.tasks, s.today) : null;
  return (
    <Card className="h-full">
      <CardHeader
        n={n}
        title="aujourd'hui"
        href="/projets/aujourdhui"
        linkLabel="Tout voir"
        aside={progress && progress.total > 0 ? <span className="label tabular-nums text-muted">{progress.done} / {progress.total}</span> : undefined}
      />
      {!s || !g ? (
        <div className="h-24 animate-pulse bg-surface-2" aria-label="Chargement des tâches" />
      ) : (
        <>
          <TaskQuickAdd api={api} projects={projects} today={s.today} compact placeholder="Nouvelle tâche… (ex. « Appeler Paul 17h »)" />
          {api.error && <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">{api.error}</p>}
          <ul className="mt-3 border-t border-border">
            {g.overdue.map((t) => <TaskRow key={t.id} task={t} api={api} today={s.today} projects={projects} showDate overdue draggable={false} />)}
            {g.today.map((t) => <TaskRow key={t.id} task={t} api={api} today={s.today} projects={projects} draggable={false} />)}
            {g.todayDone.slice(0, 5).map((t) => <TaskRow key={t.id} task={t} api={api} today={s.today} projects={projects} draggable={false} />)}
          </ul>
          {g.overdue.length + g.today.length + g.todayDone.length === 0 && (
            <p className="py-4 text-sm text-muted">Rien de prévu aujourd&apos;hui.</p>
          )}
        </>
      )}
    </Card>
  );
}
