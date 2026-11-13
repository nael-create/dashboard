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

À la racine du dépôt se trouve le fichier **`Lancer le dashboard.command`**. Double-clique dessus : tu n'as plus jamais besoin du Terminal pour les mises à jour. À chaque lancement, il :

1. **revient sur la branche `main`** si tu étais ailleurs. S'il reste des modifications non sauvegardées, il reste sur ta branche et te demande d'abord de cliquer sur « Sauvegarder » ;
2. **récupère la dernière version** depuis GitHub, en avance rapide uniquement : jamais forcé, tes modifications ne sont jamais effacées. Si ce n'est pas possible sans risque (pas d'internet, versions différentes), il démarre sur ta version actuelle et explique pourquoi ;
3. **installe les dépendances seulement si elles ont changé** (`package-lock.json`) ;
4. **vérifie que l'envoi vers GitHub marche sans mot de passe**. Sinon, une petite clé orange apparaît à côté de « Sauvegarder » : clique dessus pour voir la solution (à faire une fois) ;
5. vérifie Node.js 22 (sinon il affiche la page de téléchargement), démarre le dashboard et ouvre **http://127.0.0.1:3000**.

Laisse la fenêtre Terminal ouverte pendant que tu utilises le dashboard. **Pour l'arrêter**, ferme cette fenêtre.
Si le dashboard tourne déjà, un nouveau double-clic ouvre simplement le navigateur.

## Démarrage automatique, sans Terminal (recommandé)

Une seule commande, une seule fois, et le dashboard tourne ensuite **tout seul en arrière-plan** :
il démarre à chaque ouverture de session, se met à jour à chaque démarrage (mêmes étapes 1 à 5
que ci-dessus), et macOS le relance s'il s'arrête. Plus aucune fenêtre Terminal à garder ouverte.

1. Ferme la fenêtre Terminal du dashboard s'il tourne.
2. Ouvre le Terminal et colle cette ligne, puis Entrée :
   ```bash
   cd ~/dashboard && git pull --ff-only && bash app/scripts/install-service.sh
   ```
