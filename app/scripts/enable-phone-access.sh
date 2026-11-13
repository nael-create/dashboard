#!/bin/bash
# ---------------------------------------------------------------
#  Accès au dashboard depuis ton téléphone, via Tailscale (réseau privé).
#
#  Utilisation, dans le Terminal, depuis le dossier « dashboard » :
#     bash app/scripts/enable-phone-access.sh        → activer
#     bash app/scripts/enable-phone-access.sh --off  → désactiver
#
#  Ce que fait ce script (et rien d'autre) :
#   1. vérifie que l'app Tailscale est installée et connectée ;
#   2. crée un mot de passe dans app/.env.local s'il n'y en a pas
#      (fichier ignoré par git, jamais envoyé sur GitHub) ;
#   3. demande à Tailscale de relayer https://<ton-mac>.<réseau>.ts.net
#      vers le dashboard (http://127.0.0.1:3000). Seuls TES appareils
#      connectés à Tailscale y ont accès : rien n'est publié sur internet.
#      (Jamais « tailscale funnel », qui rendrait l'adresse publique.)
# ---------------------------------------------------------------
set -u

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$ROOT/app/.env.local"
TARGET="http://127.0.0.1:3000"

say() { printf '%s\n' "$*"; }
fail() { say; say "✗ $*"; exit 1; }

# 1. Tailscale --------------------------------------------------------------
if command -v tailscale >/dev/null 2>&1; then
  TS="$(command -v tailscale)"
elif [ -x "/Applications/Tailscale.app/Contents/MacOS/Tailscale" ]; then
  TS="/Applications/Tailscale.app/Contents/MacOS/Tailscale"
else
  fail "Tailscale n'est pas installé. Installe l'app « Tailscale » (App Store ou tailscale.com/download), connecte-toi, puis relance ce script."
fi

if [ "${1:-}" = "--off" ]; then
  "$TS" serve --https=443 off >/dev/null 2>&1
  say "✓ Accès depuis le téléphone désactivé (le dashboard reste disponible sur ce Mac)."
  exit 0
fi

STATUS_JSON="$("$TS" status --json 2>/dev/null)" || STATUS_JSON=""
read -r STATE DNS < <(printf '%s' "$STATUS_JSON" | node -e '
  let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
    try { const j = JSON.parse(s); console.log((j.BackendState || "?") + " " + ((j.Self && j.Self.DNSName) || "").replace(/\.$/, "")); }
    catch { console.log("? "); }
  });')
if [ "$STATE" != "Running" ] || [ -z "${DNS:-}" ]; then
  fail "Tailscale n'est pas connecté. Ouvre l'app Tailscale (icône dans la barre des menus), connecte-toi, puis relance ce script."
fi

# 2. Mot de passe -------------------------------------------------------------
CURRENT="$(grep -E '^DASHBOARD_BASIC_AUTH=' "$ENV_FILE" 2>/dev/null | tail -n 1 | cut -d= -f2-)"
PASS_PART="${CURRENT#*:}"
NEW_PASSWORD=""
if [ -z "$CURRENT" ] || [ "$PASS_PART" = "$CURRENT" ] || [ "${#PASS_PART}" -lt 12 ]; then
  NEW_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=\n' | cut -c1-24)"
  [ "${#NEW_PASSWORD}" -ge 20 ] || fail "Impossible de générer un mot de passe (openssl)."
  touch "$ENV_FILE" && chmod 600 "$ENV_FILE"
  # Retire une éventuelle ligne invalide, puis ajoute la nouvelle.
  if grep -qE '^DASHBOARD_BASIC_AUTH=' "$ENV_FILE"; then
    grep -vE '^DASHBOARD_BASIC_AUTH=' "$ENV_FILE" > "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE" && chmod 600 "$ENV_FILE"
  fi
  [ -s "$ENV_FILE" ] && [ -n "$(tail -c 1 "$ENV_FILE")" ] && printf '\n' >> "$ENV_FILE"
  printf 'DASHBOARD_BASIC_AUTH=dashboard:%s\n' "$NEW_PASSWORD" >> "$ENV_FILE"
fi

# 3. Relais Tailscale (privé) ---------------------------------------------------
say "Activation du relais Tailscale… (si un lien s'affiche, ouvre-le pour autoriser HTTPS, puis reviens ici)"
"$TS" serve --bg "$TARGET" || fail "Tailscale n'a pas pu activer le relais. Copie le message ci-dessus et envoie-le à Claude."

say
say "✓ C'est prêt."
say
say "  Adresse à ouvrir sur ton téléphone (app Tailscale connectée) :"
say "      https://$DNS"
say
if [ -n "$NEW_PASSWORD" ]; then
  say "  Identifiant :  dashboard"
  say "  Mot de passe : $NEW_PASSWORD"
  say "  (enregistré dans app/.env.local ; Safari te proposera de le mémoriser)"
  say
  say "  ⚠ Ferme puis relance le dashboard pour que le mot de passe soit pris en compte."
else
  say "  Identifiant et mot de passe : ceux déjà enregistrés dans app/.env.local (ligne DASHBOARD_BASIC_AUTH)."
fi
say
say "  Sur ce Mac, http://localhost:3000 marche toujours sans mot de passe."
