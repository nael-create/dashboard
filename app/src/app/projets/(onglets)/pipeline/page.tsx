import type { Metadata } from "next";
import config from "@config";
import { PipelineBoard } from "@/components/projects/pipeline-board";
import { boardProjects } from "@/lib/project-board";

export const metadata: Metadata = { title: "Pipeline · Projets" };
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function PipelineTab({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const showArchived = sp.termines === "1";
  const timeline = sp.chronologie === "1";
  const { projects, today } = await boardProjects(showArchived);
  return (
    <PipelineBoard
      key={`${showArchived}-${timeline}`}
      projects={projects}
      stages={config.projectStages}
      today={today}
      showArchived={showArchived}
      timeline={timeline}
      stalledDays={config.stalledDays}
    />
  );
}
