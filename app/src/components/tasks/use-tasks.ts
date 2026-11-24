"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiJson, isConflict } from "@/lib/client-api";
import type { Task, TaskSettings } from "@/lib/tasks-core";
import type { TaskSyncStatus } from "@/lib/task-sync";

export const TASKS_EVENT = "tasks-changed";

export interface TasksState {
  tasks: Task[];
  settings: TaskSettings;
  version: string;
  today: string;
  exists: boolean;
  sync: TaskSyncStatus;
}

/**
 * Tâches de TACHES.md côté navigateur : chargement, opérations (chaque écriture envoie la version lue,
 * refus 409 si le fichier a changé ailleurs → rechargement et message), synchronisation entre
 * composants par l'événement « tasks-changed » (palette, accueil, page projet).
 */
export function useTasks() {
  const [state, setState] = useState<TasksState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const versionRef = useRef<string>("");

  const reload = useCallback(async () => {
    try {
      const s = await apiJson<TasksState>("/api/tasks");
      versionRef.current = s.version;
      setState(s);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    reload();
    const on = () => reload();
    window.addEventListener(TASKS_EVENT, on);
    // Changement de jour, retour sur l'onglet : on relit (reconduite des récurrences, sections).
    const vis = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.removeEventListener(TASKS_EVENT, on);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [reload]);

  /** Envoie une opération ; `optimistic` modifie l'affichage tout de suite. Renvoie true si c'est enregistré. */
  const run = useCallback(
    async (body: Record<string, unknown>, optimistic?: (tasks: Task[]) => Task[]): Promise<boolean> => {
      setError(null);
      if (optimistic) setState((s) => (s ? { ...s, tasks: optimistic(s.tasks) } : s));
      setBusy(true);
      try {
        const needsVersion = body.action !== "add" && body.action !== "plan";
        await apiJson("/api/tasks", "POST", needsVersion ? { ...body, version: versionRef.current } : body);
        window.dispatchEvent(new Event(TASKS_EVENT));
        return true;
      } catch (e) {
        setError(isConflict(e) ? "TACHES.md a changé ailleurs : la liste a été rechargée, recommence." : (e as Error).message);
        await reload();
        return false;
      } finally {
        setBusy(false);
      }
    },
    [reload],
  );

  return { state, error, setError, busy, reload, run };
}

export type TasksApi = ReturnType<typeof useTasks>;
