import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EntryPage } from "@/components/projects/entry-page";
import { readEditable } from "@/lib/entries-edit";
import { isValidSlug, listAreas, listProjects } from "@/lib/content";
import { todayISO } from "@/lib/dates";
import { listDocs, listTemplates } from "@/lib/docs";

export const dynamic = "force-dynamic";
type Params = Promise<{ slug: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const e = isValidSlug(slug) ? await readEditable("area", slug) : null;
  return { title: e?.fields.title?.replace(/^TODO: fill in$/, slug) ?? "Introuvable" };
}

/** Page d'un domaine : même page qu'un projet, sans deadline ni statut. */
export default async function Page({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { slug } = await params;
  const sp = await searchParams;
  if (!isValidSlug(slug)) notFound();
  const entry = await readEditable("area", slug);
  if (!entry) notFound();
  const [projects, areas, docs, templates] = await Promise.all([listProjects(), listAreas(), listDocs(slug), listTemplates()]);
  // Un projet du même nom a la priorité sur les documents (même adresse /projets/<nom>/docs).
  const docsHere = !projects.some((p) => p.slug === slug);
  return <EntryPage initial={entry} slugs={[...projects, ...areas].map((p) => p.slug)} docs={docsHere ? docs.map(({ slug: s, title, updated, order }) => ({ slug: s, title, updated, order })) : null} templates={templates} today={todayISO()}
    docsApi={docsHere ? { api: `/api/projects/${slug}/docs`, hrefBase: `/projets/${slug}/docs` } : null} focusTask={sp.nouveau === "1"} />;
}
