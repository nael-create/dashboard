#!/bin/bash
# ---------------------------------------------------------------
#  Lancer le dashboard (macOS) : double-cliquer sur ce fichier.
#
#  À chaque lancement, avant de démarrer l'application :
#   1. repasse sur la branche « main » (sauf s'il reste du contenu
#      non sauvegardé : il faut alors cliquer sur « Sauvegarder ») ;
#   2. récupère la dernière version de « main » (avance rapide
#      uniquement : jamais forcé, tes modifications ne sont jamais
#      effacées) ;
#   3. installe les dépendances seulement si elles ont changé ;
#   4. vérifie que l'envoi vers GitHub fonctionne sans mot de passe
#      (le résultat s'affiche dans le panneau « Sauvegarder ») ;
#  puis démarre le dashboard et ouvre http://127.0.0.1:3000.
#  Pour arrêter : fermer cette fenêtre (ou Ctrl + C).
#
#  Mode « service » (DASHBOARD_SERVICE=1, voir app/scripts/install-service.sh) :
#  le même script est lancé en arrière-plan par macOS à l'ouverture de session,
#  sans fenêtre, sans question et sans ouvrir le navigateur. Si le dashboard
#  tourne déjà ainsi, un double-clic ici ouvre simplement le navigateur.
# ---------------------------------------------------------------

URL="http://127.0.0.1:3000"
NODE_MIN=22
ROOT="$(cd "$(dirname "$0")" && pwd)"
SERVICE="${DASHBOARD_SERVICE:-}"

# Ouvre une adresse dans le navigateur (jamais en mode service).
open_url() { [ -n "$SERVICE" ] || open "$1" 2>/dev/null; }

pause_and_exit() {
  [ -n "$SERVICE" ] && exit "${1:-1}"
  echo
  read -n 1 -s -r -p "Appuie sur une touche pour fermer cette fenêtre…"
  echo
  exit "${1:-1}"
}

fail() {
  echo
  echo "❌ $1"
  pause_and_exit 1
}

note() {
  echo
  echo "ℹ️  $1"
  echo
}

[ -d "$ROOT/app" ] || fail "Dossier « app » introuvable à côté de ce fichier."

# Un double-clic ne charge pas toujours la configuration du terminal :
# on ajoute les emplacements habituels de Node.js (Homebrew, nvm, Volta, fnm).
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.volta/bin:$HOME/.fnm/aliases/default/bin:$PATH"
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
fi

if [ -n "$SERVICE" ]; then
  # Journal du service : repart de zéro au-delà de 5 Mo.
  LOG="$HOME/Library/Logs/dashboard.log"
  [ -f "$LOG" ] && [ "$(wc -c < "$LOG")" -gt 5000000 ] && : > "$LOG"
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') — démarrage du service ==="
fi

echo "🚀 Lancement du dashboard…"
echo

# ---------------------------------------------------------------
# Mise à jour automatique (git), sans jamais forcer ni effacer
# ---------------------------------------------------------------
# Aucune question interactive : ni mot de passe, ni confirmation SSH.
export GIT_TERMINAL_PROMPT=0
export GIT_SSH_COMMAND="ssh -o BatchMode=yes -o ConnectTimeout=10"
CONTENT_PATHS=(":(glob)*.md" "projects" "areas" "reviews" "archive")
PUSH_CHECK="$ROOT/app/data/push-check.local.json"

# Écrit le résultat du test d'envoi pour l'application (fichier local, ignoré par git).
write_push_check() { # $1 = ok|auth|network|other
  mkdir -p "$ROOT/app/data"
  printf '{ "result": "%s", "checkedAt": "%s" }\n' "$1" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$PUSH_CHECK"
}

