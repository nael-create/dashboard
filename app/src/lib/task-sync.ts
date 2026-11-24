/** Synchronisation automatique de TACHES.md (partie B). Pour l'instant : rien n'est envoyé. */
export interface TaskSyncStatus { enabled: boolean; lastSync: string | null; pending: boolean; error: string | null }

export function scheduleTaskSync(): void {}

export function taskSyncStatus(): TaskSyncStatus {
  return { enabled: false, lastSync: null, pending: false, error: null };
}
