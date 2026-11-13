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
| `timeZone` | fuseau d'affichage ; `null` (par défaut) = celui de ton ordinateur, ou un nom comme `"Asia/Kuala_Lumpur"` pour le forcer |
| `locale` | format des dates (par défaut `fr-FR`) |

Le thème clair/sombre suit le réglage du système ; le bouton en haut à droite alterne
**système → clair → sombre**.

## Pages

| Adresse | Contenu | État |
|---|---|---|
| `/` | Accueil : calendrier, « À la une » (phase 6), projets actifs, aperçus newsletters et mémo | ✅ |
| `/projets` | Focus de la semaine, projets et domaines, filtres, « Nouveau projet » / « Nouveau domaine » | ✅ |
| `/projets/<nom>` et `/domaines/<nom>` | Modifier le projet / domaine (champs, sections, actions, journal) | ✅ |
| `/news` | Actus : widgets par source ou catégorie, glisser-déposer, masquer, sources gérées depuis l'app | ✅ |
| `/notions` | Notions : glossaire (« Tout consulter »), gestion, import en masse, impression | ✅ |
| `/revue` | Revue de la semaine guidée (4 étapes) | ✅ |
| `/favoris` | Favoris : filtre par type, recherche, note personnelle | ✅ |
| `/memo` | Choses à retenir (`MEMO.md`) : ajouter, modifier, épingler, filtrer par tag, supprimer | ✅ |
| `/newsletters` | Dossier « Newsletters » d'Outlook, en lecture seule | ✅ (après configuration) |

## Calendrier

Le calendrier de l'accueil affiche tes agendas Outlook, Google ou iCloud **en lecture seule**, à partir de leur lien d'abonnement (ICS / iCal).

- **Ajouter** : « Ajouter un calendrier » (ou « Gérer les calendriers » en bas du calendrier), puis colle le lien, choisis un nom et une couleur. Le lien est vérifié avant d'être enregistré.
- **Renommer / changer la couleur / supprimer** : « Gérer les calendriers ». Clique sur le nom pour le modifier ; la suppression demande une confirmation.
- **Vues** : Jour (avec les 7 jours suivants), Semaine, Mois. Clic sur un jour → vue Jour.
- **Rafraîchir** : les agendas sont gardés en mémoire 5 minutes ; le bouton ⟳ force une mise à jour immédiate.
- **Erreurs** : si un agenda ne répond pas, un message indique lequel et pourquoi ; les autres s'affichent normalement.
- **Fuseau d'affichage** : celui de ton ordinateur (indiqué en bas du calendrier), sauf si `dashboard.config.ts` en force un.
- **Fuseau d'un calendrier** : certains agendas (souvent scolaires) donnent des heures sans fuseau. L'app le devine automatiquement (réglage du calendrier, puis fuseau déclaré dans le fichier) et affiche sa déduction dans « Gérer les calendriers ». Si c'est faux, tape le bon fuseau dans « Fuseau horaire » (ex. `Europe/Paris`) ; « Automatique » revient à la détection.
- **Regrouper les événements consécutifs** (activé par défaut) : trois cours identiques de 08:00 à 11:00 s'affichent en un seul bloc. Affichage seulement ; désactivable dans « Gérer les calendriers ».

Les liens d'abonnement sont **secrets** (quiconque les possède peut lire ton agenda). Ils sont enregistrés uniquement dans `app/data/calendars.local.json`, ignoré par git, et ne sont jamais renvoyés au navigateur.

## Actus (flux RSS)

- **Page Actus** : un widget par source (ou par catégorie : bouton « Sources » → « Un widget par »). 5 derniers articles par widget ; clic sur le nom du widget → liste complète ; clic sur un article → il s'ouvre sur son site, dans un nouvel onglet.
- **Organiser** : glisse les widgets pour les réordonner (ou ↑ ↓), l'œil les masque. Tout est enregistré dans `NEWS.md`.
- **Sources** : ajouter (lien RSS, nom, catégorie, couleur), renommer, changer de couleur ou de catégorie, désactiver, retirer. Le lien est vérifié avant d'être ajouté.
- **Lien privé** : si un lien contient une clé personnelle (par exemple un flux myFT), coche « Lien privé » : il reste sur ton ordinateur (`app/data/news.local.json`) et ne va jamais sur GitHub.
- Mise à jour automatique toutes les 5 minutes ; « Rafraîchir » retente les sources en erreur. Repère « Nouveau » sur les articles publiés depuis ta dernière visite.
- Sur l'accueil, « À la une » montre les 5 derniers titres.

## Notions (répétition espacée)

