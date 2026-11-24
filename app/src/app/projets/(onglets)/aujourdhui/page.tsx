import type { Metadata } from "next";
import { FocusCard } from "@/components/focus/focus-card";
import { TasksToday } from "@/components/tasks/tasks-today";
import { listProjects } from "@/lib/content";

export const metadata: Metadata = { title: "Aujourd'hui · Projets" };
export const dynamic = "force-dynamic";

export default async function TodayTab() {
  const projects = (await listProjects()).map((p) => ({ slug: p.slug, title: p.title }));
  return (
    <div className="grid gap-8">
      <FocusCard compact />
      <TasksToday projects={projects} withSettings />
    </div>
  );
}
