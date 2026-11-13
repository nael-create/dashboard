/**
 * Configuration personnelle du dashboard.
 * C'est le seul fichier à modifier pour changer le titre, la couleur d'accent, etc.
 */
const dashboardConfig = {
  /** Titre affiché dans l'en-tête et l'onglet du navigateur. */
  title: "Nael",

  /** Couleur d'accent unique (format hexadécimal #rrggbb). */
  accentColor: "#6366f1",

  /** Fuseau horaire utilisé pour les dates et le calendrier. */
  timeZone: "Asia/Kuala_Lumpur",

  /** Langue / format des dates. */
  locale: "fr-FR",
} as const;

export default dashboardConfig;
