# Application web du dashboard

Interface web personnelle construite **au-dessus** des fichiers Markdown du dépôt.
Les fichiers Markdown (`projects/`, `areas/`, `reviews/`, `INBOX.md`, `MEMO.md`) restent la
seule source de vérité : l'application les lit directement, sans copie.

## Prérequis (une seule fois)

1. Installer **Node.js 22 LTS** (ou ≥ 20.9) : https://nodejs.org → bouton « LTS ».
   Pour vérifier, ouvrir un terminal et taper `node -v` : un numéro comme `v22.x.x` doit s'afficher.
2. Récupérer le dépôt sur ton ordinateur (si ce n'est pas déjà fait) :

   ```bash
   git clone https://github.com/nael-create/dashboard.git
   ```

3. Installer les dépendances (exactement les versions figées dans `package-lock.json`) :

   ```bash
   cd dashboard/app
   ```

   ```bash
   npm ci
   ```

## Lancer l'application

Depuis le dossier `app/` :

```bash
npm run dev
```

Puis ouvrir **http://127.0.0.1:3000** dans le navigateur. Pour arrêter : `Ctrl + C` dans le terminal.

L'application n'écoute que sur ton ordinateur (127.0.0.1) : elle n'est pas visible depuis le réseau.

## Personnaliser

Tout se règle dans **`app/dashboard.config.ts`** :

| Réglage | Effet |
|---|---|
| `title` | titre affiché en haut et dans l'onglet (ex. « Le QG de Nael ») |
| `accentColor` | couleur d'accent unique, au format `#rrggbb` |
| `timeZone` | fuseau horaire (par défaut `Asia/Kuala_Lumpur`) |
| `locale` | format des dates (par défaut `fr-FR`) |

Le thème clair/sombre suit le réglage du système ; le bouton en haut à droite alterne
**système → clair → sombre**.

## Pages

| Adresse | Contenu | État |
|---|---|---|
| `/` | Accueil : calendrier, focus de la semaine, projets actifs, aperçus | ✅ (calendrier en phase 3) |
| `/projets` | Projets et domaines, filtres par statut et priorité | ✅ |
| `/projets/<nom>` et `/domaines/<nom>` | Contenu du README, rendu | ✅ |
| `/memo` | Choses à retenir (`MEMO.md`) | phase 4 |
| `/newsletters` | Dossier « Newsletters » d'Outlook | phase 5 |

## Fichiers secrets (jamais versionnés)

| Fichier | Contenu |
|---|---|
| `app/.env.local` | identifiants Microsoft (phase 5) — modèle : `app/.env.example` |
| `app/data/calendars.local.json` | liens d'abonnement aux calendriers (phase 3) |

Ces fichiers sont listés dans le `.gitignore` à la racine du dépôt.

## Sécurité et déploiement

Rien n'est déployé. Si un jour l'application est hébergée, l'accès distant est **bloqué par défaut** :
il faut définir `DASHBOARD_BASIC_AUTH=identifiant:mot-de-passe` (voir `src/proxy.ts`), sans quoi
toute requête qui ne vient pas de `127.0.0.1`/`localhost` reçoit une erreur 403.

## Pour les développeurs

- Next.js (App Router) + TypeScript + Tailwind CSS. Versions figées exactement (pas de `^`).
- Ajouter une dépendance : version publiée depuis **au moins 14 jours**, par exemple
  `npm install --before=AAAA-MM-JJ paquet@version` (la date = aujourd'hui moins 14 jours).
- `npm run typecheck` : vérification des types. `npm run build` : compilation de production.
- Lire le contenu depuis un autre dossier (tests) : `CONTENT_DIR=/chemin npm run dev`.
