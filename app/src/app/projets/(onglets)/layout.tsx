import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/card";
import { NewEntryButtons } from "@/components/projects/new-entry";
import { ProjectTabs } from "@/components/projects/project-tabs";
import { todayISO } from "@/lib/dates";

/** Section « projets » : trois onglets (aujourd'hui, projets, domaines), chacun avec son adresse. */
export default function ProjectsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader title="projets">
        <NewEntryButtons today={todayISO()} />
      </PageHeader>
      <ProjectTabs />
      <div className="pt-8">{children}</div>
    </>
  );
}
