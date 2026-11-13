import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { shouldShowReviewLink } from "@/lib/review";

/** Ligne de texte discrète au-dessus de la grille de l'accueil, le jour de la revue (et jusqu'à ce qu'elle soit faite). */
export async function ReviewLink() {
  if (!(await shouldShowReviewLink())) return null;
  return (
    <p className="mb-3 text-sm">
      <Link href="/revue" className="group inline-flex items-center gap-1 text-muted transition-colors hover:text-accent-text">
        Revue de la semaine — 5 min <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </p>
  );
}
