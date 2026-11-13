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
MEMO.md                 # Choses à retenir (créé en phase 4, voir section 10)
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
- Le seul fichier de contenu que l'app écrit est `MEMO.md`. Elle ne fait jamais de commit.
- DASHBOARD.md reste maintenu par les sessions (règles des sections 7 et 8) ; l'app ne le génère pas.

Règles :

- Lancement local : `npm run dev` dans `app/`, documenté en français dans `app/README.md`. L'app écoute uniquement sur `127.0.0.1`.
- Personnalisation (titre, couleur d'accent, fuseau, langue) : un seul fichier, `app/dashboard.config.ts`.
- **Fuseau d'affichage** : celui de l'ordinateur par défaut (`timeZone: null`). `dashboard.config.ts` PEUT forcer un fuseau précis (ex. `"Asia/Kuala_Lumpur"`). Ne jamais coder un fuseau en dur ailleurs : utiliser `displayTimeZone()` (`app/src/lib/display-tz.ts`).
- Interface en français, responsive (utilisable sur téléphone), thème clair/sombre (système + bouton manuel), une seule couleur d'accent.
- Navigation : `app/src/lib/navigation.ts`. Ajouter une page (ex. `/news`) = ajouter une ligne.
- Accueil (`HOME_WIDGETS` dans `app/src/app/page.tsx`), dans cet ordre :
  1. **Calendrier** (pleine largeur, élément le plus grand) ;
  2. **À la une** (emplacement réservé aux actus, placeholder « Les actus arrivent bientôt » tant que la phase 6 n'est pas faite) à côté de **Projets actifs** ;
  3. **Dernières newsletters** et **À retenir** (épinglés).
- La phase 6 (actus RSS) DOIT remplir le widget existant `NewsWidget` (« À la une », juste sous le calendrier) et NE DOIT PAS ajouter un nouveau widget sous le calendrier.
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
- Outlook : lecture seule, permission Microsoft Graph `Mail.Read` uniquement (plus les permissions de connexion `openid`, `profile`, `offline_access`), et seulement le dossier « Newsletters » (configurable). Les newsletters ne sont JAMAIS enregistrées dans le dépôt.
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
