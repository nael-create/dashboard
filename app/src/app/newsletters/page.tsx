import type { Metadata } from "next";
import { Empty, PageHeader } from "@/components/ui/card";

export const metadata: Metadata = { title: "Newsletters" };

export default function NewslettersPage() {
  return (
    <>
      <PageHeader title="Newsletters" subtitle="Le dossier « Newsletters » de ta boîte Outlook, en lecture seule." />
      <Empty>Cette page arrive à la phase 5.</Empty>
    </>
  );
}
