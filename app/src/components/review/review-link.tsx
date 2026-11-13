import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { shouldShowReviewLink } from "@/lib/review";

/** Ligne discrète, le jour de la revue (et jusqu'à ce qu'elle soit faite). */
export async function ReviewLink() {
  if (!(await shouldShowReviewLink())) return null;
  return (
    <p className="rise flex items-baseline gap-3 border-t border-border pt-4">
      <span className="label text-muted">Cette semaine</span>
      <Link href="/revue" className="group inline-flex items-baseline gap-1 text-[clamp(1.1rem,1.6vw,1.4rem)] font-light tracking-[-0.02em]">
        <span className="link-underline">revue de la semaine — 5 min</span>
        <ArrowUpRight className="size-4 self-center transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </p>
  );
}
