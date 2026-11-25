/**
 * Conversion d'un seul projet / domaine encore à l'ancien format, depuis sa page (bouton « Convertir »).
 * Même règles que le script app/scripts/migrate-entries.ts (src/lib/migrate-entries.ts) : rien n'est perdu,
 * et relancer ne change rien. Les tâches sont ajoutées d'abord (un titre déjà présent n'est pas recréé),
 * puis le README est réécrit avec la règle « fichier inchangé depuis la lecture ».
 */
import { UserError } from "./api";
import type { Kind } from "./content";
import { readVersioned, updateFile } from "./content-file";
import { regenerateDashboard } from "./dashboard-md";
import { todayISO } from "./dates";
import { ROOT } from "./entries-edit";
import { migrateReadme } from "./migrate-entries";
import { appendTasks, readTasks } from "./tasks";
import { scheduleTaskSync } from "./task-sync";

export async function migrateEntry(kind: Kind, slug: string, version: string): Promise<{ version: string; tasks: number; report: string[] }> {
  const rel = `${ROOT[kind]}/${slug}/README.md`;
  const cur = await readVersioned(rel);
  if (!cur.exists) throw new UserError("Ce fichier n'existe plus. Recharge la page.", 404);
  if (cur.version !== version) throw new UserError("Ce fichier a été modifié ailleurs entre-temps. Recharge la page.", 409);
  const today = todayISO();
  const existing = new Set((await readTasks()).tasks.filter((t) => t.project === slug).map((t) => t.title));
  const res = migrateReadme(cur.text, kind, slug, existing, today);
  if (res.tasks.length) {
    await appendTasks(res.tasks, today);
    scheduleTaskSync();
  }
  const out = await updateFile(rel, version, () => ({ text: res.changed ? res.text : null }));
  await regenerateDashboard();
  return { version: out.version, tasks: res.tasks.length, report: res.report };
}
