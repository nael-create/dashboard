import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EntryEditor } from "@/components/projects/entry-editor";
import { readEditable } from "@/lib/entries-edit";
import { isValidSlug } from "@/lib/content";

export const dynamic = "force-dynamic";
type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const e = isValidSlug(slug) ? await readEditable("area", slug) : null;
  return { title: e?.fields.title?.replace(/^TODO: fill in$/, slug) ?? "Introuvable" };
}

export default async function Page({ params }: { params: Params }) {
  const { slug } = await params;
  if (!isValidSlug(slug)) notFound();
  const entry = await readEditable("area", slug);
  if (!entry) notFound();
  return <EntryEditor initial={entry} />;
}
