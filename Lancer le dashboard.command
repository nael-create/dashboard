#!/bin/bash
# ---------------------------------------------------------------
#  Lancer le dashboard (macOS) : double-cliquer sur ce fichier.
#  Vérifie Node.js, installe les dépendances si besoin, démarre
#  l'application et ouvre http://127.0.0.1:3000 dans le navigateur.
#  Pour arrêter : fermer cette fenêtre (ou Ctrl + C).
# ---------------------------------------------------------------

URL="http://127.0.0.1:3000"
NODE_MIN=22

pause_and_exit() {
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

cd "$(dirname "$0")/app" 2>/dev/null || fail "Dossier « app » introuvable à côté de ce fichier."

# Un double-clic ne charge pas toujours la configuration du terminal :
# on ajoute les emplacements habituels de Node.js (Homebrew, nvm, Volta, fnm).
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.volta/bin:$HOME/.fnm/aliases/default/bin:$PATH"
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
fi

echo "🚀 Lancement du dashboard…"
echo

# 1. Node.js 22 ou plus récent ?
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js n'est pas installé sur cet ordinateur."
  echo
  echo "   Télécharge la version « LTS » (22 ou plus récente) ici :"
  echo "   https://nodejs.org/fr/download"
  echo
  echo "   Installe-la, puis double-clique à nouveau sur « Lancer le dashboard »."
  open "https://nodejs.org/fr/download" 2>/dev/null
  pause_and_exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null)"
if [ -z "$NODE_MAJOR" ] || [ "$NODE_MAJOR" -lt "$NODE_MIN" ]; then
  echo "❌ Ta version de Node.js ($(node -v 2>/dev/null)) est trop ancienne : il faut la version $NODE_MIN ou plus récente."
  echo
  echo "   Télécharge la version « LTS » ici : https://nodejs.org/fr/download"
  open "https://nodejs.org/fr/download" 2>/dev/null
  pause_and_exit 1
fi
echo "✓ Node.js $(node -v)"

# 2. Déjà lancé ? On ouvre simplement le navigateur.
if curl -s -o /dev/null --max-time 3 "$URL/"; then
  echo "✓ Le dashboard tourne déjà : ouverture du navigateur."
  open "$URL"
  sleep 2
  exit 0
fi

# Le port 3000 est-il pris par un autre programme ?
if lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  fail "Le port 3000 est déjà utilisé par un autre programme. Ferme-le, puis relance."
fi

# 3. Dépendances : installation seulement si elles manquent ou ont changé.
if [ ! -d node_modules ] || [ ! -f node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  echo "📦 Installation des dépendances (première fois ou mise à jour, 1 à 2 minutes)…"
  npm ci --no-audit --no-fund || fail "L'installation des dépendances a échoué (voir le message ci-dessus). Vérifie ta connexion internet."
fi
echo "✓ Dépendances à jour"

# 4. Démarrage de l'application.
echo "⏳ Démarrage…"
./node_modules/.bin/next dev --hostname 127.0.0.1 --port 3000 &
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

# 5. Ouverture du navigateur.
open "$URL"
echo
echo "✅ Dashboard prêt : $URL"
echo "   Laisse cette fenêtre ouverte tant que tu utilises le dashboard."
echo "   Pour l'arrêter : ferme cette fenêtre (ou appuie sur Ctrl + C)."
echo

wait "$SERVER_PID"
