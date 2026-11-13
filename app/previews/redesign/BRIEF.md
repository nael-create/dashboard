# Brief de design — refonte « portfolio de directeur artistique »

Référence étudiée (inspiration uniquement) : brandonyasin.com, en captures ordinateur et téléphone. Rien n'est repris de ce site : ni code, ni images, ni logos, ni textes, ni polices propriétaires.

## Ce que l'on retient de la référence

- **Silence et espace.** Un fond uni chaud, très peu d'éléments, beaucoup de vide. Les contenus (images) portent la page, l'interface s'efface.
- **En-tête minimal sur une grille de 4 colonnes.** Le nom à gauche sur deux lignes, la navigation, puis « heure locale » à droite. Tout est en petites capitales de 12 px, sans icône ni fond.
- **Typographie grotesque neutre** (type Helvetica). Les grands titres sont en minuscules, très grands (≈ 90 px), fins, avec un interlettrage serré (≈ -4 %). Les étiquettes sont en petites capitales de 11–12 px.
- **Images présentées comme une archive.** Formats portrait, bord franc (aucun arrondi), gouttières de 8 px, légende en petites capitales au-dessus ou en dessous.
- **Fils fins et cercles** comme seuls ornements.
- **Mouvement lent et discret.** Défilement doux, léger zoom des images au survol.

## Polices (libres)

- **Inter Tight** (variable, licence SIL OFL 1.1), auto-hébergée via le paquet npm `@fontsource-variable/inter-tight`. Elle fonctionne hors ligne et ne fait aucun appel à Google.
- Pile de repli : `"Inter Tight Variable", "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif`.
- Échelle :
  - **Display** (titre de page) : `clamp(3rem, 9vw, 7.5rem)`, graisse 300, interlettrage -0,045 em, interligne 0,9, minuscules.
  - **Titre de section** : `clamp(2rem, 4.5vw, 3.75rem)`, graisse 300, -0,035 em, minuscules, précédé d'un numéro « 01. ».
  - **Corps** : 15–16 px, graisse 400, interligne 1,5.
  - **Étiquettes** : 11 px, capitales, interlettrage +0,04 em.

## Palette

| Rôle | Clair | Sombre |
|---|---|---|
| Fond | `#D6D1C5` (grège chaud) | `#141310` (noir chaud) |
| Surface (cartes, champs) | `#DEDACF` | `#1C1B17` |
| Surface 2 (survol, encarts) | `#CDC8BB` | `#25231E` |
| Fil / bordure | `#B3AD9F` | `#3A372F` |
| Texte | `#111111` | `#E9E5DA` |
| Texte secondaire | `#4E4A42` (contraste ≈ 6,3:1) | `#A7A194` (≈ 7:1) |
| Accent (unique, réglable dans `dashboard.config.ts`) | terre cuite `#A3451F` | même teinte, éclaircie automatiquement |

Le contraste du texte est au moins AA dans les deux modes. L'accent est rare : élément actif, aujourd'hui dans le calendrier, priorité P1, focus clavier.

## Grille et espacements

- Pleine largeur avec des marges de **16 px** (téléphone) et **24 px** (ordinateur), et une largeur maximale de 1 600 px.
- Grille de 12 colonnes, gouttières de **8 px** pour les images et de **24 px** pour le texte.
- Sections séparées par un **fil fin** et **96 px** de vide (48 px sur téléphone). Chaque section s'ouvre sur un titre en minuscules numéroté (« 01. agenda », « 02. à la une »…).
- Aucun arrondi sur les cartes et les images. Seuls les boutons « pilule » et les pastilles restent ronds, en écho au cercle de la référence.
- Listes numérotées « 01. », « 02. » pour les projets actifs, le focus et les notions.

## Accueil (de haut en bas)

1. **En-tête** : nom, navigation complète (Accueil, Projets, Notions, Mémo, Newsletters, News, Favoris, Revue), « heure locale » en direct, puis discrètement Sauvegarder, la loupe (palette), « + » (notion) et le thème. Sur téléphone, un bouton « menu » ouvre un menu plein écran en très grands caractères minuscules numérotés.
2. **Calendrier** : premier bloc de contenu, avec toutes ses fonctions. Titre en très grand, vues Jour / Semaine / Mois en petites capitales, grille horaire à fils fins.
3. **À la une** : grille d'images façon archive. Un grand sujet, puis des vignettes, dans l'ordre éditorial du flux FT International entrecoupé de Reuters. Un article sans image devient une **carte typographique** (grand titre sur aplat) volontairement composée, jamais un cadre vide.
4. **Tout le reste** dans le même langage : projets actifs, à retenir aujourd'hui (notions), mémo, newsletters, lien de revue.

## Mouvement

- Apparition douce des sections (opacité + 8 px, 500 ms, `cubic-bezier(.2,.7,.2,1)`).
- Images : zoom de 1,03 au survol (700 ms). Liens : soulignement qui se déploie.
- Aucun mouvement si `prefers-reduced-motion: reduce` (règle globale).

## Accessibilité

- Focus clavier visible partout (contour de 2 px aux couleurs de l'accent).
- Navigation au clavier conservée. Le menu téléphone se ferme avec Échap.
- Les titres affichés en minuscules le sont par CSS : le texte d'origine reste lisible par les lecteurs d'écran.
