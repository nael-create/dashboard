import type { Metadata } from "next";
import { Empty, PageHeader } from "@/components/ui/card";

export const metadata: Metadata = { title: "Mémo" };

export default function MemoPage() {
  return (
    <>
      <PageHeader title="À retenir" subtitle="Les choses à ne pas oublier, stockées dans MEMO.md." />
      <Empty>Cette page arrive à la phase 4.</Empty>
    </>
  );
}
