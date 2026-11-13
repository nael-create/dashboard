import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/card";
import { NotionsBoard } from "@/components/notions/notions-board";
import { notionsWithProgress } from "@/lib/notions";
import { todayISO } from "@/lib/dates";

export const metadata: Metadata = { title: "Notions" };
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function NotionsPage({ searchParams }: { searchParams: SP }) {
  const onglet = (await searchParams).onglet;
  const tab = onglet === "gerer" ? "gerer" : onglet === "travailler" ? "travailler" : "consulter";
  const today = todayISO();
  const { notions, version, learned } = await notionsWithProgress(today);
  return (
    <>
      <PageHeader
        title="Notions"
        subtitle={`${notions.filter((n) => n.complete).length} notion(s) dans NOTIONS.md · ${learned} apprise(s). Ajout rapide : « + » en haut ou touche N.`}
      />
      <NotionsBoard initial={notions} initialVersion={version} initialTab={tab} today={today} />
    </>
  );
}
