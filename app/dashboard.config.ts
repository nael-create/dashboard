/**
 * Configuration personnelle du dashboard.
 * C'est le seul fichier à modifier pour changer le titre, la couleur d'accent, etc.
 */
interface DashboardConfig {
  title: string;
  accentColor: string;
  timeZone: string | null;
  locale: string;
  newslettersFolder: string;
  notionsPerDay: number;
}

const dashboardConfig: DashboardConfig = {
  /** Titre affiché dans l'en-tête et l'onglet du navigateur. */
  title: "Nael",

  /** Couleur d'accent unique (format hexadécimal #rrggbb). */
  accentColor: "#6366f1",

  /**
   * Fuseau horaire d'affichage (dates, calendrier).
   * null = fuseau de l'ordinateur (recommandé). Pour en forcer un : ex. "Asia/Kuala_Lumpur".
   */
  timeZone: null,

  /** Langue / format des dates. */
  locale: "fr-FR",

  /** Nom du dossier Outlook lu par la page Newsletters (aucun autre dossier n'est lu). */
  newslettersFolder: "Newsletters",

  /** Nombre de notions proposées sur l'accueil (« À retenir aujourd'hui ») ; « Encore » en propose autant. */
  notionsPerDay: 3,
};

export default dashboardConfig;