if command -v git >/dev/null 2>&1 && git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  cd "$ROOT" || fail "Dossier du dashboard inaccessible."
  BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
  CONTENT_CHANGES="$(git status --porcelain -- "${CONTENT_PATHS[@]}" 2>/dev/null)"

  # 1. Revenir sur « main » si possible.
  if [ "$BRANCH" != "main" ]; then
    if [ -n "$CONTENT_CHANGES" ]; then
      note "Tu as des modifications non sauvegardées sur la branche « $BRANCH ». Le dashboard démarre sur cette branche : clique sur « Sauvegarder » dans le dashboard, puis relance-le pour revenir automatiquement sur « main »."
    else
      git fetch --quiet origin main 2>/dev/null
      if git show-ref --verify --quiet refs/heads/main; then
        git checkout --quiet main 2>/dev/null
      else
        git checkout --quiet -b main --track origin/main 2>/dev/null
      fi
      if [ "$(git rev-parse --abbrev-ref HEAD)" = "main" ]; then
        echo "✓ Retour sur la branche « main »"
      else
        note "Impossible de revenir sur « main » (des fichiers modifiés l'en empêchent). Le dashboard démarre sur la branche « $BRANCH »."
      fi
    fi
  fi

  # 2. Récupérer la dernière version de « main » : avance rapide uniquement.
  if [ "$(git rev-parse --abbrev-ref HEAD)" = "main" ]; then
    PULL_OUT="$(git pull --ff-only --quiet origin main 2>&1)"
    if [ $? -eq 0 ]; then
      echo "✓ Version à jour"
    elif echo "$PULL_OUT" | grep -qiE "Could not resolve host|unable to access|timed out|Connection refused|Network is unreachable"; then
      note "Pas de connexion à GitHub : le dashboard démarre sur ta version actuelle (mise à jour au prochain lancement)."
    elif echo "$PULL_OUT" | grep -qiE "Not possible to fast-forward|diverge|non-fast-forward"; then
      note "Ton ordinateur et GitHub ont chacun des changements différents : la mise à jour automatique est impossible sans risque. Le dashboard démarre sur ta version actuelle ; clique sur « Sauvegarder » (il réunit les deux versions proprement), puis relance."
    elif echo "$PULL_OUT" | grep -qiE "would be overwritten|local changes"; then
      note "Des modifications locales non sauvegardées touchent des fichiers mis à jour sur GitHub. Rien n'a été effacé ; le dashboard démarre sur ta version actuelle. Clique sur « Sauvegarder », puis relance."
    elif echo "$PULL_OUT" | grep -qiE "could not read Username|Authentication failed|Permission denied|denied"; then
      note "GitHub demande une connexion pour récupérer les mises à jour. Le dashboard démarre sur ta version actuelle ; la marche à suivre s'affiche dans le panneau « Sauvegarder »."
    else
      note "La mise à jour automatique n'a pas abouti ($(echo "$PULL_OUT" | tail -n 1 | cut -c1-120)). Le dashboard démarre sur ta version actuelle."
    fi
  fi

  # 4. Tester l'envoi vers GitHub (sans rien envoyer, sans demander de mot de passe).
  PUSH_OUT="$(git push --dry-run --quiet origin HEAD 2>&1)"
  # Un refus « rejected / fetch first » vient de l'historique, pas des identifiants : l'accès fonctionne.
  if [ $? -eq 0 ] || echo "$PUSH_OUT" | grep -qiE "rejected|non-fast-forward|fetch first"; then
    write_push_check ok
    echo "✓ Envoi vers GitHub possible sans mot de passe"
  elif echo "$PUSH_OUT" | grep -qiE "could not read Username|Authentication failed|terminal prompts disabled|Permission denied|403|denied"; then
    write_push_check auth
    note "L'envoi vers GitHub demande un mot de passe : le bouton « Sauvegarder » gardera tes sauvegardes sur cet ordinateur. La solution (à faire une fois) est expliquée dans le panneau « Sauvegarder »."
  elif echo "$PUSH_OUT" | grep -qiE "Could not resolve host|unable to access|timed out|Connection refused|Network is unreachable"; then
    write_push_check network
  else
    write_push_check other
  fi
else
  echo "ℹ️  Mise à jour automatique indisponible (dossier non relié à git)."
fi

cd "$ROOT/app" || fail "Dossier « app » introuvable."

# ---------------------------------------------------------------
# Node.js 22 ou plus récent ?
# ---------------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js n'est pas installé sur cet ordinateur."
  echo
  echo "   Télécharge la version « LTS » (22 ou plus récente) ici :"
  echo "   https://nodejs.org/fr/download"
  echo
  echo "   Installe-la, puis double-clique à nouveau sur « Lancer le dashboard »."
  open_url "https://nodejs.org/fr/download"
  pause_and_exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null)"
