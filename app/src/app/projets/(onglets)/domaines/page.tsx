import type { Metadata } from "next";
import { Empty } from "@/components/ui/card";
import { EntryList } from "@/components/projects/entry-list";
import { listAreas } from "@/lib/content";

export const metadata: Metadata = { title: "Domaines · Projets" };
export const dynamic = "force-dynamic";

/** Domaines : responsabilités continues (areas/), inchangés. */
export default async function AreasTab() {
  const areas = await listAreas();
  return (
    <section>
      <h2 className="mb-5 flex items-baseline gap-3 border-t border-text/80 pt-4">
        <span className="title-md lowercase">domaines</span>
        <span className="label text-muted">{String(areas.length).padStart(2, "0")}</span>
      </h2>
      {areas.length ? <EntryList entries={areas} hrefBase="/domaines" /> : <Empty>Aucun domaine pour l&apos;instant. « Nouveau domaine » en crée un à partir du modèle.</Empty>}
    </section>
  );
}
