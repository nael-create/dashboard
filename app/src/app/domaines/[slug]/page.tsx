import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EntryPage } from "@/components/projects/entry-page";
import { readEditable } from "@/lib/entries-edit";
import { isValidSlug, listAreas, listProjects } from "@/lib/content";
import { todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";
type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const e = isValidSlug(slug) ? await readEditable("area", slug) : null;
  return { title: e?.fields.title?.replace(/^TODO: fill in$/, slug) ?? "Introuvable" };
}

/** Page d'un domaine : même page qu'un projet, sans deadline ni statut. */
export default async function Page({ params }: { params: Params }) {
  const { slug } = await params;
  if (!isValidSlug(slug)) notFound();
  const entry = await readEditable("area", slug);
  if (!entry) notFound();
  const [projects, areas] = await Promise.all([listProjects(), listAreas()]);
  return <EntryPage initial={entry} slugs={[...projects, ...areas].map((p) => p.slug)} docs={null} templates={[]} today={todayISO()} docsApi={null} />;
}
