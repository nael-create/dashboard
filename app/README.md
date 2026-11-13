# Application web du dashboard

Interface web personnelle construite **au-dessus** des fichiers Markdown du dépôt.
Les fichiers Markdown (`projects/`, `areas/`, `reviews/`, `INBOX.md`, `MEMO.md`) restent la
seule source de vérité : l'application les lit directement, sans copie.

## Prérequis (une seule fois)

1. Installer **Node.js 22 LTS** (ou plus récent) : https://nodejs.org/fr/download → version « LTS ».
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

## Lancer l'application en double-cliquant (macOS)

À la racine du dépôt se trouve le fichier **`Lancer le dashboard.command`**. Double-clique dessus :

1. une fenêtre Terminal s'ouvre ;
2. le script vérifie que Node.js 22 (ou plus récent) est installé. Sinon, il affiche un message et ouvre la page de téléchargement ;
3. il installe les dépendances **seulement si nécessaire** (première fois, ou après une mise à jour) ;
4. il démarre le dashboard et ouvre **http://127.0.0.1:3000** dans ton navigateur.

Laisse la fenêtre Terminal ouverte pendant que tu utilises le dashboard. **Pour l'arrêter**, ferme cette fenêtre.
Si le dashboard tourne déjà, un nouveau double-clic ouvre simplement le navigateur.

### Premier lancement : l'avertissement de sécurité de macOS

macOS peut bloquer le fichier au premier double-clic (« Apple ne peut pas vérifier… » ou « développeur non identifié »). C'est normal pour un script que tu n'as pas téléchargé depuis l'App Store. Pour l'autoriser **une seule fois** :

1. Clique sur **OK** (ou **Terminé**) dans le message d'avertissement.
2. Ouvre **Réglages Système → Confidentialité et sécurité**.
3. Descends jusqu'à la section **Sécurité** : un message mentionne « Lancer le dashboard.command ». Clique sur **Ouvrir quand même**.
4. Confirme avec ton mot de passe (ou Touch ID), puis clique sur **Ouvrir**.

Sur les anciennes versions de macOS, on peut aussi faire **clic droit (ou Ctrl + clic) → Ouvrir → Ouvrir**.

Autres messages possibles :

- « Terminal souhaite accéder aux fichiers de ton dossier Documents (ou Bureau) » → clique sur **Autoriser**.
- « Tu n'as pas l'autorisation d'ouvrir l'application » : le fichier a perdu son droit d'exécution (cela peut arriver après un téléchargement en ZIP). Ouvre le Terminal, tape `chmod +x ` (avec l'espace), glisse le fichier dans la fenêtre, puis appuie sur Entrée.

## Lancer l'application en ligne de commande

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
| `/` | Accueil : calendrier, « À la une » (phase 6), projets actifs, aperçus newsletters et mémo | ✅ |
| `/projets` | Focus de la semaine, projets et domaines, filtres par statut et priorité | ✅ |
| `/projets/<nom>` et `/domaines/<nom>` | Contenu du README, rendu | ✅ |
| `/memo` | Choses à retenir (`MEMO.md`) | phase 4 |
| `/newsletters` | Dossier « Newsletters » d'Outlook | phase 5 |

## Calendrier

Le calendrier de l'accueil affiche tes agendas Outlook, Google ou iCloud **en lecture seule**, à partir de leur lien d'abonnement (ICS / iCal).

- **Ajouter** : « Ajouter un calendrier » (ou « Gérer les calendriers » en bas du calendrier), puis colle le lien, choisis un nom et une couleur. Le lien est vérifié avant d'être enregistré.
- **Renommer / changer la couleur / supprimer** : « Gérer les calendriers ». Clique sur le nom pour le modifier ; la suppression demande une confirmation.
- **Vues** : Jour (avec les 7 jours suivants), Semaine, Mois. Clic sur un jour → vue Jour.
- **Rafraîchir** : les agendas sont gardés en mémoire 5 minutes ; le bouton ⟳ force une mise à jour immédiate.
- **Erreurs** : si un agenda ne répond pas, un message indique lequel et pourquoi ; les autres s'affichent normalement.
- Fuseau horaire : tout est affiché à l'heure de `Asia/Kuala_Lumpur` (réglable dans `dashboard.config.ts`), récurrences et exceptions comprises.

Les liens d'abonnement sont **secrets** (quiconque les possède peut lire ton agenda). Ils sont enregistrés uniquement dans `app/data/calendars.local.json`, ignoré par git, et ne sont jamais renvoyés au navigateur.

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
