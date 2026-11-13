import { Suspense } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CalendarWidget } from "@/components/calendar/calendar-widget";
import { NotionsToday } from "@/components/notions/notions-today";
import { ReviewLink } from "@/components/review/review-link";
import { Section } from "@/components/ui/card";
import { HeadlinesSkeleton } from "@/components/home/headlines-grid";
import { ActiveProjectsWidget, MemoWidget, NewsWidget, NewslettersWidget } from "@/components/home/widgets";
import { todayInTz } from "@/lib/calendar-view";
import { displayTimeZone } from "@/lib/display-tz";

export const dynamic = "force-dynamic";

/**
 * Accueil, de haut en bas (voir CLAUDE.md) :
 * 1. en-tête (layout) ; 2. 01. agenda — le calendrier, premier et plus grand bloc ;
 * 3. 02. à la une — grille d'images des grands sujets ;
 * 4. tout le reste : projets actifs, à retenir aujourd'hui, mémo, newsletters, lien de revue.
 */
export default function HomePage() {
  return (
    <div className="space-y-20 sm:space-y-28">
      <Section n="01" title="agenda">
        {/* Date du jour calculée ici, dans le fuseau d'affichage : identique au rendu serveur et navigateur. */}
        <CalendarWidget initialToday={todayInTz(displayTimeZone())} />
      </Section>

      <Section
        n="02"
        title="à la une"
        aside={
          <Link href="/news" className="label link-underline inline-flex items-center gap-1 text-muted hover:text-text">
            News <ArrowUpRight className="size-3" aria-hidden />
          </Link>
        }
      >
        <Suspense fallback={<HeadlinesSkeleton />}>
          <NewsWidget />
        </Suspense>
      </Section>

      <div className="space-y-14">
        <ReviewLink />
        <div className="grid grid-cols-1 gap-x-10 gap-y-16 lg:grid-cols-12">
          <div className="lg:col-span-7"><ActiveProjectsWidget n="03" /></div>
          <div className="lg:col-span-5"><NotionsToday n="04" /></div>
          <div className="lg:col-span-6"><MemoWidget n="05" /></div>
          <div className="lg:col-span-6"><NewslettersWidget n="06" /></div>
        </div>
      </div>
    </div>
  );
}
