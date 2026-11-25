import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EntryPage } from "@/components/projects/entry-page";
import { readEditable, RESERVED_SLUGS } from "@/lib/entries-edit";
import { isValidSlug, listAreas, listProjects } from "@/lib/content";
import { todayISO } from "@/lib/dates";
import { listDocs, listTemplates } from "@/lib/docs";

export const dynamic = "force-dynamic";
type Params = Promise<{ slug: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const e = isValidSlug(slug) ? await readEditable("project", slug) : null;
  return { title: e?.fields.title?.replace(/^TODO: fill in$/, slug) ?? "Introuvable" };
}

/** Page unique d'un projet (plus d'onglets : les anciens liens « ?onglet=… » arrivent ici). */
export default async function Page({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { slug } = await params;
  const sp = await searchParams;
  if (!isValidSlug(slug) || RESERVED_SLUGS.has(slug)) notFound();
  const entry = await readEditable("project", slug);
  if (!entry) notFound();
  const [projects, areas, docs, templates] = await Promise.all([listProjects(), listAreas(), listDocs(slug), listTemplates()]);
  return (
    <EntryPage
      initial={entry}
      slugs={[...projects, ...areas].map((p) => p.slug)}
      docs={docs.map(({ slug: s, title, updated, order }) => ({ slug: s, title, updated, order }))}
      templates={templates}
      today={todayISO()}
      docsApi={{ api: `/api/projects/${slug}/docs`, hrefBase: `/projets/${slug}/docs` }}
      focusTask={sp.nouveau === "1"}
    />
  );
}
