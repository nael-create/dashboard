/** Données des onglets « pipeline » et « liste » : projets + indicateurs (jalons, activité, prochaine tâche). */
import config from "@config";
import { listArchivedProjects, listProjectsWithBody, type EntryWithBody } from "./content";
import { todayISO } from "./dates";
import { journal, milestones, parseDoc } from "./markdown-doc";
import { projectStats, type ProjectStats } from "./project-stats";
import { readTasks } from "./tasks";

export interface BoardProject {
  slug: string;
  title: string;
  status: string | null;
  priority: string | null;
  stage: string;
  deadline: string | null;
  tags: string[];
  nextAction: string | null;
  archived: boolean;
  milestones: { date: string; text: string; done: boolean }[];
  stats: ProjectStats;
}

function toBoard(e: EntryWithBody, archived: boolean, tasks: Awaited<ReturnType<typeof readTasks>>["tasks"], today: string): BoardProject {
  const d = parseDoc(e.body);
  const ms = milestones(d).map(({ date, text, done }) => ({ date, text, done }));
  return {
    slug: e.slug, title: e.title, status: e.status, priority: e.priority, stage: e.stage, deadline: e.deadline, tags: e.tags,
    nextAction: e.nextAction && e.nextAction !== "TODO: fill in" ? e.nextAction : null, archived, milestones: ms,
    stats: projectStats({ slug: e.slug, status: e.status, updated: e.updated, journalTop: journal(d)[0]?.date ?? null }, ms, tasks, today, config.stalledDays),
  };
}

export async function boardProjects(withArchive: boolean): Promise<{ projects: BoardProject[]; today: string }> {
  const today = todayISO();
  const [current, archived, tasks] = await Promise.all([
    listProjectsWithBody(),
    withArchive ? listArchivedProjects() : Promise.resolve([]),
    readTasks().then((t) => t.tasks).catch(() => []),
  ]);
  return { projects: [...current.map((e) => toBoard(e, false, tasks, today)), ...archived.map((e) => toBoard(e, true, tasks, today))], today };
}
