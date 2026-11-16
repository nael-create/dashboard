import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/card";
import { HighlightsBoard } from "@/components/highlights/highlights-board";
import { readHighlights, readHighlightStatus } from "@/lib/highlights";

export const metadata: Metadata = { title: "Surlignages" };
export const dynamic = "force-dynamic";

export default async function HighlightsPage() {
  const [{ highlights, version }, status] = await Promise.all([readHighlights(), readHighlightStatus()]);
  const items = highlights.map(({ start: _s, end: _e, prefix: _p, suffix: _x, ...h }) => h);
  return (
    <>
      <PageHeader
        title="Surlignages"
        subtitle={`${highlights.length} passage${highlights.length > 1 ? "s" : ""} surligné${highlights.length > 1 ? "s" : ""} dans tes newsletters, gardés dans SURLIGNAGES.md.`}
      />
      <HighlightsBoard initial={items} initialVersion={version} status={status} />
    </>
  );
}
