import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/card";
import { ReviewWizard } from "@/components/review/review-wizard";
import { isoWeek } from "@/lib/review";
import { todayISO } from "@/lib/dates";

export const metadata: Metadata = { title: "Revue de la semaine" };
export const dynamic = "force-dynamic";

export default function ReviewPage() {
  const w = isoWeek(todayISO());
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Revue de la semaine" subtitle={`Semaine ${w.label} (du ${w.monday} au ${w.sunday}) · environ 5 minutes.`} />
      <ReviewWizard />
    </div>
  );
}
