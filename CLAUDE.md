# CLAUDE.md — Règles de ce dépôt

> **Note de maintenance** — 2026-11-24 : `next` 16.4.3 → 16.4.6 (avis de sécurité ; `next build` refusait de construire une version vulnérable) et `fast-xml-parser` 5.11.2 → 5.12.0 (faille de gravité faible), via `npm install --before`. Vérifier `npm audit` de temps en temps : `next build` échoue quand la version de Next.js est vulnérable, et le lanceur retombe alors en mode développement.

Ce dépôt est le tableau de bord personnel et la source unique de vérité de son propriétaire : un dossier de fichiers Markdown, maintenu de session en session. Toute session future DOIT suivre les règles ci-dessous.

Les mots « DOIT », « NE DOIT PAS », « DEVRAIT », « PEUT » ont le sens de la RFC 2119 (MUST, MUST NOT, SHOULD, MAY).

## 1. Contraintes générales

- Tous les fichiers de **contenu personnel** DOIVENT être du Markdown simple (`.md`) : pas de base de données, pas de JSON. (Exceptions : `archive/.gitkeep` ; les images des pages de docs, `projects/<projet>/assets/*.png|jpg|webp|gif`, section 22.)
- Le code de l'application web vit **uniquement** dans `app/` (voir section 9). Hors de `app/`, aucun script ni dépendance, à deux exceptions près : le lanceur macOS `Lancer le dashboard.command` à la racine (exécutable, voir `app/README.md`) et le workflow `.github/workflows/rappels.yml` (section 21), qui exécute un script de `app/`.
- Les fichiers DOIVENT rester lisibles et modifiables à la main dans n'importe quel éditeur de texte.
- Noms de fichiers et de dossiers : minuscules, kebab-case (ex. `projects/side-app/`).
  - **Exceptions autorisées** : les fichiers de revue `reviews/YYYY-Www.md` (ex. `2026-W46.md`, avec `W` majuscule, semaine ISO 8601) ; les fichiers racine imposés `CLAUDE.md`, `DASHBOARD.md`, `INBOX.md` et les `README.md` ; les préfixes `_` des templates (`_template`) ; le contenu de `app/`, qui suit les conventions de Next.js (`[slug]`, `next.config.ts`, `README.md`…) ; `.gitignore` ; le lanceur macOS `Lancer le dashboard.command` (nom imposé par le propriétaire).
- Dates : ISO 8601, `YYYY-MM-DD`.
- Langue du contenu : français. Noms de fichiers/dossiers et clés de frontmatter : anglais.
- NE JAMAIS inventer de projets, de tâches ou de contenu. Toute information inconnue DOIT être laissée sous la forme d'un marqueur explicite : `TODO: fill in`.

## 2. Structure

```
CLAUDE.md               # Ce fichier : règles pour les sessions futures
DASHBOARD.md            # Page de synthèse unique (générée)
INBOX.md                # Capture rapide, non triée
MEMO.md                 # Ancien mémo, conservé tel quel (voir section 10)
NEWS.md                 # Sources d'actus RSS et disposition des widgets (voir section 11)
NOTIONS.md              # Glossaire à mémoriser (voir section 12)
FAVORIS.md              # Favoris (voir section 15)
AGENDA.md               # Événements personnels, calendrier « Perso » (voir section 18)
TACHES.md               # Tâches datées et réglages des rappels (voir section 20)
SURLIGNAGES.md          # Passages surlignés dans les newsletters (voir section 19)
.gitignore              # Secrets et fichiers générés
Lancer le dashboard.command  # Lanceur macOS en double-clic (doit rester exécutable)
.github/workflows/rappels.yml # Rappels par e-mail des tâches (voir section 21)
app/                    # Application web (code uniquement, voir section 9)
projects/               # Un dossier par projet en cours
  _template/README.md
  _template/docs-templates/   # Modèles de pages de docs (section 22)
  <projet>/docs/        # Pages de docs du projet (section 22) ; docs/_archive/ = pages supprimées
  <projet>/assets/      # Images des pages de docs
areas/                  # Responsabilités continues sans date de fin (finances, santé…)
  _template/README.md
archive/                # Projets terminés ou abandonnés, déplacés tels quels
  .gitkeep
reviews/                # Revues hebdomadaires, un fichier par semaine
  _template.md
```

## 3. Projets — `projects/<nom-du-projet>/README.md`

Créer un projet = copier `projects/_template/` vers `projects/<nom-kebab-case>/` et remplir.

Frontmatter YAML obligatoire (toute valeur contenant « : » DOIT être entre guillemets, ex. `title: "TODO: fill in"`, sinon le YAML est invalide) :

| Clé | Valeurs |
|-----|---------|
| `title` | texte |
| `status` | `idea` \| `active` \| `paused` \| `done` \| `dropped` |
| `priority` | `P1` \| `P2` \| `P3` |
| `created` | `YYYY-MM-DD` |
| `updated` | `YYYY-MM-DD` |
| `next_action` | texte |
| `deadline` | `YYYY-MM-DD` ou vide (optionnel) |
| `stage` | étape : `idee` \| `recherche` \| `conception` \| `realisation` \| `lancement` \| `suivi` (liste dans `dashboard.config.ts`, `projectStages`) ; absente = `idee`, ajoutée par l'app à la première modification |
| `started` | `YYYY-MM-DD` ou vide (optionnel) : début réel |
| `tags` | `a, b` (optionnel, minuscules) |

Sections obligatoires, dans cet ordre : `## Objectif`, `## Prochaines actions` (liste de cases à cocher), `## Notes`, `## Liens`, `## Journal` (entrées datées, ordre antichronologique : la plus récente en haut).

Sections facultatives (modèle et page projet) : `## Pourquoi`, `## Critères de réussite`, `## Ressources`, `## Risques` (après Objectif), `## Jalons` (avant Journal : `- [ ] YYYY-MM-DD — Titre`, `[x]` = atteint, ordre chronologique). Une section ajoutée par l'app se place dans cet ordre : Objectif, Pourquoi, Critères de réussite, Ressources, Risques, Prochaines actions, Notes, Liens, Jalons, Journal.

## 4. Domaines — `areas/<nom-du-domaine>/README.md`

Créer un domaine = copier `areas/_template/` vers `areas/<nom-kebab-case>/`.

Frontmatter : `title`, `status`, `priority`, `created`, `updated` (pas de `deadline` ni de `next_action`).

Sections obligatoires : `## Rôle`, `## Standards à maintenir`, `## Notes`.

## 5. Revues — `reviews/YYYY-Www.md`

- Un fichier par semaine ISO, nommé `YYYY-Www.md` (ex. `2026-W46.md`). C'est une exception autorisée à la règle des minuscules.
- Créer une revue = copier `reviews/_template.md`.
- Sections : `## Fait cette semaine`, `## Bloqué`, `## Inbox traitée`, `## Focus semaine prochaine` (3 éléments maximum).
- La « dernière revue » est le fichier `YYYY-Www.md` le plus récent (tri par nom), en ignorant `_template.md`.

## 6. INBOX.md

- Liste de cases à cocher datées : `- [ ] YYYY-MM-DD — texte`.
- Un élément traité est coché `- [x]` (ou retiré après accord, voir règle sur la suppression).
- La ligne sous `## Exemple (non compté)` est un exemple : elle NE DOIT PAS être comptée.
- Seules les lignes `- [ ]` sous `## Éléments` comptent comme non traitées.

