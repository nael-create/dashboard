import type { Metadata } from "next";
import { NewsFullList } from "@/components/news/news-full-list";

export const metadata: Metadata = { title: "Actus" };

export default async function NewsWidgetPage({ params }: { params: Promise<{ key: string }> }) {
  return <NewsFullList widgetKey={decodeURIComponent((await params).key)} />;
}
