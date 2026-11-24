import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
type SP = Promise<Record<string, string | string[] | undefined>>;

/** /projets → onglet « aujourd'hui » (les anciens liens à filtres ou « nouveau projet » vont sur « liste »). */
export default async function ProjectsIndex({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") qs.set(k, v);
  if ([...qs.keys()].some((k) => ["statut", "priorite", "archive", "nouveau"].includes(k))) redirect(`/projets/liste?${qs}`);
  redirect("/projets/aujourdhui");
}
