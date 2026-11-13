# CLAUDE.md — Règles de ce dépôt

Ce dépôt est le tableau de bord personnel et la source unique de vérité de son propriétaire : un dossier de fichiers Markdown, maintenu de session en session. Toute session future DOIT suivre les règles ci-dessous.

Les mots « DOIT », « NE DOIT PAS », « DEVRAIT », « PEUT » ont le sens de la RFC 2119 (MUST, MUST NOT, SHOULD, MAY).

## 1. Contraintes générales

- Tous les fichiers de contenu DOIVENT être du Markdown simple (`.md`). Pas de base de données, pas de JSON, pas de scripts, pas de dépendances externes. (Seule exception technique : `archive/.gitkeep`, qui garde le dossier vide suivi par git.)
- Les fichiers DOIVENT rester lisibles et modifiables à la main dans n'importe quel éditeur de texte.
- Noms de fichiers et de dossiers : minuscules, kebab-case (ex. `projects/side-app/`).
  - **Exceptions autorisées** : les fichiers de revue `reviews/YYYY-Www.md` (ex. `2026-W46.md`, avec `W` majuscule, semaine ISO 8601) ; les fichiers racine imposés `CLAUDE.md`, `DASHBOARD.md`, `INBOX.md` et les `README.md` ; les préfixes `_` des templates (`_template`).
- Dates : ISO 8601, `YYYY-MM-DD`.
- Langue du contenu : français. Noms de fichiers/dossiers et clés de frontmatter : anglais.
- NE JAMAIS inventer de projets, de tâches ou de contenu. Toute information inconnue DOIT être laissée sous la forme d'un marqueur explicite : `TODO: fill in`.

## 2. Structure

```
CLAUDE.md               # Ce fichier : règles pour les sessions futures
DASHBOARD.md            # Page de synthèse unique (générée)
INBOX.md                # Capture rapide, non triée
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

Frontmatter YAML obligatoire :

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
