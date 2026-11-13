import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/card";
import { MemoBoard } from "@/components/memo/memo-board";
import { readMemo } from "@/lib/memo";

export const metadata: Metadata = { title: "Mémo" };
export const dynamic = "force-dynamic";

export default async function MemoPage() {
  const { entries, version } = await readMemo();
  return (
    <>
      <PageHeader title="Mémo" subtitle="Les choses à ne pas oublier, stockées dans MEMO.md." />
      <MemoBoard
        initial={entries.map(({ start: _s, end: _e, ...rest }) => rest)}
        initialVersion={version}
      />
    </>
  );
}
