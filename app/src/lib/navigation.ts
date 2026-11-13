import { CalendarDays, FolderKanban, GraduationCap, Home, Mail, Newspaper, StickyNote, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Affiché directement dans la barre du bas sur téléphone (les autres sont dans « Plus »). */
  mobile?: boolean;
}

/**
 * Entrées de navigation, dans l'ordre d'affichage.
 * Pour ajouter une page (ex. « /news » en phase 6), il suffit d'ajouter une ligne ici.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Accueil", icon: Home, mobile: true },
  { href: "/news", label: "Actus", icon: Newspaper, mobile: true },
  { href: "/projets", label: "Projets", icon: FolderKanban, mobile: true },
  { href: "/notions", label: "Notions", icon: GraduationCap, mobile: true },
  { href: "/memo", label: "Mémo", icon: StickyNote },
  { href: "/newsletters", label: "Newsletters", icon: Mail },
];

export const CALENDAR_ICON = CalendarDays;
