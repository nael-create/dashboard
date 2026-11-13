# CLAUDE.md — Règles de ce dépôt

Ce dépôt est le tableau de bord personnel et la source unique de vérité de son propriétaire : un dossier de fichiers Markdown, maintenu de session en session. Toute session future DOIT suivre les règles ci-dessous.

Les mots « DOIT », « NE DOIT PAS », « DEVRAIT », « PEUT » ont le sens de la RFC 2119 (MUST, MUST NOT, SHOULD, MAY).

## 1. Contraintes générales

- Tous les fichiers de **contenu personnel** DOIVENT être du Markdown simple (`.md`) : pas de base de données, pas de JSON. (Exception technique : `archive/.gitkeep`.)
- Le code de l'application web vit **uniquement** dans `app/` (voir section 9). Hors de `app/`, aucun script ni dépendance, à une exception près : le lanceur macOS `Lancer le dashboard.command` à la racine (exécutable, voir `app/README.md`).
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
MEMO.md                 # Choses à retenir (voir section 10)
NEWS.md                 # Sources d'actus RSS et disposition des widgets (voir section 11)
NOTIONS.md              # Glossaire à mémoriser (voir section 12)
.gitignore              # Secrets et fichiers générés
Lancer le dashboard.command  # Lanceur macOS en double-clic (doit rester exécutable)
app/                    # Application web (code uniquement, voir section 9)
projects/               # Un dossier par projet en cours
  _template/README.md
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

Sections obligatoires, dans cet ordre : `## Objectif`, `## Prochaines actions` (liste de cases à cocher), `## Notes`, `## Liens`, `## Journal` (entrées datées, ordre antichronologique : la plus récente en haut).

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

