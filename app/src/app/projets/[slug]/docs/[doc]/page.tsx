import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocPage } from "@/components/projects/doc-page";
import { isValidSlug, listAreas, listProjects } from "@/lib/content";
import { listAllDocs, ownerDir, ownerKind, readDocPage } from "@/lib/docs";

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
  const [projects, areas, docs] = await Promise.all([listProjects(), listAreas(), listAllDocs()]);
  const kind = ownerKind(slug);
  const owner = { href: kind === "area" ? `/domaines/${slug}` : `/projets/${slug}`, dir: ownerDir(slug) };
  const ownerTitle = (kind === "area" ? areas : projects).find((p) => p.slug === slug)?.title ?? slug;
  const ctx = {
    project: slug,
    projects: projects.map((p) => ({ slug: p.slug, title: p.title })),
    docs: docs.map((d) => ({ project: d.project, slug: d.slug, title: d.title })),
  };
  return <DocPage initial={page} projectTitle={ownerTitle} ctx={ctx} owner={owner} />;
}
