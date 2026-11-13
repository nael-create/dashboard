import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/card";
import { NewsBoard } from "@/components/news/news-board";

export const metadata: Metadata = { title: "Actus" };

export default function NewsPage() {
  return (
    <>
      <PageHeader title="Actus" subtitle="Tes flux RSS, sources gérées dans NEWS.md. Clique sur un titre pour lire l'article sur son site." />
      <NewsBoard />
    </>
  );
}