- **Ajouter** depuis n'importe quelle page : bouton **+** en haut, ou touche **N** (sauf pendant que tu écris dans un champ). Seul le terme est obligatoire ; Entrée enregistre. Sans définition, la notion est « à compléter » et n'est pas proposée en révision.
- **Réviser** : sur l'accueil, « À retenir aujourd'hui » montre jusqu'à 3 notions (réglage `notionsPerDay`). Touche la carte pour voir la définition, puis « Je savais » ou « À revoir ». Rien n'est obligatoire : une notion ignorée reste à revoir.
- **Intervalles** : 1, 2, 5, 14, 30 puis 90 jours ; « À revoir » la remet au lendemain. Ta progression reste sur ton ordinateur (`app/data/notions-progress.local.json`).
- **Page Notions** : « Tout consulter » (glossaire, recherche, tri A→Z / par tag / par date, index A–Z, bouton Imprimer) et « Gérer » (modifier, supprimer, remettre à zéro, importer plusieurs notions au format `terme : définition`).

## Revue de la semaine

- **Quand ?** Le jour choisi (`reviewDay` dans `dashboard.config.ts` : 0 = dimanche, 1 = lundi… 6 = samedi), une ligne discrète « Revue de la semaine — 5 min » apparaît en haut de l'accueil, jusqu'à ce que la revue soit faite. Tu peux aussi la lancer à tout moment : page Projets → « Faire la revue », ou la palette (⌘K).
- **4 étapes**, toutes facultatives :
  1. **Fait cette semaine** : pré-rempli avec les actions cochées et les entrées de journal de la semaine ; modifie, retire, ajoute ;
  2. **Bloqué** : texte libre ;
  3. **Inbox** : chaque élément, un par un → action d'un projet, notion, mémo, supprimer ou garder ;
  4. **Focus** : jusqu'à 3 éléments (prochaines actions des projets actifs ou texte libre).
- **Terminer** crée `reviews/2026-W46.md` (par exemple) et met à jour le « Focus de la semaine ». Si la revue de la semaine existe déjà, l'app propose de la **modifier** au lieu de l'écraser.
- Si tu recharges la page en cours de route, tu reprends où tu en étais.

## Favoris

- Clique sur l'**étoile** d'un article (Actus, À la une), d'une newsletter, d'une notion, d'un mémo ou d'un projet : elle se remplit aussitôt. Un second clic la retire.
- La page **Favoris** (menu, ou « Plus » sur téléphone) liste tout, du plus récent au plus ancien, avec un filtre par type, une recherche et une **note personnelle** courte pour chaque favori.
- Tout est enregistré dans `FAVORIS.md` : seulement le titre, le lien, la source et les dates (jamais le contenu d'un article ou d'un e-mail).
- Si l'élément d'origine n'existe plus (notion ou mémo supprimé), le favori affiche « Élément supprimé » avec un bouton pour le retirer.

## Modifier un projet ou un domaine

- Sur la page d'un projet : change le **statut**, la **priorité**, la **prochaine action** et la **deadline** dans la colonne de droite ; clique sur le titre pour le renommer.
- **Prochaines actions** : ajoute-les en bas, réordonne-les avec ↑ ↓, modifie-les avec le crayon. **Coche une action** : elle disparaît de la liste et s'inscrit dans le **Journal** (« 2026-11-13 — Fait : … »).
- **Objectif, Notes, Liens** : crayon → éditeur avec onglets « Écrire » et « Aperçu ».
- **Journal** : choisis la date et ajoute une entrée ; elle se place en haut.
- **Terminé / Abandonné** : une confirmation s'affiche, puis le dossier est déplacé dans `archive/`. Il n'y a pas de bouton de suppression : on archive.
- Chaque modification met à jour la date `updated` et le fichier `DASHBOARD.md`, et apparaît dans le compteur du bouton **Sauvegarder**.

## Sauvegarder (envoyer ton contenu sur GitHub)

Le bouton **Sauvegarder** (en haut) affiche le nombre de fichiers de contenu modifiés, ou **À jour**. Un clic :

1. prépare **uniquement** le contenu (`*.md` à la racine, `projects/`, `areas/`, `reviews/`, `archive/`) — jamais le code, `app/data/`, `.env*` ni un fichier ignoré ;
2. vérifie qu'aucun secret ne s'y trouve (lien de calendrier, clé, mot de passe…) ; sinon il s'arrête sans rien enregistrer et dit quel fichier corriger ;
3. crée un commit avec un message en français (ex. « Contenu : MEMO.md, 2 mémos ajoutés ; projet site-perso modifié ») ;
4. récupère les modifications de GitHub puis envoie les tiennes. Jamais d'envoi forcé.

- **Pas sur la branche `main`** : un petit panneau demande confirmation avant d'enregistrer.
- **Conflit** (le même passage modifié ici et sur GitHub) : tout est annulé proprement, tes fichiers ne bougent pas, et un message explique quoi faire (GitHub Desktop → « Fetch origin » puis « Pull »).
- **Envoi impossible** (pas d'internet, pas d'accès GitHub) : la sauvegarde reste sur ton ordinateur ; le bouton affiche « ↑ » et un nouveau clic la renverra.
- **Rappel discret** : un point orange apparaît sur le bouton si des modifications attendent depuis plus de 3 jours (réglage `saveReminderDays`).

