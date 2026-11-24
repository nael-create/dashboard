/** Jalons de tous les projets en cours (projects/*, hors archive), pour le calendrier, le pipeline et la palette. */
import fs from "node:fs/promises";
import path from "node:path";
import { CONTENT_DIR, listProjects } from "./content";
import { milestones, parseDoc } from "./markdown-doc";

export interface ProjectMilestone {
  project: string;
  projectTitle: string;
  index: number;
  date: string;
  text: string;
  done: boolean;
}

export async function listMilestones(): Promise<ProjectMilestone[]> {
  const projects = await listProjects();
  const out: ProjectMilestone[] = [];
  await Promise.all(projects.map(async (p) => {
    try {
      const text = await fs.readFile(/*turbopackIgnore: true*/ path.join(CONTENT_DIR, "projects", p.slug, "README.md"), "utf8");
      for (const m of milestones(parseDoc(text))) out.push({ project: p.slug, projectTitle: p.title, index: m.index, date: m.date, text: m.text, done: m.done });
    } catch {
      /* README illisible : ignoré */
    }
  }));
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.project.localeCompare(b.project) || a.index - b.index);
}
