/**
 * Données des onglets « projets » et « domaines » : chaque projet / domaine avec ses indicateurs
 * (avancement des tâches, dernière activité, prochaine tâche).
 */
import { listArchivedProjects, listWithBody, type EntryWithBody, type Kind } from "./content";
import { dayNotes } from "./daily-notes";
import { todayISO } from "./dates";
import { parseDoc } from "./markdown-doc";
import { projectStats, type ProjectStats } from "./project-stats";
import { readTasks } from "./tasks";
import type { Task } from "./tasks-core";

export interface ListedEntry {
  kind: Kind;
  slug: string;
  title: string;
  status: string | null;
  priority: string | null;
  deadline: string | null;
  archived: boolean;
  stats: ProjectStats;
}

function toListed(e: EntryWithBody, archived: boolean, tasks: Task[], today: string): ListedEntry {
  const lastNote = dayNotes(parseDoc(e.body)).map((n) => n.date).sort().pop() ?? null;
  return {
    kind: e.kind, slug: e.slug, title: e.title, status: e.status, priority: e.priority,
    deadline: e.kind === "project" && e.deadline && /^\d{4}-\d{2}-\d{2}$/.test(e.deadline) ? e.deadline : null, archived,
    stats: projectStats({ slug: e.slug, updated: e.updated, lastNote }, tasks, today),
  };
}

/** Projets en cours (et, si demandé, ceux d'archive/), ou domaines. */
export async function listedEntries(kind: Kind, withArchive = false): Promise<{ entries: ListedEntry[]; today: string }> {
  const today = todayISO();
  const [current, archived, tasks] = await Promise.all([
    listWithBody(kind),
    kind === "project" && withArchive ? listArchivedProjects() : Promise.resolve([]),
    readTasks().then((t) => t.tasks).catch(() => [] as Task[]),
  ]);
  return { entries: [...current.map((e) => toListed(e, false, tasks, today)), ...archived.map((e) => toListed(e, true, tasks, today))], today };
}
