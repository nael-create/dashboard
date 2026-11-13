import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/card";
import { NotionsBoard } from "@/components/notions/notions-board";
import { notionsWithProgress } from "@/lib/notions";
import { todayISO } from "@/lib/dates";

export const metadata: Metadata = { title: "Notions" };
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function NotionsPage({ searchParams }: { searchParams: SP }) {
  const tab = (await searchParams).onglet === "gerer" ? "gerer" : "consulter";
  const { notions, version, learned } = await notionsWithProgress(todayISO());
  return (
    <>
      <PageHeader
        title="Notions"
        subtitle={`${notions.filter((n) => n.complete).length} notion(s) dans NOTIONS.md · ${learned} apprise(s). Ajout rapide : « + » en haut ou touche N.`}
      />
      <NotionsBoard initial={notions} initialVersion={version} initialTab={tab} />
    </>
  );
}
