import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EntryDetail } from "@/components/projects/entry-detail";
import { getArea } from "@/lib/content";

export const dynamic = "force-dynamic";
type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const entry = await getArea((await params).slug);
  return { title: entry?.title ?? "Domaine introuvable" };
}

export default async function AreaPage({ params }: { params: Params }) {
  const entry = await getArea((await params).slug);
  if (!entry) notFound();
  return <EntryDetail entry={entry} />;
}
