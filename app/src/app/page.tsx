import type { ComponentType } from "react";
import { CalendarWidget } from "@/components/calendar/calendar-widget";
import { NotionsToday } from "@/components/notions/notions-today";
import {
  ActiveProjectsWidget, MemoWidget, NewsWidget, NewslettersWidget,
} from "@/components/home/widgets";

export const dynamic = "force-dynamic";

/**
 * Disposition de l'accueil, dans l'ordre de priorité.
 * Grille de 12 colonnes sur grand écran, une seule colonne sur téléphone.
 * 1. Calendrier (pleine largeur) ; 2. « À la une » + Projets actifs ;
 * 3. « À retenir aujourd'hui » (notions, sous « À la une ») + Newsletters + Mémo.
 */
const HOME_WIDGETS: { id: string; span: string; Widget: ComponentType }[] = [
  { id: "calendar", span: "lg:col-span-12", Widget: CalendarWidget },
  { id: "news", span: "lg:col-span-4", Widget: NewsWidget },
  { id: "projects", span: "lg:col-span-8", Widget: ActiveProjectsWidget },
  { id: "notions", span: "lg:col-span-4", Widget: NotionsToday },
  { id: "newsletters", span: "lg:col-span-4", Widget: NewslettersWidget },
  { id: "memo", span: "lg:col-span-4", Widget: MemoWidget },
];

export default function HomePage() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-12">
      {HOME_WIDGETS.map(({ id, span, Widget }) => (
        <div key={id} className={span}>
          <Widget />
        </div>
      ))}
    </div>
  );
}