### Envoyer sur GitHub sans mot de passe

**Vérifier** (dans le Terminal, depuis le dossier `dashboard`) :

```bash
GIT_TERMINAL_PROMPT=0 git push --dry-run
```

- « Everything up-to-date » ou une ligne « To https://github.com/… » → **c'est bon**, le bouton pourra envoyer tout seul.
- « could not read Username », « Authentication failed » ou « Permission denied » → il faut connecter ton Mac à GitHub, une seule fois :

**Le plus simple :**

1. Installe **GitHub Desktop** (https://desktop.github.com), ouvre-le et connecte-toi à ton compte GitHub (*GitHub Desktop → Settings → Accounts → Sign in*). Il configure aussi ton nom et ton e-mail pour git.
2. *File → Add Local Repository…* → choisis le dossier `dashboard`.
3. Pour que **le bouton du dashboard** puisse aussi envoyer tout seul, installe l'outil officiel **GitHub CLI** : télécharge le fichier `.pkg` pour macOS sur https://cli.github.com, installe-le, puis tape dans le Terminal :

   ```bash
   gh auth login --hostname github.com --git-protocol https --web
   ```

   Réponds **Yes** à « Authenticate Git with your GitHub credentials? », valide le code dans le navigateur. Relance ensuite la commande de vérification ci-dessus.

Sans l'étape 3, tout fonctionne quand même : le bouton enregistre la sauvegarde sur ton ordinateur, et tu l'envoies en cliquant sur **Push origin** dans GitHub Desktop.

## Newsletters Outlook

La page **Newsletters** lit **uniquement** le dossier « Newsletters » de ta boîte Outlook (nom modifiable dans `dashboard.config.ts`, réglage `newslettersFolder`). Accès **en lecture seule** (permission `Mail.Read`). Rien n'est enregistré dans le dépôt : les messages sont lus à la demande et gardés quelques minutes en mémoire. Ta connexion (jetons) est stockée uniquement sur ton ordinateur, dans `app/data/msal-cache.local.json` (jamais envoyé sur GitHub). Pour l'effacer : bouton « Se déconnecter ».

Il faut **une seule fois** : (1) créer le dossier et une règle dans Outlook, (2) déclarer l'application chez Microsoft, (3) coller un identifiant dans `app/.env.local`.

### Étape 1 — Ranger les newsletters dans un dossier « Newsletters »

1. Ouvre **https://outlook.live.com** (compte personnel) ou **https://outlook.office.com** (compte pro/école) et connecte-toi.
2. Dans la colonne de gauche, fais un clic droit sur **Dossiers** (ou sur « Boîte de réception ») → **Créer un dossier** → nomme-le exactement **Newsletters** → Entrée.
3. Clique sur la **roue dentée** (Paramètres, en haut à droite) → **Courrier** → **Règles** → **+ Ajouter une nouvelle règle**.
4. Nom : `Newsletters`.
5. Condition : choisis **« L'en-tête du message inclut »** et tape `List-Unsubscribe` (presque toutes les newsletters contiennent cet en-tête). Si cette condition n'existe pas chez toi, choisis **« De »** et ajoute les adresses des newsletters une par une.
6. Action : **Déplacer vers** → **Newsletters**.
7. Coche **« Exécuter la règle maintenant »** si l'option est proposée, puis **Enregistrer**.

### Étape 2 — Déclarer l'application chez Microsoft (≈ 10 minutes)

Microsoft exige que toute application qui lit des e-mails soit « inscrite ». C'est gratuit, et cette inscription ne donne accès qu'à ce que **tu** autorises, uniquement quand **tu** te connectes.

1. Ouvre **https://entra.microsoft.com** et connecte-toi avec ton compte Microsoft.
   - Compte **personnel** (outlook.com, hotmail, live) : si le site indique que ton compte n'a pas d'annuaire (« directory ») ou te refuse l'accès, va sur **https://portal.azure.com**, accepte la création d'un compte Azure gratuit (un « Default Directory » est créé ; inscrire une application ne coûte rien, mais Microsoft peut demander une carte pour vérifier ton identité), puis reviens à l'étape 1 de cette liste.
   - Compte **professionnel ou scolaire** : lis d'abord la section « Compte professionnel ou scolaire » ci-dessous.
2. Menu de gauche : **Applications** → **Inscriptions d'applications** → **+ Nouvelle inscription**.
3. **Nom** : `Dashboard personnel` (au choix).
4. **Types de comptes pris en charge** : choisis **« Comptes dans un annuaire organisationnel (tout annuaire Microsoft Entra ID – multilocataire) et comptes Microsoft personnels »**.
5. **URI de redirection** : dans la liste, choisis **« Client public/natif (mobile et bureau) »** et colle exactement :
   `http://localhost:3000/api/outlook/callback`
6. Clique sur **Inscrire**.
7. Sur la page qui s'affiche, copie **« ID d'application (client) »** (une suite comme `1a2b3c4d-…`). Garde-la pour l'étape 3.
8. Menu de gauche de l'application : **Authentification** → en bas, **« Autoriser les flux clients publics »** → **Oui** → **Enregistrer**.
9. Menu **Autorisations de l'API** :
   - s'il y a une ligne `User.Read`, clique sur **…** → **Supprimer l'autorisation** (inutile ici) ;
   - **+ Ajouter une autorisation** → **Microsoft Graph** → **Autorisations déléguées** → cherche `Mail.Read` → coche **Mail.Read** → **Ajouter des autorisations**.
   - Il doit rester **uniquement `Mail.Read`**. Surtout pas `Mail.ReadWrite` ni `Mail.Send`.

Aucun « secret client » n'est nécessaire : ne crée pas de secret.

### Étape 3 — Coller l'identifiant dans le dashboard

1. Dans le dossier `app/`, duplique le fichier `.env.example` et renomme la copie **`.env.local`** (sur Mac, les fichiers commençant par un point sont cachés : dans le Finder, `Cmd + Maj + .` les affiche).
2. Ouvre `.env.local` avec TextEdit et remplace la ligne `# MS_CLIENT_ID=` par :
   `MS_CLIENT_ID=ton-identifiant-copié` (sans `#` ni espace).
3. Optionnel : `MS_TENANT=consumers` si tu n'utilises qu'un compte personnel, `MS_TENANT=organizations` pour un compte pro/école uniquement. Par défaut (`common`), les deux fonctionnent.
4. Enregistre, puis **relance le dashboard** (ferme la fenêtre Terminal et double-clique de nouveau sur le lanceur).
5. Va sur **Newsletters** → **Se connecter à Outlook** → choisis ton compte → Microsoft affiche la permission demandée (« Lire vos courriers ») → **Accepter**. Tu reviens sur la liste.

### Compte professionnel ou scolaire

Beaucoup d'entreprises et d'universités **bloquent l'accord donné par un utilisateur à une application tierce** : seul un administrateur peut alors l'autoriser. C'est fréquent ; ce n'est pas un problème de ton côté.

Comment le vérifier, sans risque :

- **Essai direct** : fais les étapes 2 et 3, puis « Se connecter à Outlook ». Si Microsoft affiche **« Approbation nécessaire »**, **« Besoin de l'approbation de l'administrateur »** ou un code **AADSTS65001 / AADSTS90094**, le consentement est bloqué. Le dashboard l'indique aussi en français.
- **Autre indice** : sur https://entra.microsoft.com, si tu ne peux pas créer d'inscription d'application (« Vous n'avez pas accès » ou bouton grisé), ton organisation restreint aussi les inscriptions. Dans ce cas, inscris l'application avec un compte personnel (étape 2), en « multilocataire », puis tente la connexion avec ton compte pro.
- **Si c'est bloqué** : demande au service informatique d'approuver l'application « Dashboard personnel » pour la seule permission `Mail.Read` déléguée, ou utilise un compte personnel. N'essaie pas de contourner la règle : elle relève de la politique de sécurité de ton organisation.

### En cas de souci

| Message | Que faire |
|---|---|
| « Outlook n'est pas encore configuré » | `MS_CLIENT_ID` absent ou mal copié dans `app/.env.local` ; relance le dashboard après modification. |
| « L'URI de redirection ne correspond pas » | À l'étape 2.5, l'adresse doit être exactement `http://localhost:3000/api/outlook/callback`, plateforme « Client public/natif ». |
| « Active Autoriser les flux clients publics » | Étape 2.8. |
| « Ce type de compte n'est pas accepté » | Étape 2.4 (multilocataire + comptes personnels) et `MS_TENANT`. |
| « Aucun dossier Newsletters trouvé » | Étape 1 : le dossier doit s'appeler exactement comme `newslettersFolder` dans `dashboard.config.ts`. |

## Fichiers secrets (jamais versionnés)

| Fichier | Contenu |
|---|---|
| `app/.env.local` | identifiant de l'application Microsoft — modèle : `app/.env.example` |
| `app/data/msal-cache.local.json` | ta connexion Outlook (jetons), créée à la connexion, supprimée par « Se déconnecter » |
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
- `npm run typecheck` : vérification des types. `npm test` : tests automatiques. `npm run build` : compilation de production.
- Lire le contenu depuis un autre dossier (tests) : `CONTENT_DIR=/chemin npm run dev`.
