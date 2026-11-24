import type { Metadata } from "next";
import { notFound } from "next/navigation";
import config from "@config";
import { ProjectView } from "@/components/projects/project-view";
import { readEditable } from "@/lib/entries-edit";
import { isValidSlug, listProjects } from "@/lib/content";
import { todayISO } from "@/lib/dates";
import { listDocs, listTemplates } from "@/lib/docs";
import { projectStats } from "@/lib/project-stats";
import { readTasks } from "@/lib/tasks";

export const dynamic = "force-dynamic";
type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const e = isValidSlug(slug) ? await readEditable("project", slug) : null;
  return { title: e?.fields.title?.replace(/^TODO: fill in$/, slug) ?? "Introuvable" };
}

export default async function Page({ params }: { params: Params }) {
  const { slug } = await params;
  if (!isValidSlug(slug)) notFound();
  const entry = await readEditable("project", slug);
  if (!entry) notFound();
  const [projects, docs, templates, tasks] = await Promise.all([listProjects(), listDocs(slug), listTemplates(), readTasks().catch(() => null)]);
  const today = todayISO();
  const stats = projectStats(
    { slug, status: entry.fields.status ?? null, updated: entry.fields.updated ?? null, journalTop: entry.journal[0]?.date ?? null },
    entry.milestones, tasks?.tasks ?? [], today, config.stalledDays,
  );
  return (
    <ProjectView
      initial={entry}
      stages={config.projectStages}
      projects={projects.map((p) => ({ slug: p.slug, title: p.title }))}
      docs={docs.map(({ slug: s, title, updated, order }) => ({ slug: s, title, updated, order }))}
      templates={templates}
      today={today}
      lastActivity={stats.lastActivity}
    />
  );
}
