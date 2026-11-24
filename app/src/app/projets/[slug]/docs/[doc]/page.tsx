import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocPage } from "@/components/projects/doc-page";
import { isValidSlug, listProjects } from "@/lib/content";
import { listAllDocs, readDocPage } from "@/lib/docs";

export const dynamic = "force-dynamic";
type Params = Promise<{ slug: string; doc: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, doc } = await params;
  const page = isValidSlug(slug) && isValidSlug(doc) ? await readDocPage(slug, doc) : null;
  return { title: page?.title ?? "Introuvable" };
}

export default async function Page({ params }: { params: Params }) {
  const { slug, doc } = await params;
  if (!isValidSlug(slug) || !isValidSlug(doc)) notFound();
  const page = await readDocPage(slug, doc);
  if (!page) notFound();
  const [projects, docs] = await Promise.all([listProjects(), listAllDocs()]);
  const ctx = {
    project: slug,
    projects: projects.map((p) => ({ slug: p.slug, title: p.title })),
    docs: docs.map((d) => ({ project: d.project, slug: d.slug, title: d.title })),
  };
  return <DocPage initial={page} projectTitle={projects.find((p) => p.slug === slug)?.title ?? slug} ctx={ctx} />;
}
