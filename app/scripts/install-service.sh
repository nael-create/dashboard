#!/bin/bash
# ---------------------------------------------------------------
#  Démarrage automatique du dashboard (macOS), sans Terminal.
#
#     bash app/scripts/install-service.sh          → installer (une seule fois)
#     bash app/scripts/install-service.sh --off    → désinstaller
#
#  Installe un « agent » macOS (~/Library/LaunchAgents/local.dashboard.plist)
#  qui lance « Lancer le dashboard.command » en mode service à chaque
#  ouverture de session : mise à jour depuis GitHub, puis démarrage, sans
#  fenêtre. S'il s'arrête, macOS le relance. Journal : ~/Library/Logs/dashboard.log
#  Le dashboard reste sur http://localhost:3000 (127.0.0.1 uniquement).
# ---------------------------------------------------------------
set -u

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LABEL="local.dashboard"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/dashboard.log"
LAUNCHER="$ROOT/Lancer le dashboard.command"
URL="http://127.0.0.1:3000"
DOMAIN="gui/$(id -u)"

say() { printf '%s\n' "$*"; }
fail() { say; say "✗ $*"; exit 1; }

[ "$(uname)" = "Darwin" ] || fail "Ce script est prévu pour macOS."
[ -f "$LAUNCHER" ] || fail "Lanceur introuvable : $LAUNCHER"

if [ "${1:-}" = "--off" ]; then
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null
  rm -f "$PLIST"
  say "✓ Démarrage automatique désinstallé. Le dashboard est arrêté ;"
  say "  tu peux toujours le lancer avec « Lancer le dashboard.command »."
  exit 0
fi

# Un dashboard lancé dans une fenêtre Terminal occupe déjà le port 3000.
if lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1 && ! launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; then
  fail "Le dashboard tourne déjà dans une fenêtre Terminal. Ferme cette fenêtre (ou Ctrl + C dedans), puis relance cette commande."
fi

# Chemins de Node.js tels que ton Terminal les voit (Homebrew, nvm…), transmis au service.
NODE_BIN="$(command -v node 2>/dev/null)"
[ -n "$NODE_BIN" ] || fail "Node.js est introuvable. Installe la version LTS (nodejs.org/fr/download), puis relance."
SERVICE_PATH="$(dirname "$NODE_BIN"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

xml() { printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'; }

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$(xml "$LAUNCHER")</string>
  </array>
  <key>WorkingDirectory</key><string>$(xml "$ROOT")</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>DASHBOARD_SERVICE</key><string>1</string>
    <key>PATH</key><string>$(xml "$SERVICE_PATH")</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key>
  <dict><key>SuccessfulExit</key><false/></dict>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>ProcessType</key><string>Interactive</string>
  <key>StandardOutPath</key><string>$(xml "$LOG")</string>
  <key>StandardErrorPath</key><string>$(xml "$LOG")</string>
</dict>
</plist>
PLIST
plutil -lint "$PLIST" >/dev/null || fail "Fichier de configuration invalide ($PLIST)."

# (Re)chargement de l'agent.
launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null
sleep 1
launchctl bootstrap "$DOMAIN" "$PLIST" || fail "macOS a refusé de lancer le service. Copie ce message et envoie-le à Claude."

say "⏳ Démarrage du dashboard en arrière-plan (jusqu'à 2 minutes la première fois)…"
for _ in $(seq 1 240); do
  if curl -s -o /dev/null --max-time 2 "$URL/"; then
    open "$URL"
    say
    say "✓ C'est fini. Le dashboard démarre maintenant tout seul à chaque ouverture"
    say "  de session, sans fenêtre Terminal, et se met à jour à chaque démarrage."
    say
    say "  Pour l'ouvrir : http://localhost:3000 (ajoute-le à tes favoris ou au Dock)."
    say "  Tu peux fermer ce Terminal."
    exit 0
  fi
  sleep 0.5
done
say
say "✗ Le dashboard n'a pas répondu à temps. Dernières lignes du journal :"
tail -n 15 "$LOG" 2>/dev/null
exit 1