## 7. DASHBOARD.md — règles de génération

DASHBOARD.md est **dérivé** : il NE DOIT contenir aucune information qui n'existe pas ailleurs (frontmatter des projets/domaines, revues, INBOX.md). Ne jamais y saisir de contenu original.

Sections, dans cet ordre :

1. `## Focus de la semaine` : 3 éléments maximum, repris de `## Focus semaine prochaine` de la dernière revue. Si aucune revue n'existe : `TODO: fill in`.
2. `## Projets actifs` : tableau `Projet` (lien relatif vers le README) | `Priorité` | `Statut` | `Prochaine action` | `Deadline`. Projets avec `status: active` uniquement. Tri par priorité (P1 → P3), puis par deadline (la plus proche d'abord, vides en dernier).
3. `## En pause / idées` : courte liste avec liens des projets `paused` et `idea`.
4. `## Domaines` : liste de liens vers chaque `areas/<nom>/README.md`.
5. `## Inbox` : nombre d'éléments non traités dans INBOX.md, avec un lien.

Les dossiers `_template` et `archive/` sont toujours exclus du dashboard.

## 8. Règles permanentes

- Après TOUTE modification d'un fichier de projet ou de domaine, il FAUT mettre à jour son champ `updated` (date du jour) ET régénérer DASHBOARD.md.
- Quand un projet passe à `done` ou `dropped`, il FAUT déplacer son dossier tel quel dans `archive/` (`git mv projects/<nom> archive/<nom>`) et le retirer des tableaux du dashboard.
- DASHBOARD.md DEVRAIT rester sous ~80 lignes. S'il dépasse, proposer une simplification au propriétaire au lieu de couper silencieusement.
- Il FAUT demander avant de supprimer un fichier, quel qu'il soit.
- Si le dépôt contient des fichiers inattendus (hors structure ci-dessus), demander avant d'y toucher.

## 9. Application web (`app/`)

Séparation stricte :

- **Contenu** (racine du dépôt, Markdown) = seule source de vérité : projets, domaines, tâches, inbox, revues, notions…
- **Code** (`app/`) = Next.js (App Router) + TypeScript + Tailwind CSS. Il lit le Markdown à chaque requête et NE DOIT PAS dupliquer ce contenu dans un autre format (pas de base, pas de JSON, pas de cache sur disque).
- L'app ne commite que via le bouton **Sauvegarder** (section 13), à la demande du propriétaire.
- Fichiers de contenu que l'app écrit (et uniquement ceux-là) — tableau tenu à jour à chaque phase :

  | Fichier | Phase | Ce que l'app y écrit |
  |---|---|---|
  | `NEWS.md` | 6 | sources d'actus publiques, regroupement des widgets, ordre et visibilité des widgets |
  | `NOTIONS.md` | 7 | notions (ajout rapide, import en masse, modification, suppression avec confirmation) |
  | `INBOX.md` | 11 | ajout daté (palette), élément routé coché `- [x]`, « Supprimer » retire la ligne |
  | `reviews/YYYY-Www.md` | 11 | revue générée depuis `reviews/_template.md` (ou sections mises à jour si elle existe déjà) |
  | `AGENDA.md` | 18 | événements « Perso » (création, modification, suppression avec confirmation), nom et couleur du calendrier |
  | `FAVORIS.md` | 10 | favoris (ajout / retrait par l'étoile, note personnelle, retrait d'un élément supprimé) |
  | `SURLIGNAGES.md` | 19 | surlignages (ajout depuis la lecture d'une newsletter, couleur, note, suppression avec confirmation) |
  | `TACHES.md` | 20 | tâches (ajout, modification, cochage, report, abandon, suppression avec confirmation, ordre) et réglages des rappels (frontmatter) |
  | `projects/*/README.md`, `areas/*/README.md` | 9, 22 | frontmatter (dont `stage`, `started`, `tags`), sections, actions, jalons, journal ; création depuis `_template` (sans `docs-templates/`) |
  | `projects/*/docs/*.md`, `projects/*/assets/*` | 22 | pages de docs (création, titre, texte, ordre, « Nouvelle décision », suppression = déplacement dans `docs/_archive/`) ; images collées ou déposées |
  | `archive/` | 9 | déplacement d'un projet passé à `done` / `dropped` (après confirmation) |
  | `DASHBOARD.md` | 9 | régénéré entièrement après chaque modification de projet / domaine (et de revue ou d'inbox) |

- Toute écriture passe par `app/src/lib/content-file.ts` : règle « fichier inchangé depuis la lecture » (empreinte de version, refus HTTP 409 sinon), modification ligne par ligne du seul bloc concerné, écriture atomique. Les fichiers restent modifiables à la main.
- DASHBOARD.md est régénéré par l'app (`app/src/lib/dashboard-md.ts`) selon la section 7 ; une session qui modifie le contenu à la main DOIT aussi le régénérer (section 8).

Règles :

- Lancement local : `npm run dev` dans `app/`, documenté en français dans `app/README.md`. L'app écoute uniquement sur `127.0.0.1`.
- Personnalisation (titre, couleur d'accent, fuseau, langue) : un seul fichier, `app/dashboard.config.ts`.
- **Fuseau d'affichage** : celui de l'ordinateur par défaut (`timeZone: null`). `dashboard.config.ts` PEUT forcer un fuseau précis (ex. `"Asia/Kuala_Lumpur"`). Ne jamais coder un fuseau en dur ailleurs : utiliser `displayTimeZone()` (`app/src/lib/display-tz.ts`).
- Interface en français, responsive (utilisable sur téléphone), thème clair/sombre (système + bouton manuel), une seule couleur d'accent.
- **Design** : système éditorial décrit dans `app/previews/redesign/BRIEF.md` (fond grège / noir chaud, police libre Inter Tight auto-hébergée, titres en minuscules très grands, petites capitales pour les étiquettes, fils fins, aucun arrondi sur cartes et images, une seule couleur d'accent). Jetons de couleur et utilitaires (`display`, `section-title`, `title-md`, `label`, `link-underline`, `rise`) dans `app/src/app/globals.css`. Mouvement discret, désactivé si `prefers-reduced-motion`. Contraste au moins AA dans les deux modes, focus visible partout.
- **En-tête** (`app/src/components/nav.tsx`, liste `HEADER_ITEMS`) : nom, navigation complète (Accueil, Projets, Notions, Newsletters, Surlignages, News, Favoris, Revue), heure locale avec le **zoom du dashboard** dessous (« − 100 % + », clic sur le pourcentage = retour à 100 % ; niveaux 80–125 %, `app/src/lib/zoom.ts`, `zoom` CSS sur `#zoom-root`, mémorisé dans le navigateur ; les fenêtres flottantes convertissent leurs mesures avec `viewportFactor()`), puis Sauvegarder, loupe (palette), « + » (notion) et thème. Sur téléphone : bouton « Menu » ouvrant un menu plein écran numéroté. La palette utilise `app/src/lib/navigation.ts` pour ses « Aller à … ».
- Raccourcis clavier : `app/src/components/shortcuts.tsx`. Les raccourcis à modificateur (`⌘K` / `Ctrl+K`) DOIVENT fonctionner partout, y compris pendant la saisie ; les raccourcis à une touche (`N`, `?`) ne s'activent JAMAIS pendant la saisie dans un champ.
- **Accueil** (`app/src/app/page.tsx`), de haut en bas — cet ordre est imposé :
  1. **En-tête** ;
  2. **01. agenda** : le calendrier, premier bloc de contenu et le plus grand (toutes ses fonctions) ;
  3. **02. à la une** : grille d'images des grands sujets (`app/src/components/home/headlines-grid.tsx`, logique pure `app/src/lib/headlines.ts`) : **uniquement des articles avec image** (image du flux, sinon `og:image`, cherchée côté serveur et mise en cache) — plus de cartes typographiques ; colonne vertébrale = ordre éditorial du flux FT International, les autres sources actives (une par site, ex. The Verge, Maddyness) intercalées à tour de rôle, **jamais plus de 2 sujets d'affilée de la même source** ; première rangée = deux grandes images de même format, hauteur plafonnée (≈ 50 % de l'écran), puis **rangées de 6 petites images** (`ROW_SIZE`, 14 sujets au plus : 2 + 6 + 6) ; mise en page sans trou selon le nombre de sujets (1, 2, 3, puis rangées réparties) ; une image qui ne charge pas retire le sujet ; étoiles actives ; pas d'autre extraction que la règle `og:image` existante ;
  4. **tout le reste** : ligne « revue de la semaine » (jour de revue), 03. projets actifs, 04. à retenir aujourd'hui (notions), 05. aujourd'hui (tâches en retard et du jour, cochables sur place, saisie rapide ; `app/src/components/tasks/today-checklist.tsx`, à la place de l'ancien mémo), 06. newsletters.
- Aucune fonctionnalité ne doit prendre la place du calendrier ni de « à la une ».
- Le **Focus de la semaine** n'est plus sur l'accueil : il est en haut de l'onglet « aujourd'hui » de `/projets`, en version compacte (`FocusCard compact`). DASHBOARD.md garde sa section « Focus de la semaine » inchangée.
- **Section « projets »** (entrée unique « Projets » de l'en-tête, qui remplace Projets et Mémo) : quatre onglets, chacun avec son adresse — `/projets/aujourdhui` (par défaut, `/projets` y redirige), `/projets/pipeline`, `/projets/liste`, `/projets/domaines` (`app/src/app/projets/(onglets)/`, onglets `app/src/components/projects/project-tabs.tsx`). Les anciens liens `/projets?statut=…`, `?archive=…`, `?nouveau=projet` vont sur « liste ». Les noms `aujourdhui`, `pipeline`, `liste`, `domaines` sont réservés (pas de projet à ces noms).
- Lanceur macOS : `Lancer le dashboard.command`. À chaque lancement : (1) repasse sur `main` sauf s'il reste du contenu non sauvegardé (message demandant « Sauvegarder ») ; (2) `git pull --ff-only` (jamais forcé, n'efface rien) ; si l'historique a divergé (sauvegardes faites sur le Mac mais pas envoyées, ex. clé orange) et que les modifications en cours ne touchent aucun fichier mis à jour, `git pull --rebase --autostash` remet sauvegardes et modifications par-dessus la nouvelle version (comme « Sauvegarder »), `git rebase --abort` en cas de conflit, en nommant les fichiers en cause ; sinon démarre sur la version locale et explique. Résultat écrit dans `app/data/update-status.local.json` et affiché par le bouton « Mettre à jour » (« Mise à jour bloquée » + raison) ; (3) `npm ci` seulement si l'empreinte de `package-lock.json` a changé ; (4) `git push --dry-run` non interactif, résultat écrit dans `app/data/push-check.local.json` et affiché dans le panneau « Sauvegarder » (clé orange) ; puis vérifie Node.js ≥ 22 et démarre l'app. Il DOIT rester exécutable (`git update-index --chmod=+x`). **Mode service** (`DASHBOARD_SERVICE=1`) : le même lanceur, lancé sans fenêtre par un agent macOS (`~/Library/LaunchAgents/local.dashboard.plist`, installé / retiré par `app/scripts/install-service.sh [--off]`) à chaque ouverture de session, relancé par macOS en cas d'échec ; aucune question, pas de navigateur ouvert, journal `~/Library/Logs/dashboard.log`. Un double-clic sur le lanceur pendant que le service tourne ouvre simplement le navigateur. **Le lanceur sert l'app en mode production** (`next build` puis `next start`, toujours sur 127.0.0.1) : il reconstruit (`rm -rf app/.next` puis `next build`, journal dans `$TMPDIR/dashboard-build.log`) seulement si `git rev-parse HEAD` diffère de `app/node_modules/.dashboard-head` (écrit après une construction réussie) ou s'il n'y a pas de construction ; si la construction échoue, il démarre en mode développement et l'explique. Raison : en développement, des styles Tailwind périmés étaient servis après une mise à jour (cartes et images cassées). `npm run dev` reste réservé au développement ; le cache disque de Turbopack y est désactivé (`next.config.ts`). **Bouton « Mettre à jour »** (`app/src/components/update-button.tsx`, route `app/src/app/api/app/update/`) : affiché quand `origin/main` a des nouveautés par rapport à la version **en service** (`app/node_modules/.dashboard-head`, sinon `HEAD` ; `git fetch` au plus toutes les 10 min, arguments fixes) ; en mode service, il arrête le serveur avec le code 1, macOS relance le service qui se met à jour ; hors service, il explique de relancer le lanceur. Aussi dans la palette.
- Les instructions de test données au propriétaire NE DOIVENT contenir que des étapes réalisables sur son ordinateur, ou sur son téléphone **uniquement via l'accès Tailscale** une fois celui-ci en place (pour l'affichage mobile, le mode « responsive » des outils de développement du navigateur reste la méthode de base).
- **Accès depuis le téléphone (Tailscale)** : l'app écoute toujours uniquement sur `127.0.0.1` ; le téléphone y accède par **Tailscale Serve** (réseau privé, HTTPS), activé par `app/scripts/enable-phone-access.sh` (`--off` pour désactiver). Toute requête non locale (`app/src/lib/remote-access.ts` : Host local ET adresse d'origine 127.0.0.1/::1) exige le mot de passe `DASHBOARD_BASIC_AUTH` (`identifiant:mot-de-passe`, 12 caractères minimum, dans `app/.env.local`), sinon 403. **Jamais `tailscale funnel` ni aucune exposition publique.** La connexion Outlook ne se fait que depuis le Mac (redirection `localhost`).
- Le travail se fait sur une branche ; une session PEUT ouvrir et fusionner elle-même une pull request vers `main` (autorisation du propriétaire). **Jamais de push forcé, jamais de réécriture de l'historique de `main`.**
- **Ne rien déployer.** Tout déploiement futur DOIT exiger une authentification : `app/src/proxy.ts` bloque tout accès non local tant qu'un `DASHBOARD_BASIC_AUTH` valide n'est pas défini.
- **Dépendances** : versions figées exactement dans `package.json` (pas de `^` ni `~`, `save-exact=true` dans `app/.npmrc`). Ne JAMAIS installer une version publiée il y a moins de 14 jours ; utiliser `npm install --before=<aujourd'hui − 14 j>`.

### Calendrier

- Abonnements ICS ajoutés depuis l'interface (nom, couleur, lien) ; renommer, recolorer, supprimer depuis « Gérer les calendriers ».
- Flux téléchargés **côté serveur** (`app/src/lib/ics.ts`), cache en mémoire de 5 minutes, bouton de rafraîchissement forcé.
- Récurrences (RRULE, RDATE, EXDATE, RECURRENCE-ID, occurrences annulées) développées par `ical.js`. Heures avec TZID : VTIMEZONE du flux, sinon nom IANA ou Windows (`app/src/lib/tz.ts`).
- **Heures « flottantes »** (ni TZID ni `Z`), dans cet ordre : (1) fuseau choisi pour ce calendrier dans « Gérer les calendriers » ; (2) `X-WR-TIMEZONE` du calendrier ; (3) l'unique `VTIMEZONE` du fichier, s'il y en a exactement un ; (4) sinon le fuseau d'affichage.
- Chaque calendrier a un réglage optionnel « Fuseau horaire » (liste IANA avec recherche), « Automatique » par défaut.
- **Regroupement d'affichage** : les événements consécutifs d'un même calendrier, de même titre et même lieu, l'un finissant quand l'autre commence, sont affichés en un seul bloc (ex. 08:00–11:00). Option activée par défaut, désactivable dans « Gérer les calendriers ». Les événements d'origine ne sont jamais modifiés.
- Réglages du calendrier (abonnements, fuseaux, regroupement) : `app/data/calendars.local.json` (ignoré par git).
- Tests : `npm test` dans `app/` (Vitest). Les fichiers ICS de test sont dans `app/test/fixtures/` (données fictives) ; tout cas réel problématique DOIT y être reproduit avec un test.
- Un flux en échec affiche le nom du calendrier et la raison, sans bloquer les autres.
- Les calendriers **abonnés** restent en lecture seule (clic = détails). Les événements personnels vont dans le calendrier intégré « Perso » (section 18).
- **Calques intégrés « Tâches » et « Jalons »** (`app/src/lib/calendar-layers.ts`, ajoutés par `app/src/app/api/events/`) : listés dans « Gérer les calendriers » avec leur couleur et un interrupteur « Afficher » (réglages dans `options.layers` de `calendars.local.json`). Tâches (TACHES.md) : avec heure = événement (durée de la tâche, sinon 30 min, heure convertie du fuseau de TACHES.md vers le fuseau d'affichage), sans heure = journée entière, abandonnées masquées. Jalons (`## Jalons` des projets, `app/src/lib/milestones.ts`) : journée entière, « Jalon · Projet ». Une case à cocher (jamais imbriquée dans un autre bouton) coche la tâche ou le jalon ; faits = barrés et pâlis ; clic sur le titre = détails avec lien vers l'onglet « aujourd'hui » ou les jalons du projet. Clic sur un créneau libre : choix « Événement » (Perso) ou « Tâche » (date et heure pré-remplies, « Sans heure » possible).

### Secrets

- Identifiants et jetons Microsoft : `app/.env.local` (ignoré par git). Modèle sans valeur : `app/.env.example`.
- Liens d'abonnement aux calendriers (secrets) : `app/data/calendars.local.json` (ignoré par git). Ne JAMAIS les versionner.
- Outlook : lecture seule, permission Microsoft Graph `Mail.Read` uniquement (plus les permissions de connexion `openid`, `profile`, `offline_access`), et seulement le dossier configuré (`newslettersFolder` dans `dashboard.config.ts` : `"inbox"` = Boîte de réception, l'adresse du propriétaire étant dédiée aux newsletters ; sinon le nom d'un dossier). Les newsletters ne sont JAMAIS enregistrées dans le dépôt (mémoire seulement, quelques minutes).
- Application Microsoft « publique » (PKCE, aucun secret client) ; `MS_CLIENT_ID` et `MS_TENANT` dans `app/.env.local` ; URI de redirection `http://localhost:3000/api/outlook/callback`. Jetons : `app/data/msal-cache.local.json` (ignoré par git, droits 0600), supprimés par « Se déconnecter ».
- HTML des e-mails, deux affichages :
  - **« Lecture »** (par défaut, surlignable) : rendu **dans la page** de l'app après un nettoyage **strict** (`sanitizeForReading` dans `app/src/lib/outlook.ts` : liste blanche courte de balises de texte, liens http(s)/mailto/tel ouverts à part, tableaux, images seulement si « Images » ; **aucun** attribut style, class, id ou name ; aucun script, formulaire, cadre, SVG, objet, méta, lien de feuille de style), **plus** une CSP à nonce sur `/newsletters/<id>` (`app/src/lib/csp.ts`, posée par `app/src/proxy.ts` : seuls les scripts de l'app portant le nonce s'exécutent, `script-src-attr 'none'`, images distantes seulement si « Images »). Tests : `app/test/reading-security.test.ts`. Toute modification de ce nettoyage DOIT garder ces tests verts et en ajouter pour tout nouveau cas.
  - **« Original »** (mise en page de l'expéditeur sur fond blanc) : iframe `sandbox` **sans `allow-scripts`** (seulement `allow-same-origin` pour mesurer la hauteur et reprendre la police, `allow-popups` pour les liens), CSP stricte propre (`app/src/lib/email-document.ts`).
  - Images distantes bloquées par défaut (« Images »).
- **Exception étroite et voulue** à « le corps d'un e-mail n'est jamais écrit dans le dépôt » : les passages que le propriétaire **surligne lui-même** (section 19), 1 000 caractères au plus chacun, jamais l'e-mail entier.
- **Avant chaque commit**, vérifier qu'aucun secret, jeton ou lien de calendrier n'est indexé : `git status`, `git diff --cached --name-only` (aucun `.env*` réel ni `*.local.json`) et une recherche dans `git diff --cached` de motifs comme `webcal:`, `.ics`, `client_secret`, `token`, `password`.

## 10. MEMO.md — choses à retenir (retiré de l'app)

> Depuis le 2026-11-24, le mémo est remplacé par les tâches (section 20) : plus de page `/memo` (redirigée vers `/projets/aujourdhui`), plus d'API ni de carte sur l'accueil. **MEMO.md reste dans le dépôt, intact** (il ne contenait aucune entrée) ; il NE DOIT PAS être supprimé sans l'accord du propriétaire. Les règles ci-dessous (format, pas de secrets) restent valables s'il est modifié à la main.

Fichier unique à la racine. Une entrée = un bloc, du plus récent au plus ancien :

```markdown
# Mémo

## 2026-11-13 — Titre court
id: 20261113-1
pinned: yes
tags: maison, admin

Texte libre, sur une ou plusieurs lignes.
```

- Titre : `## YYYY-MM-DD — Titre court` (tiret cadratin `—`). Plusieurs entrées le même jour sont permises.
- `id:` court et lisible, `YYYYMMDD-n` (n = numéro d'ordre dans la journée), unique : c'est lui qui distingue deux entrées de même date et de même titre.
- `pinned:` `yes` ou `no`. `tags:` liste séparée par des virgules, éventuellement vide.
- **MEMO.md NE DOIT JAMAIS contenir de mots de passe, codes d'accès, numéros de carte ni aucun secret** : le dépôt est sur GitHub. Si une demande en contient, refuser de l'y écrire et le signaler.
- L'app refuse elle aussi ces contenus (`app/src/lib/secrets.ts` : « mot de passe : … », digicode, numéro de carte valide, IBAN, clé ou jeton) et affiche un rappel d'une ligne sous chaque zone de saisie.
- Une entrée écrite à la main sans `id:` est acceptée ; l'app lui ajoute un `id:` à sa première modification. Les titres `##` qui ne suivent pas le format `## YYYY-MM-DD — Titre` sont ignorés et conservés tels quels.
- (Ancienne page `/memo` : retirée.)

## 11. NEWS.md — actus (flux RSS)

```markdown
## Réglages
widgets: source              # « source » (un widget par source) ou « category » (un par catégorie)

## Ordre des widgets
- [x] ft-world               # [x] visible, [ ] masqué ; « cat:Marchés » en mode catégorie

## FT World
id: ft-world
url: https://www.ft.com/world?format=rss
category: Monde
color: #d9612f
enabled: yes
```

- `## Réglages` et `## Ordre des widgets` sont des sections réservées ; tout autre titre `##` avec une ligne `url:` est une source. Les autres lignes d'un bloc (notes à la main) sont conservées.
- **Lien privé** (URL contenant une clé personnelle, ex. flux myFT) : JAMAIS dans NEWS.md. Il est stocké dans `app/data/news.local.json` (ignoré par git). L'app refuse d'enregistrer dans NEWS.md un lien qui ressemble à une clé et demande de cocher « Lien privé ».
- Flux téléchargés côté serveur uniquement, au plus une fois toutes les 5 minutes par flux (un flux en échec peut être retenté par « Rafraîchir » au bout d'une minute) ; dédoublonnage (même URL ou titre quasi identique). Aucun article n'est écrit dans le dépôt, aucun texte d'article n'est récupéré, aucun paywall n'est contourné, aucun identifiant FT n'est utilisé. Pas d'intégration X / Twitter.
- Vignettes : celles du flux (media:content, media:thumbnail, enclosure), sinon uniquement la balise `og:image` de l'article, au plus une fois par article, en cache dans le dossier temporaire du système (hors dépôt). Jamais pour les liens Google News.
- Accueil : la section « à la une » (grille d'images, 14 sujets au plus, section 9) est la seule présence des actus sur l'accueil ; ne pas en ajouter d'autre.
- Page `/news` : les widgets ne montrent que les articles illustrés ; les articles **dont on sait qu'ils n'ont pas d'image** (lien Google News, page sans `og:image` ou refusée) sont marqués `noImage` par `app/src/lib/news.ts` et affichés dans le **Fil**, liste compacte sous les widgets (étoile, clic). Un widget qui n'a que des articles sans image n'apparaît qu'en mode « Organiser ». La page d'un widget (`/news/<clé>`) garde tous ses articles.
- Sources ajoutées le 2026-11-24 : The Verge (Tech), The Economist (Monde ; flux de titres seulement : ses pages d'articles renvoient une vérification anti-robot Cloudflare, donc pas d'image — **ne jamais contourner**), Maddyness (Startups).

## 12. NOTIONS.md — notions (répétition espacée)

```markdown
## Terme
tags: eco, finance
added: 2026-11-13

Définition (une ou plusieurs lignes).

> Exemple ou contexte (facultatif).
```

- Une notion sans définition est acceptée (« à compléter ») et n'apparaît jamais en révision.
- **La progression (boîte, échéance, historique) n'est JAMAIS écrite dans NOTIONS.md** : elle est dans `app/data/notions-progress.local.json` (ignoré par git), indexée par un identifiant dérivé du terme (kebab-case). Fichier perdu ou illisible : tout repart de zéro, sans erreur. Un terme renommé à la main perd sa progression (sans doublon ni erreur) ; renommé depuis l'app, il la garde.
- Leitner : intervalles 1, 2, 5, 14, 30, 90 jours (boîtes 1 à 6). « Je savais » : boîte suivante ; « À revoir » : boîte 1, à revoir demain. Une nouvelle notion est due le lendemain de son ajout. « Apprise » = boîte 4 ou plus. Réviser n'est jamais obligatoire.
- Accueil : « À retenir aujourd'hui » propose `notionsPerDay` notions (dashboard.config.ts, 3 par défaut) ; « Encore » en propose d'autres.
- **Onglet « Travailler »** (`/notions?onglet=travailler`, `app/src/components/notions/practice.tsx`, logique pure `app/src/lib/practice.ts`) : entraînement façon Quizlet, définition devant et mot derrière. Modes Cartes (retourner, « Je sais » / « À revoir », ← → Espace, glisser sur téléphone, annuler), QCM (4 mots, touches 1–4) et Écrire (accents et majuscules ignorés, une faute de frappe tolérée sur les mots longs, « J'avais bon »). Paquets : à revoir aujourd'hui, pas encore apprises, toutes ; mélange ; écran de fin avec « Revoir les ratées ». Mémoire : « À revoir » toujours enregistré ; « Je sais » seulement si la carte était due (pas d'avance gratuite). L'accueil (« À retenir aujourd'hui ») utilise la même carte, avec flèches et lien « Travailler ».
- Notion créée depuis un surlignage : ligne `highlight: hl-YYYYMMDD-n` après `added:` (lien vers le surlignage, conservé aux modifications ; « ↳ Voir le surlignage » dans le glossaire).
- Face visible des cartes : `notionsFront` (dashboard.config.ts) — `"definition"` (réglage du propriétaire : la définition d'abord, il faut retrouver le mot) ou `"term"`. Une définition ne DEVRAIT pas contenir le mot à trouver.
- Ajout rapide : bouton « + » de l'en-tête ou touche `N`. Import en masse « terme : définition » avec aperçu et doublons signalés (page `/notions`, onglet « Gérer »).
- Pas de secrets dans NOTIONS.md (même contrôle que le mémo).

## 13. Bouton « Sauvegarder » (git)

- Code : `app/src/lib/git.ts`. git est lancé **sans shell, avec des arguments fixes** ; le message de commit passe par l'entrée standard. Aucune saisie ne doit jamais devenir un argument de git.
- N'ajoute que le contenu : `*.md` à la racine, `projects/`, `areas/`, `reviews/`, `archive/`. Jamais `app/`, `app/data/`, `.env*`, ni un fichier ignoré. Refuse de continuer si des fichiers hors contenu sont déjà indexés.
- Contrôle des secrets sur les lignes ajoutées avant le commit (mêmes motifs que la vérification des commits de code + `lib/secrets.ts`) ; en cas de doute : `git reset`, rien n'est commité, fichiers intacts.
- Message automatique en français (« Contenu : MEMO.md, 2 mémos ajoutés ; projet x modifié »).
- `pull --rebase --autostash` puis `push`. **Jamais de push forcé.** Conflit : `rebase --abort`, fichiers intacts, commit local conservé, explication en français. Échec du push : commit local conservé (le bouton affiche « ↑ » et renverra au prochain clic).
- Hors de la branche `main` : confirmation demandée (panneau sous le bouton) avant tout commit.
- Rappel discret (point orange) si des modifications attendent depuis `saveReminderDays` jours (dashboard.config.ts, 3 par défaut).
- Tests : `app/test/git.test.ts` (dépôts temporaires : contenu seul, secret, autre branche, conflit, échec de push).

## 14. Modifier projets et domaines depuis l'app

- Code : `app/src/lib/markdown-doc.ts` (modifications ligne par ligne) et `app/src/lib/entries-edit.ts`.
- Projet (page `/projets/<nom>`, `app/src/components/projects/project-view.tsx`) : en-tête (titre, statut, **étapes cliquables**, priorité, deadline, avancement = % de jalons atteints, dernière activité = max de `updated`, du journal et des tâches liées faites) ; onglets `?onglet=` « vue d'ensemble » (Objectif, Pourquoi, Critères de réussite, Ressources, Risques, Notes, Liens avec l'éditeur « Écrire / Aperçu » ; prochaine action, prochaines actions avec « Planifier », début, tags), « tâches » (tâches liées, saisie rapide pré-liée), « jalons » (ajout, cochage → `Jalon atteint : …` au journal, modification, suppression avec confirmation), « docs » (section 22), « journal » (ajout rapide, plus récent en haut).
- Cocher une prochaine action la retire de la liste et ajoute `- YYYY-MM-DD — Fait : …` en haut du Journal.
- Domaine : titre, statut, priorité ; sections Rôle, Standards à maintenir, Notes.
- Chaque modification met `updated` à la date du jour et régénère DASHBOARD.md. Les commentaires du frontmatter (ex. `# idea | active…`) et les sections ajoutées à la main sont conservés (ces dernières affichées en lecture seule).
- « Nouveau projet » / « Nouveau domaine » : seul le titre est demandé ; copie de `_template`, `idea`/`P3` (projet) ou `active`/`P3` (domaine), le reste à `TODO: fill in`.
- Passer un projet à `done` ou `dropped` demande une confirmation, puis déplace son dossier tel quel dans `archive/` (suffixe de date si le nom existe déjà). **Aucune suppression de projet depuis l'interface.**
- Pas de titres `#`/`##` ni de secrets dans les textes saisis.

## 15. FAVORIS.md — favoris

```markdown
## 2026-11-13 — Titre
id: fav-20261113-1
type: article                # article | newsletter | notion | doc | project | highlight
ref: https://…               # lien, ou référence interne : notion:<id>, doc:<projet>/<page>, project:<dossier>, highlight:<id>
source: FT World
published: 2026-11-12        # facultatif
note: Note personnelle courte  # facultatif
```

- Étoile sur les articles (widgets et listes), newsletters (liste et lecture), notions, pages de docs (type « Doc », qui remplace « Mémo »), projets et surlignages ; les anciens favoris `memo` s'affichent « Élément supprimé » (retrait possible, plus d'ajout) ; page `/favoris` (filtre par type, recherche, note). Pas de widget de favoris sur l'accueil.
- **Articles : titre, URL, source, date uniquement. Newsletters : objet, expéditeur, date et lien Outlook web uniquement. Jamais le texte d'un article ni le corps d'un e-mail.**
- Références internes vérifiées à l'affichage : cible disparue → « Élément supprimé » avec bouton de retrait ; projet archivé → « Archivé ».
- L'étoile ajoute / retire un bloc sur le contenu du moment (rien d'autre n'est réécrit) ; la note suit la règle « fichier inchangé depuis la lecture ».

## 16. Revue hebdomadaire guidée (`/revue`)

- 4 étapes (Fait cette semaine, Bloqué, Inbox, Focus semaine prochaine), « Suivant » / « Retour », indicateur de progression ; toutes facultatives ; brouillon gardé dans le navigateur (localStorage, sans erreur s'il est indisponible).
- Semaine ISO calculée dans le **fuseau d'affichage** (`app/src/lib/review.ts`).
- « Fait » est pré-rempli avec les entrées de journal (dont « Fait : … ») datées de la semaine, projets actifs et archivés, puis les tâches faites cette semaine (TACHES.md) qui n'y figurent pas déjà.
- Inbox, élément par élément : « Action d'un projet » (devient une prochaine action), « Notion » (à compléter), « Tâche » (date au choix, aujourd'hui par défaut ; ajoutée à TACHES.md), « Supprimer » (retire la ligne, avec confirmation), « Garder ». Les éléments routés sont cochés `- [x]`.
- Focus : 3 éléments max parmi les prochaines actions des projets actifs, ou texte libre.
- Terminer crée `reviews/YYYY-Www.md` depuis le template et régénère DASHBOARD.md. **Une revue existante n'est jamais écrasée** : l'app propose de la modifier (mise à jour de ses sections).
- Accueil : ligne discrète « revue de la semaine — 5 min » en tête de la partie « tout le reste », à partir du jour `reviewDay` (dashboard.config.ts, 0 = dimanche) et tant que la revue de la semaine n'existe pas.

## 17. Palette de commandes et raccourcis

- `⌘K` / `Ctrl+K` (ou la loupe de l'en-tête) ouvre la palette, **même pendant la saisie dans un champ** ; `Échap` la ferme. `N` : nouvelle notion. `?` : aide des raccourcis. **Les raccourcis à une touche ne s'activent jamais pendant la saisie** (ni quand une fenêtre est déjà ouverte).
- Recherche approximative sans dépendance (`app/src/lib/fuzzy.ts`, insensible aux accents) sur : projets, domaines, tâches (à faire et faites récemment), jalons, pages de docs, notions, surlignages (passage, note, objet, expéditeur), éléments de l'inbox, favoris, newsletters (objet et expéditeur seulement, liste déjà en mémoire) et titres d'actus déjà en cache. Index : `GET /api/search-index` (aucun appel réseau).
- Actions : « Ajouter à l'inbox : … », « Nouvelle notion », « Nouvelle tâche », « Nouveau projet » (reprennent le texte tapé ; Maj+Entrée sur un texte inconnu = tâche), « Aller à … » pour chaque page, « Sauvegarder », « Changer de thème », « Faire la revue ».
- Un texte qui ne correspond à rien propose « Ajouter à l'inbox » comme action par défaut (Entrée) : capture en un raccourci et une touche.

## 18. AGENDA.md — calendrier « Perso »

```markdown
## Réglages
name: Perso
color: #a3451f

## 2026-11-20 — Dîner chez Paul
id: evt-20261120-1
start: 2026-11-20 19:30          # « YYYY-MM-DD » seul = journée entière
end: 2026-11-20 22:00            # journée entière : date de fin INCLUSE
timezone: Asia/Kuala_Lumpur      # fuseau IANA explicite, OBLIGATOIRE
location: Chez Paul              # facultatif
repeat: weekly                   # facultatif (seule répétition proposée)
until: 2026-12-31                # facultatif

Note libre (facultative).
```

- Calendrier intégré, toujours présent, nom et couleur modifiables dans « Gérer les calendriers » (jamais supprimé, pas de réglage de fuseau : chaque événement porte le sien).
- Création : clic sur un créneau libre (vues jour / semaine sur grand écran), « + Ajouter » d'un jour (semaine sur téléphone), clic sur un jour (vue mois) ou « + Événement ». Fenêtre : titre (obligatoire), date, heures ou « toute la journée », lieu, note, « chaque semaine ». Entrée enregistre.
- Clic sur un événement « Perso » : modifier ou supprimer (avec confirmation ; une répétition est modifiée / supprimée en entier). Clic sur un événement abonné : détails seulement.
- Nouvel événement : fuseau = fuseau d'affichage, écrit explicitement ; une modification garde le fuseau d'origine. Les occurrences sont recalculées dans le fuseau d'affichage (l'heure murale est conservée aux changements d'heure).
- Inclus dans le regroupement d'affichage, le fuseau, la palette (groupe « Agenda perso », ouvre `/?jour=YYYY-MM-DD`) et le bouton « Sauvegarder » (fichier `.md` racine). Bloc illisible (ex. sans fuseau) : ignoré sans erreur. Pas de secrets.
- Code : `app/src/lib/agenda.ts`, routes `app/src/app/api/agenda/`, fenêtre `app/src/components/calendar/event-dialog.tsx`, tests `app/test/agenda.test.ts`.
- Écrire dans Outlook ou Google est hors périmètre (voir `app/README.md` pour une piste future).

## 19. SURLIGNAGES.md — surlignages des newsletters

```markdown
## 2026-11-16 — Objet de la newsletter
id: hl-20261116-1
color: yellow                      # yellow | green | blue | pink
from: Aktionnaire <team@aktionnaire.com>
received: 2026-11-13T12:35:00Z     # date de la newsletter (Outlook)
link: https://outlook.live.com/…   # lien Outlook web
prefix: texte juste avant          # ancrage par citation (≈ 32 caractères)
suffix: texte juste après

> Le passage surligné (une ligne, 1 000 caractères au plus).

Note libre (facultative, plusieurs lignes possibles).
```

- **Exception documentée** (section 9, Secrets) : seuls les passages surlignés par le propriétaire, plafonnés à 1 000 caractères, jamais l'e-mail entier ni d'autre partie du corps.
- Écriture : `app/src/lib/highlights.ts` (règle « fichier inchangé depuis la lecture », plus récent en haut), routes `app/src/app/api/highlights/`. Contrôle des secrets à l'écriture (passage, note, préfixe, suffixe, objet, expéditeur) avec **le même contrôle que « Sauvegarder »** (`lineSecretReason`, `app/src/lib/secrets.ts`) : un code, mot de passe, numéro de carte, IBAN ou jeton est refusé avec un message en français. Inclus dans « Sauvegarder » (fichier `.md` racine).
- Ancrage (`app/src/lib/anchoring.ts`) : passage + préfixe + suffixe, recherche aux espaces normalisés, occurrence choisie par le contexte. Un surlignage qu'on ne retrouve plus reste dans `/surlignages`, marqué « introuvable dans le mail », sans erreur ; cet état est local (`app/data/highlights-status.local.json`, ignoré par git).
- Lecture (`/newsletters/<id>`, mode « Lecture » seulement, `app/src/components/newsletters/newsletter-reader.tsx`) : sélection à la souris ou par appui long (tactile) → barre flottante (4 couleurs, « Ajouter une note », « Créer une notion ») ; clic sur un surlignage → couleur, note, « Créer une notion », retrait avec confirmation. `?surlignage=<id>` fait défiler jusqu'au passage.
- « Créer une notion » : ajout rapide pré-rempli (définition = passage, contexte = objet — expéditeur, terme vide obligatoire) ; la notion garde `highlight: <id>`.
- Page `/surlignages` (`app/src/components/highlights/highlights-board.tsx`) : chronologique (plus récent d'abord) ou par newsletter ; filtres couleur et expéditeur ; recherche instantanée (passage, note, objet, expéditeur) ; par surlignage : « Ouvrir dans la newsletter » (`/surlignages/ouvrir/<id>` : la lecture défilée jusqu'au passage, sinon le lien Outlook web), note, couleur, suppression avec confirmation, étoile (favori `highlight:<id>`), « Créer une notion ». Pas de widget sur l'accueil. Inclus dans la palette.
- Tests : `app/test/highlights.test.ts`, `app/test/anchoring.test.ts`, `app/test/reading-security.test.ts`.


## 20. TACHES.md — tâches du jour

```markdown
---
timezone: Asia/Kuala_Lumpur
reminders: yes            # rappels par e-mail (section 21)
evening_digest: "18:00"
morning_digest: "08:00"
morning_enabled: no
autosync: yes             # envoi automatique de TACHES.md sur GitHub
---

# Tâches

- [ ] 2026-11-25 14:00 Appeler la banque ⏱30min #medtech ⏰-30m id:t-20261124-1
- [ ] 2026-11-30 07:00 Sport 🔁chaque-lundi id:t-20261124-2
- [x] 2026-11-24 Faire les courses id:t-20261124-3 ✓2026-11-24
- [-] 2026-11-20 Rappeler Paul id:t-20261120-1 ✗2026-11-24
```

- Une ligne par tâche : case (`[ ]` à faire, `[x]` faite, `[-]` abandonnée), **date obligatoire**, heure facultative, titre, puis marqueurs facultatifs dans n'importe quel ordre : `⏱durée` (`30min`, `1h`, `1h30`), `#projet` (dossier de `projects/`), `⏰` (rappel à l'heure) ou `⏰-30m` / `⏰-1h` (avant), `🔁tous-les-jours` / `🔁chaque-lundi` / `🔁le-1-du-mois`, `id:t-YYYYMMDD-n` (stable, date de création), `✓date` (faite) / `✗date` (abandonnée). Les autres lignes (texte à la main) sont conservées.
- Frontmatter : réglages **non secrets** des rappels uniquement (fuseau IANA, heures des récapitulatifs, matin activé, synchro auto). **L'adresse e-mail et la clé d'API ne sont JAMAIS dans le dépôt** (secrets GitHub Actions, section 21). Fichier créé au premier ajout, fuseau = fuseau d'affichage.
- Code : format et logique pure `app/src/lib/tasks-core.ts` (sans dépendance, partagé avec le workflow des rappels), saisie en français `app/src/lib/task-input.ts`, écriture `app/src/lib/tasks.ts` (règle « fichier inchangé depuis la lecture », sauf l'ajout ; contrôle des secrets `lineSecretReason`), regroupements `app/src/lib/tasks-view.ts`, route `app/src/app/api/tasks/`. Tests : `app/test/task-input.test.ts`, `tasks-core.test.ts`, `tasks.test.ts`.
- **Saisie rapide** (`app/src/components/tasks/task-quick-add.tsx`) : Entrée enregistre, date par défaut aujourd'hui, aperçu des morceaux reconnus avant l'enregistrement. Reconnus et retirés du titre : aujourd'hui, demain, après-demain, jours de la semaine (« lundi » = le prochain lundi, jamais aujourd'hui), dates (25/11, 25/11/2027, 25 nov, 1er décembre ; une date passée sans année = l'an prochain), heures (14h, 14h30, 9:15, midi, minuit), durées (1h, 30min ; « 2h » sans « à » vaut une heure si ≥ 6, une durée sinon), `#projet` (seulement s'il existe ; autocomplétion), récurrences (tous les jours, chaque lundi, tous les mois le 1er), `⏰`. Ambiguïté (deux dates, date impossible) : le texte reste dans le titre, la date reste aujourd'hui.
- **Récurrence** : cocher (ou abandonner) une occurrence crée la suivante (à partir d'aujourd'hui au plus tôt) et retire la récurrence de l'ancienne ; une occurrence non faite dont la date est passée reste « en retard » et la suivante est créée à la lecture (`rollRecurring`). Mensuelle le 31 : dernier jour des mois courts.
- **Onglet « aujourd'hui »** (`app/src/components/tasks/tasks-today.tsx`) : focus compact, saisie rapide, sections « en retard », « aujourd'hui » (toujours affichée, faites barrées dessous, progression discrète « 3 / 7 »), « demain », « cette semaine » (jusqu'au dimanche ; le week-end, la semaine suivante), puis « plus tard » replié ; sections vides masquées. Ligne : case, heure, titre, projet ; actions au survol / appui long / « ⋯ » (Aujourd'hui, Demain, Choisir une date, Modifier, Abandonner, Supprimer avec confirmation). En retard : « Reporter à aujourd'hui », « Reporter à demain », « Abandonner » (gardée barrée dans l'historique). Ordre d'une journée = ordre des lignes (glisser-déposer, ⌥/Ctrl+↑/↓) ; une tâche avec heure est insérée à sa place horaire. Espace coche, Entrée modifie. Lien « historique » (`?vue=historique`) : faites et abandonnées par semaine. Pas de séries ni de scores.
- **Projets** : cocher une tâche liée ajoute `- YYYY-MM-DD — Fait : …` en haut du Journal du projet (et met `updated` à jour) ; « Planifier » sur une prochaine action la retire du README (sans entrée au journal) et crée une tâche datée liée.
- **Palette** : « Nouvelle tâche » (reprend le texte tapé, même analyseur) ; sur un texte qui ne correspond à rien, **Maj+Entrée** crée une tâche (Entrée l'envoie toujours à l'inbox).
- Pas de secrets dans TACHES.md (même contrôle que le mémo).

## 21. Rappels par e-mail (GitHub Actions + Resend)

- **Exception explicite et unique à la règle « pas de notifications »** : les e-mails de rappel des tâches sont les seules notifications du dashboard. Aucune autre (navigateur, push, son, alerte) ne DOIT être ajoutée.
- Workflow `.github/workflows/rappels.yml` : toutes les heures (`7 * * * *`) et à la demande (`workflow_dispatch`, case « mail de test »). Il lit `TACHES.md` sur `main` et exécute `node --experimental-strip-types app/scripts/send-reminders.ts` (aucune dépendance installée ; le script n'importe que `app/src/lib/tasks-core.ts` et `app/src/lib/reminders-core.ts`, qui DOIVENT rester sans dépendance, imports relatifs en `.ts`, sans syntaxe TypeScript non effaçable).
- Envoi par l'API Resend (offre gratuite : expéditeur `onboarding@resend.dev`, destinataire = adresse du compte Resend uniquement), en-tête `Idempotency-Key`. **Secrets GitHub Actions uniquement** : `RESEND_API_KEY` et `REMINDER_TO` ; le workflow n'envoie JAMAIS ailleurs qu'à `REMINDER_TO`. L'adresse et la clé ne DOIVENT jamais apparaître dans le dépôt (ni TACHES.md, ni code, ni `.env`). Secrets absents : le passage horaire s'arrête sans erreur (pas de mail d'échec de GitHub) ; le mail de test, lui, échoue en expliquant.
- Règles (`app/src/lib/reminders-core.ts`, tests `app/test/reminders.test.ts`) : récapitulatif du soir (`evening_digest`, 18:00 par défaut : non faites d'aujourd'hui + en retard), du matin (`morning_digest`, 08:00, seulement si `morning_enabled: yes`, désactivé par défaut : tâches du jour), rappel d'une tâche (`⏰` à l'heure, `⏰-30m` avant) au premier passage horaire à partir de ce moment et au plus 6 h après (sinon sauté) ; heures lues dans le fuseau `timezone` de TACHES.md. **3 mails par jour au plus** (une place gardée pour le soir), aucun mail s'il n'y a rien à dire, plusieurs rappels d'un même passage regroupés en un mail. Français, HTML sobre au style du dashboard + texte brut, un lien par tâche vers `http://127.0.0.1:3000/projets/aujourdhui`.
- **Anti-doublon** : clé par mail (`evening:<jour>`, `morning:<jour>`, `task:<id>:<date>T<heure>:<rappel>` — un report réarme le rappel), gardée dans `sent.json` sur la branche dédiée **`rappels-etat`** (un commit par changement, jamais de push forcé ; choisie plutôt que le cache d'Actions, effacé après 7 jours sans accès), jamais dans TACHES.md ; clés oubliées après 14 jours.
- **Synchro automatique** (`app/src/lib/task-sync.ts`, `syncTasksFile` dans `app/src/lib/git.ts`, tests dans `app/test/git.test.ts`) : une minute après la dernière modification d'une tâche, commit limité à `TACHES.md` (`git commit --only`), contrôle des secrets, `pull --rebase --autostash`, `push` ; jamais de push forcé ; conflit → `rebase --abort` ; seulement sur `main` ; échec → message discret et nouvel essai 5 min plus tard. Activée par défaut, `autosync: no` la coupe. État en mémoire (« synchronisé il y a X min »).
- Panneau « rappels par e-mail » (`app/src/components/tasks/reminders-panel.tsx`, route `app/src/app/api/tasks/reminders/`) : activer, heures, matin, synchro, « Envoyer un mail de test » et dernier passage via **GitHub CLI** (`app/src/lib/gh.ts` : `gh workflow run rappels.yml --ref main -f test=true`, `gh run list`, sans shell, arguments fixes).
- Consommation estimée : ≈ 720 min/mois (1 min par passage). Dépôt public : gratuit et illimité ; s'il devient privé, ≈ 36 % des 2 000 min gratuites — fréquence horaire conservée.
- Guide de mise en place en français : `app/README.md`, « Rappels par e-mail ».

## 22. Pipeline, liste et pages de docs des projets

- **Pipeline** (`/projets/pipeline`, `app/src/components/projects/pipeline-board.tsx`, données `app/src/lib/project-board.ts`, indicateurs `app/src/lib/project-stats.ts`) : une colonne par étape, une carte par projet actif ou en pause (titre, priorité, deadline, barre d'avancement des jalons, prochaine tâche liée sinon `next_action`). Glisser une carte ou utiliser son menu « étape » (clavier) écrit `stage`. Bascules `?termines=1` (projets de `archive/`, lecture seule, pâlis) et `?chronologie=1` (jalons des 3 prochains mois, une ligne par projet). « à l'arrêt » : projet actif sans activité depuis `stalledDays` jours (dashboard.config.ts, 14) — simple mention, aucune alerte.
- **Liste** (`/projets/liste`) : filtres statut, priorité, étape, tags (`?statut=`, `?priorite=`, `?etape=`, `?tag=`) et tri priorité / deadline / dernière activité (`?tri=`). **Domaines** (`/projets/domaines`) : inchangés.
- **Pages de docs** (`app/src/lib/docs.ts`, routes `app/src/app/api/projects/[slug]/docs/` et `/assets/`, page `/projets/<projet>/docs/<page>`, `app/src/components/projects/doc-page.tsx`) : `projects/<projet>/docs/<page>.md` avec frontmatter `title`, `created`, `updated`, `order`, puis Markdown libre. Créer (vide ou depuis un modèle de `projects/_template/docs-templates/` : Brief, Recherche / benchmark, Journal de décisions, Specs, Retour d'expérience), renommer (le titre ; le nom de fichier reste, les liens tiennent), réordonner (glisser ou ↑/↓), modifier (« Écrire / Aperçu », ⌘S), **supprimer = ranger dans `docs/_archive/` après confirmation, jamais effacer**. Journal de décisions : « Nouvelle décision » ajoute un bloc daté en tête de `## Décisions`.
- Sommaire automatique dès 3 titres `##`/`###`. Liens `[[page]]`, `[[projet]]`, `[[projet/page]]`, `[[cible|texte]]` (`app/src/lib/wiki-links.ts`), autocomplétion après « [[ » ; lien cassé = visible, rouge pointillé, sans erreur.
- Images collées, déposées ou choisies : `projects/<projet>/assets/<horodatage>-<nom>.<ext>`, **5 Mo max, PNG/JPG/WebP/GIF vérifiés par leur signature** (jamais de SVG), insérées en `![](../assets/…)`, servies par `/api/projects/<projet>/assets/<fichier>` (type fixé, `nosniff`, CSP `default-src 'none'`). Images distantes non chargées dans les docs.
- Pages de docs dans la palette et les favoris (type « Doc »). Pas de secrets (même contrôle que le mémo). Tests : `app/test/docs.test.ts`, `app/test/milestones.test.ts`.
