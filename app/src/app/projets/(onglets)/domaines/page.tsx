import type { Metadata } from "next";
import { Empty } from "@/components/ui/card";
import { EntryCard } from "@/components/projects/entry-card";
import { listedEntries } from "@/lib/project-list";

export const metadata: Metadata = { title: "Domaines · Projets" };
export const dynamic = "force-dynamic";

/** Domaines : responsabilités continues (areas/), mêmes cartes que les projets (sans deadline ni statut). */
export default async function AreasTab() {
  const { entries, today } = await listedEntries("area");
  return entries.length ? (
    <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map((a) => <EntryCard key={a.slug} e={a} today={today} />)}
    </ul>
  ) : (
    <Empty>Aucun domaine pour l&apos;instant. « Nouveau domaine » en crée un.</Empty>
  );
}
