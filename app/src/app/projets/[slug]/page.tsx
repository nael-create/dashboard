import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EntryDetail } from "@/components/projects/entry-detail";
import { getProject } from "@/lib/content";

export const dynamic = "force-dynamic";
type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const entry = await getProject((await params).slug);
  return { title: entry?.title ?? "Projet introuvable" };
}

export default async function ProjectPage({ params }: { params: Params }) {
  const entry = await getProject((await params).slug);
  if (!entry) notFound();
  return <EntryDetail entry={entry} />;
}