- **Contenu** (racine du dépôt, Markdown) = seule source de vérité : projets, domaines, inbox, revues, mémo.
- **Code** (`app/`) = Next.js (App Router) + TypeScript + Tailwind CSS. Il lit le Markdown à chaque requête et NE DOIT PAS dupliquer ce contenu dans un autre format (pas de base, pas de JSON, pas de cache sur disque).
- L'app ne commite que via le bouton **Sauvegarder** (section 13), à la demande du propriétaire.
- Fichiers de contenu que l'app écrit (et uniquement ceux-là) — tableau tenu à jour à chaque phase :

  | Fichier | Phase | Ce que l'app y écrit |
  |---|---|---|
  | `MEMO.md` | 4 | entrées du mémo (ajout, modification, épinglage, suppression avec confirmation) |
  | `NEWS.md` | 6 | sources d'actus publiques, regroupement des widgets, ordre et visibilité des widgets |
  | `NOTIONS.md` | 7 | notions (ajout rapide, import en masse, modification, suppression avec confirmation) |
  | `projects/*/README.md`, `areas/*/README.md` | 9 | frontmatter, sections, actions, journal ; création depuis `_template` |
  | `archive/` | 9 | déplacement d'un projet passé à `done` / `dropped` (après confirmation) |
  | `DASHBOARD.md` | 9 | régénéré entièrement après chaque modification de projet / domaine (et de revue ou d'inbox) |

- Toute écriture passe par `app/src/lib/content-file.ts` : règle « fichier inchangé depuis la lecture » (empreinte de version, refus HTTP 409 sinon), modification ligne par ligne du seul bloc concerné, écriture atomique. Les fichiers restent modifiables à la main.
- DASHBOARD.md est régénéré par l'app (`app/src/lib/dashboard-md.ts`) selon la section 7 ; une session qui modifie le contenu à la main DOIT aussi le régénérer (section 8).

Règles :

- Lancement local : `npm run dev` dans `app/`, documenté en français dans `app/README.md`. L'app écoute uniquement sur `127.0.0.1`.
- Personnalisation (titre, couleur d'accent, fuseau, langue) : un seul fichier, `app/dashboard.config.ts`.
- **Fuseau d'affichage** : celui de l'ordinateur par défaut (`timeZone: null`). `dashboard.config.ts` PEUT forcer un fuseau précis (ex. `"Asia/Kuala_Lumpur"`). Ne jamais coder un fuseau en dur ailleurs : utiliser `displayTimeZone()` (`app/src/lib/display-tz.ts`).
- Interface en français, responsive (utilisable sur téléphone), thème clair/sombre (système + bouton manuel), une seule couleur d'accent.
- Navigation : `app/src/lib/navigation.ts`. Ajouter une page = ajouter une ligne ; `mobile: true` la met dans la barre du bas sur téléphone, sinon elle est dans « Plus ».
- Raccourcis clavier : `app/src/components/shortcuts.tsx`. Les raccourcis à une touche (ex. `N`) ne s'activent JAMAIS pendant la saisie dans un champ.
- Accueil (`HOME_WIDGETS` dans `app/src/app/page.tsx`), dans cet ordre :
  1. **Calendrier** (pleine largeur, élément le plus grand) ;
  2. **À la une** (5 derniers titres d'actus) à côté de **Projets actifs** ;
  3. **À retenir aujourd'hui** (révision des notions, sous « À la une »), **Dernières newsletters** et **Mémo** (entrées épinglées).
- Le calendrier reste le premier et le plus grand élément, suivi de « À la une » (`NewsWidget`, rempli par les actus). Aucune fonctionnalité ne doit prendre leur place.
- Le **Focus de la semaine** n'est plus sur l'accueil : il est en haut de la page `/projets`. DASHBOARD.md garde sa section « Focus de la semaine » inchangée.
- Lanceur macOS : `Lancer le dashboard.command` vérifie Node.js ≥ 22, installe les dépendances seulement si besoin, démarre l'app et ouvre le navigateur. Il DOIT rester exécutable (`git update-index --chmod=+x`).
- Les instructions de test données au propriétaire NE DOIVENT contenir que des étapes réalisables sur son ordinateur (l'app n'écoute que sur 127.0.0.1 : pas de test sur téléphone ; pour l'affichage mobile, utiliser le mode « responsive » des outils de développement du navigateur).
- Toutes les phases sont commitées sur la même branche de travail ; la fusion dans `main` se fait par une pull request ouverte par le propriétaire sur GitHub.
- **Ne rien déployer.** Tout déploiement futur DOIT exiger une authentification : `app/src/proxy.ts` bloque tout accès non local tant que `DASHBOARD_BASIC_AUTH` n'est pas défini.
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
- Lecture seule : pas de création ni de modification d'événements.

### Secrets

- Identifiants et jetons Microsoft : `app/.env.local` (ignoré par git). Modèle sans valeur : `app/.env.example`.
- Liens d'abonnement aux calendriers (secrets) : `app/data/calendars.local.json` (ignoré par git). Ne JAMAIS les versionner.
- Outlook : lecture seule, permission Microsoft Graph `Mail.Read` uniquement (plus les permissions de connexion `openid`, `profile`, `offline_access`), et seulement le dossier « Newsletters » (`newslettersFolder` dans `dashboard.config.ts`). Les newsletters ne sont JAMAIS enregistrées dans le dépôt (mémoire seulement, quelques minutes).
- Application Microsoft « publique » (PKCE, aucun secret client) ; `MS_CLIENT_ID` et `MS_TENANT` dans `app/.env.local` ; URI de redirection `http://localhost:3000/api/outlook/callback`. Jetons : `app/data/msal-cache.local.json` (ignoré par git, droits 0600), supprimés par « Se déconnecter ».
- HTML des e-mails : nettoyé par `sanitize-html` puis affiché dans une iframe `sandbox` sans script avec une CSP stricte ; images distantes bloquées par défaut (bouton « Charger les images »).
- **Avant chaque commit**, vérifier qu'aucun secret, jeton ou lien de calendrier n'est indexé : `git status`, `git diff --cached --name-only` (aucun `.env*` réel ni `*.local.json`) et une recherche dans `git diff --cached` de motifs comme `webcal:`, `.ics`, `client_secret`, `token`, `password`.

## 10. MEMO.md — choses à retenir

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
- Page `/memo` : ajout, modification, épingler/désépingler, filtre par tag, recherche, suppression avec confirmation. L'accueil affiche les entrées épinglées (« À retenir »).

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
- Accueil : le widget existant « À la une » affiche les 5 derniers titres ; ne pas ajouter d'autre widget d'actus.

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
- Projet : titre, statut, priorité, `next_action`, `deadline` (sélecteurs et calendrier) ; sections Objectif, Notes, Liens (éditeur « Écrire / Aperçu ») ; prochaines actions (ajout, modification, ↑/↓) ; journal (entrée datée ajoutée en haut).
- Cocher une prochaine action la retire de la liste et ajoute `- YYYY-MM-DD — Fait : …` en haut du Journal.
- Domaine : titre, statut, priorité ; sections Rôle, Standards à maintenir, Notes.
- Chaque modification met `updated` à la date du jour et régénère DASHBOARD.md. Les commentaires du frontmatter (ex. `# idea | active…`) et les sections ajoutées à la main sont conservés (ces dernières affichées en lecture seule).
- « Nouveau projet » / « Nouveau domaine » : seul le titre est demandé ; copie de `_template`, `idea`/`P3` (projet) ou `active`/`P3` (domaine), le reste à `TODO: fill in`.
- Passer un projet à `done` ou `dropped` demande une confirmation, puis déplace son dossier tel quel dans `archive/` (suffixe de date si le nom existe déjà). **Aucune suppression de projet depuis l'interface.**
- Pas de titres `#`/`##` ni de secrets dans les textes saisis.
