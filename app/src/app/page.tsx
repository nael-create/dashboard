import type { ComponentType } from "react";
import { CalendarWidget } from "@/components/calendar/calendar-widget";
import {
  ActiveProjectsWidget, MemoWidget, NewsWidget, NewslettersWidget,
} from "@/components/home/widgets";

export const dynamic = "force-dynamic";

/**
 * Disposition de l'accueil, dans l'ordre de priorité.
 * Grille de 12 colonnes sur grand écran, une seule colonne sur téléphone.
 * « À la une » (news) est un emplacement réservé : la phase 6 remplit NewsWidget, sans ajouter de ligne.
 */
const HOME_WIDGETS: { id: string; span: string; Widget: ComponentType }[] = [
  { id: "calendar", span: "lg:col-span-12", Widget: CalendarWidget },
  { id: "news", span: "lg:col-span-4", Widget: NewsWidget },
  { id: "projects", span: "lg:col-span-8", Widget: ActiveProjectsWidget },
  { id: "newsletters", span: "lg:col-span-6", Widget: NewslettersWidget },
  { id: "memo", span: "lg:col-span-6", Widget: MemoWidget },
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