3. Le navigateur s'ouvre sur le dashboard quand il est prêt. macOS peut afficher la notification
   « Éléments d'arrière-plan ajoutés » : c'est normal (c'est le dashboard).

Ensuite, il suffit d'ouvrir **http://localhost:3000**. Pour en faire une icône : dans Safari,
menu **Fichier → Ajouter au Dock**.

- **Mettre à jour sans rien taper** : quand une nouvelle version existe sur GitHub, un bouton
  **Mettre à jour** apparaît en haut à droite (vérification toutes les 30 minutes). Un clic : le dashboard
  se relance (≈ 30 secondes), récupère la nouvelle version et la page se recharge toute seule. Aussi
  disponible dans la palette (`⌘K` → « Mettre à jour le dashboard »). Ton contenu n'est jamais touché.
- Les mises à jour s'appliquent aussi à chaque démarrage du service (redémarrage du Mac ou nouvelle session).
- Journal (en cas de souci) : `~/Library/Logs/dashboard.log`.
- Désinstaller : `bash ~/dashboard/app/scripts/install-service.sh --off`.
- Ne déplace pas le dossier `dashboard` ensuite (sinon, relance l'installation).

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
Pour l'ouvrir depuis ton téléphone, voir « Accès depuis ton téléphone (Tailscale) » ci-dessous.

## Accès depuis ton téléphone (Tailscale)

[Tailscale](https://tailscale.com) (gratuit) relie tes appareils entre eux par un réseau **privé**.
Le dashboard reste sur ton Mac ; ton téléphone y accède à travers ce réseau, avec un mot de passe.
Rien n'est publié sur internet : seuls les appareils connectés à **ton** compte Tailscale voient l'adresse.

### Mise en place (une seule fois, ≈ 15 minutes)

1. **Sur le Mac** : installe l'app **Tailscale** (App Store, ou tailscale.com/download), ouvre-la et
   connecte-toi (compte Google, Apple ou Microsoft). Une icône apparaît dans la barre des menus.
2. **Sur l'iPhone** : installe l'app **Tailscale** (App Store) et connecte-toi **avec le même compte**.
3. **Sur le Mac**, dans le Terminal :
   ```bash
   cd dashboard
   ```
   ```bash
   bash app/scripts/enable-phone-access.sh
   ```
   Le script crée un mot de passe (dans `app/.env.local`, jamais envoyé sur GitHub), active le relais
   privé de Tailscale et affiche **l'adresse**, l'**identifiant** et le **mot de passe**.
   S'il affiche un lien « …login.tailscale.com… », ouvre-le et clique sur **Enable HTTPS**, puis reviens.
4. **Ferme puis relance le dashboard** (pour que le mot de passe soit pris en compte).
5. **Sur l'iPhone** : Tailscale connecté, ouvre l'adresse affichée (`https://<ton-mac>.<…>.ts.net`)
   dans Safari, saisis identifiant et mot de passe (Safari propose de les mémoriser).
   Astuce : Partager → « Sur l'écran d'accueil » pour en faire une icône.

Sur le Mac, `http://localhost:3000` marche toujours sans mot de passe.

### Bon à savoir

- **Le Mac doit être allumé, pas en veille, et le dashboard lancé.** Pour éviter la veille quand il est
  branché : Réglages Système → Batterie → Options → « Empêcher la suspension d'activité automatique sur
  secteur lorsque l'écran est éteint » (sur un Mac de bureau : Réglages Système → Énergie). Un portable
  dont l'écran est rabattu se met en veille quand même.
- Pour que le dashboard tourne tout seul, sans Terminal : voir « Démarrage automatique, sans Terminal ».
- **Outlook** : la connexion (« Se connecter ») se fait depuis le Mac. Une fois connecté, les newsletters
  se lisent aussi depuis le téléphone.
- **Changer le mot de passe** : supprime la ligne `DASHBOARD_BASIC_AUTH=…` de `app/.env.local`, relance le
  script, puis relance le dashboard.
- **Désactiver** : `bash app/scripts/enable-phone-access.sh --off`.
- Ne jamais utiliser `tailscale funnel` : cela rendrait l'adresse publique sur internet.

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
| `/` | Accueil : 01. agenda, 02. à la une (grille d'images), puis projets actifs, à retenir aujourd'hui, mémo, newsletters | ✅ |
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

### Tes propres événements (calendrier « Perso »)

Les calendriers abonnés (Outlook, Google, iCloud) restent en lecture seule. Pour noter tes propres rendez-vous, le dashboard a un calendrier intégré **« Perso »**, enregistré dans `AGENDA.md` (lisible et modifiable à la main, sauvegardé avec le bouton « Sauvegarder »).

- **Ajouter** : clique sur une heure libre (vues Jour et Semaine), sur un jour (vue Mois), sur « + Ajouter » d'un jour (semaine sur téléphone) ou sur **+ Événement** en bas du calendrier. Indique le titre (obligatoire), la date, les heures ou « Toute la journée », et si tu veux un lieu, une note, « Chaque semaine ». **Entrée** enregistre.
- **Modifier / supprimer** : clique sur l'événement. La suppression demande une confirmation. Un événement répété est modifié ou supprimé pour toutes les semaines.
- **Événement d'un calendrier abonné** : un clic affiche ses détails seulement (il se modifie dans Outlook, Google ou iCloud).
- **Nom et couleur** de « Perso » : « Gérer les calendriers ».
- Chaque événement enregistre son fuseau horaire (celui de ton ordinateur au moment de la création) : en voyage, il s'affiche à la bonne heure locale.

**Plus tard : écrire directement dans Outlook ou Google ?** Ce n'est pas fait ici (les abonnements ICS sont en lecture seule par nature). Il faudrait passer par l'API de chaque service avec une autorisation d'écriture : Microsoft Graph avec la permission `Calendars.ReadWrite` (même principe de connexion que les newsletters, mais avec une permission plus large), ou l'API Google Calendar avec une connexion Google (OAuth) et la portée `calendar.events`. Le dashboard enverrait alors l'événement au service au lieu de l'écrire dans `AGENDA.md`.

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

## Palette de commandes et raccourcis

- **⌘ K** (Mac) ou **Ctrl K**, ou la **loupe** en haut : ouvre la palette. **Échap** la ferme.
- Tape quelques lettres : projets, domaines, mémos, notions, inbox, favoris, newsletters (objet et expéditeur) et titres d'actus s'affichent, groupés par type. **↑ ↓** pour choisir, **Entrée** pour ouvrir.
- **Capture express** : tape une idée qui ne correspond à rien puis **Entrée** → elle est ajoutée à `INBOX.md` avec la date du jour.
- Actions disponibles : Nouvelle notion, Nouveau mémo, Nouveau projet (avec le texte tapé), Aller à… (chaque page), Sauvegarder, Changer de thème, Faire la revue.
- **⌘ K** marche partout, même pendant que tu écris. Autres raccourcis : **N** (nouvelle notion), **?** (aide) ; ceux-là ne se déclenchent jamais pendant que tu écris dans un champ.

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

> **Adresse dédiée aux newsletters ?** Saute cette étape : le dashboard lit directement ta **Boîte de
> réception** (`newslettersFolder: "inbox"` dans `dashboard.config.ts`, réglage actuel). Cette étape
> ne sert que si tu veux lire un dossier précis (mets alors son nom exact, ex. `"Newsletters"`).

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
| `app/.env.local` | identifiant de l'application Microsoft, mot de passe de l'accès depuis le téléphone — modèle : `app/.env.example` |
| `app/data/msal-cache.local.json` | ta connexion Outlook (jetons), créée à la connexion, supprimée par « Se déconnecter » |
| `app/data/calendars.local.json` | liens d'abonnement aux calendriers (phase 3) |

Ces fichiers sont listés dans le `.gitignore` à la racine du dépôt.

## Sécurité et déploiement

Rien n'est déployé : l'app tourne sur ton Mac et n'écoute que sur `127.0.0.1`. Toute requête qui ne vient
pas du navigateur du Mac (téléphone via Tailscale, ou tout autre accès) exige un mot de passe :
`DASHBOARD_BASIC_AUTH=identifiant:mot-de-passe` dans `app/.env.local`, 12 caractères minimum pour le mot de
passe (voir `src/proxy.ts` et `src/lib/remote-access.ts`). Sans mot de passe valide, l'accès distant est
refusé (erreur 403).

## Pour les développeurs

- Next.js (App Router) + TypeScript + Tailwind CSS. Versions figées exactement (pas de `^`).
- Ajouter une dépendance : version publiée depuis **au moins 14 jours**, par exemple
  `npm install --before=AAAA-MM-JJ paquet@version` (la date = aujourd'hui moins 14 jours).
- `npm run typecheck` : vérification des types. `npm test` : tests automatiques. `npm run build` : compilation de production.
- Lire le contenu depuis un autre dossier (tests) : `CONTENT_DIR=/chemin npm run dev`.
