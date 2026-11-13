import { CalendarDays, FolderKanban, Home, Mail, Newspaper, StickyNote, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Entrées de navigation, dans l'ordre d'affichage.
 * Pour ajouter une page (ex. « /news » en phase 6), il suffit d'ajouter une ligne ici.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/news", label: "Actus", icon: Newspaper },
  { href: "/projets", label: "Projets", icon: FolderKanban },
  { href: "/memo", label: "Mémo", icon: StickyNote },
  { href: "/newsletters", label: "Newsletters", icon: Mail },
];

export const CALENDAR_ICON = CalendarDays;
