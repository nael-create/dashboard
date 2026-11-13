import type { ComponentType } from "react";
import {
  ActiveProjectsWidget, CalendarWidget, FocusWidget, MemoWidget, NewslettersWidget,
} from "@/components/home/widgets";

export const dynamic = "force-dynamic";

/**
 * Disposition de l'accueil, dans l'ordre de priorité.
 * Grille de 12 colonnes sur grand écran, une seule colonne sur téléphone.
 * Pour ajouter un widget (ex. « À la une » en phase 6), ajouter une ligne ici.
 */
const HOME_WIDGETS: { id: string; span: string; Widget: ComponentType }[] = [
  { id: "calendar", span: "lg:col-span-12", Widget: CalendarWidget },
  { id: "focus", span: "lg:col-span-4", Widget: FocusWidget },
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
