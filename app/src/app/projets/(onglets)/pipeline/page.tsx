import type { Metadata } from "next";

export const metadata: Metadata = { title: "Pipeline · Projets" };
export const dynamic = "force-dynamic";

export default async function PipelineTab() {
  return <p className="text-sm text-muted">Pipeline : bientôt.</p>;
}
