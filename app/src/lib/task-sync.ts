/**
 * Synchronisation automatique de TACHES.md vers GitHub (pour les rappels par e-mail, qui lisent main).
 * Après chaque modification d'une tâche : attente d'une minute (les modifications rapprochées partent
 * ensemble), puis `syncTasksFile` (git.ts) ne commite QUE TACHES.md et l'envoie. Échec : réessai dans
 * 5 minutes, message discret dans le panneau. Désactivable (`autosync: no` dans TACHES.md).
 * État en mémoire seulement (rien n'est écrit sur disque).
 */
import { syncTasksFile } from "./git";
import { readTasks } from "./tasks";

export interface TaskSyncStatus {
  enabled: boolean;
  /** Dernière synchro réussie (ISO), depuis le démarrage de l'app. */
  lastSync: string | null;
  pending: boolean;
  error: string | null;
}

export const SYNC_DELAY_MS = 60_000;
const RETRY_MS = 5 * 60_000;

const g = globalThis as unknown as { __taskSync?: { timer: ReturnType<typeof setTimeout> | null; status: TaskSyncStatus } };
const st = (g.__taskSync ??= { timer: null, status: { enabled: true, lastSync: null, pending: false, error: null } });

export function scheduleTaskSync(delay = SYNC_DELAY_MS): void {
  if (process.env.VITEST) return;
  if (st.timer) clearTimeout(st.timer);
  st.status.pending = true;
  st.timer = setTimeout(run, delay);
}

async function run() {
  st.timer = null;
  try {
    const { settings } = await readTasks();
    st.status.enabled = settings.autosync;
    if (!settings.autosync) {
      st.status.pending = false;
      return;
    }
    const res = await syncTasksFile();
    if (res.kind === "ok") {
      st.status = { enabled: true, lastSync: new Date().toISOString(), pending: false, error: null };
    } else if (res.kind === "skipped") {
      st.status = { ...st.status, pending: false, error: res.message };
    } else {
      st.status = { ...st.status, pending: true, error: res.message };
      st.timer = setTimeout(run, RETRY_MS);
    }
  } catch (e) {
    st.status = { ...st.status, pending: true, error: e instanceof Error ? e.message : String(e) };
    st.timer = setTimeout(run, RETRY_MS);
  }
}

export function taskSyncStatus(): TaskSyncStatus {
  return { ...st.status };
}

/** Synchro immédiate (bouton « Synchroniser maintenant »). */
export async function syncNow(): Promise<TaskSyncStatus> {
  if (st.timer) clearTimeout(st.timer);
  await run();
  return taskSyncStatus();
}