if [ -z "$NODE_MAJOR" ] || [ "$NODE_MAJOR" -lt "$NODE_MIN" ]; then
  echo "❌ Ta version de Node.js ($(node -v 2>/dev/null)) est trop ancienne : il faut la version $NODE_MIN ou plus récente."
  echo
  echo "   Télécharge la version « LTS » ici : https://nodejs.org/fr/download"
  open_url "https://nodejs.org/fr/download"
  pause_and_exit 1
fi
echo "✓ Node.js $(node -v)"

# Déjà lancé ? On ouvre simplement le navigateur.
if curl -s -o /dev/null --max-time 3 "$URL/"; then
  if [ -n "$SERVICE" ]; then
    # Une fenêtre Terminal le fait déjà tourner : macOS relancera le service plus tard.
    echo "Le dashboard tourne déjà dans une fenêtre Terminal : nouvel essai dans 30 secondes."
    exit 1
  fi
  echo "✓ Le dashboard tourne déjà : ouverture du navigateur."
  open "$URL"
  sleep 2
  exit 0
fi

# Le port 3000 est-il pris par un autre programme ?
if lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  fail "Le port 3000 est déjà utilisé par un autre programme. Ferme-le, puis relance."
fi

# ---------------------------------------------------------------
# 3. Dépendances : installation seulement si package-lock.json a changé.
# ---------------------------------------------------------------
LOCK_HASH="$(shasum -a 256 package-lock.json 2>/dev/null | cut -d' ' -f1)"
STAMP="node_modules/.dashboard-lock-hash"
if [ ! -d node_modules ] || [ ! -f "$STAMP" ] || [ "$(cat "$STAMP" 2>/dev/null)" != "$LOCK_HASH" ]; then
  echo "📦 Installation des dépendances (première fois ou mise à jour, 1 à 2 minutes)…"
  npm ci --no-audit --no-fund || fail "L'installation des dépendances a échoué (voir le message ci-dessus). Vérifie ta connexion internet."
  echo "$LOCK_HASH" > "$STAMP"
fi
echo "✓ Dépendances à jour"

# ---------------------------------------------------------------
# Construction de la version (mode production) : d'un seul bloc, et seulement
# si la version a changé depuis la dernière construction. Pages, scripts et
# styles viennent toujours de la même version (jamais de styles périmés).
# ---------------------------------------------------------------
HEAD_NOW="$(git -C "$ROOT" rev-parse HEAD 2>/dev/null)"
HEAD_STAMP="node_modules/.dashboard-head"
BUILD_LOG="${TMPDIR:-/tmp}/dashboard-build.log"
RUN_MODE="start"
if [ ! -f .next/BUILD_ID ] || [ "$(cat "$HEAD_STAMP" 2>/dev/null)" != "$HEAD_NOW" ]; then
  echo "🔧 Préparation de la nouvelle version (1 à 2 minutes)…"
  rm -rf .next
  if ./node_modules/.bin/next build > "$BUILD_LOG" 2>&1; then
    echo "$HEAD_NOW" > "$HEAD_STAMP"
    echo "✓ Nouvelle version prête"
  else
    tail -n 25 "$BUILD_LOG"
    rm -f "$HEAD_STAMP"
    RUN_MODE="dev"
    note "La préparation de la nouvelle version a échoué (message ci-dessus) : le dashboard démarre quand même, en mode développement (plus lent). Envoie ce message à Claude."
  fi
fi
SERVER=(./node_modules/.bin/next "$RUN_MODE" --hostname 127.0.0.1 --port 3000)

# ---------------------------------------------------------------
# Démarrage de l'application.
# ---------------------------------------------------------------
echo "⏳ Démarrage…"
if [ -n "$SERVICE" ]; then
  # En arrière-plan : macOS surveille ce processus et le relance s'il s'arrête.
  exec "${SERVER[@]}"
fi
"${SERVER[@]}" &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null; wait "$SERVER_PID" 2>/dev/null' EXIT INT TERM HUP

for _ in $(seq 1 120); do
  if curl -s -o /dev/null --max-time 2 "$URL/"; then
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    fail "L'application n'a pas pu démarrer (voir le message ci-dessus)."
  fi
  sleep 0.5
done

open_url "$URL"
echo
echo "✅ Dashboard prêt : $URL"
echo "   Laisse cette fenêtre ouverte tant que tu utilises le dashboard."
echo "   Pour l'arrêter : ferme cette fenêtre (ou appuie sur Ctrl + C)."
echo

wait "$SERVER_PID"
