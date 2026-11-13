import { NextResponse, type NextRequest } from "next/server";
import { decideAccess } from "@/lib/remote-access";

/**
 * Garde-fou d'accès (voir src/lib/remote-access.ts) :
 * - navigateur du Mac (127.0.0.1 / localhost) : accès libre ;
 * - tout le reste (téléphone via Tailscale Serve…) : mot de passe OBLIGATOIRE
 *   (DASHBOARD_BASIC_AUTH = « identifiant:mot-de-passe », 12 caractères minimum pour le mot de passe).
 *   Sans mot de passe valide, tout accès distant est refusé.
 */
export function proxy(request: NextRequest) {
  const decision = decideAccess(request.headers, process.env.DASHBOARD_BASIC_AUTH);
  if (decision.allow) return NextResponse.next();
  return new NextResponse(page(decision.status, decision.message), {
    status: decision.status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      ...(decision.status === 401 ? { "WWW-Authenticate": 'Basic realm="dashboard", charset="UTF-8"' } : {}),
    },
  });
}

/** Petite page lisible sur téléphone (un texte brut s'affiche minuscule, comme une page blanche). */
function page(status: number, message: string) {
  const hint = status === 403
    ? "Si tu viens d'activer l'accès depuis le téléphone, ferme puis relance le dashboard sur le Mac, puis recharge cette page."
    : "Recharge la page et saisis l'identifiant et le mot de passe affichés par le script (enregistrés dans app/.env.local sur le Mac).";
  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Dashboard</title>
<style>body{margin:0;padding:32px 20px;font:17px/1.5 -apple-system,system-ui,sans-serif;background:#d6d1c5;color:#111}@media (prefers-color-scheme:dark){body{background:#141310;color:#e9e5da}}h1{font-weight:300;font-size:2rem;letter-spacing:-.03em;margin:0 0 16px}p{max-width:36rem}</style>
</head><body><h1>dashboard</h1><p><strong>${esc(message)}</strong></p><p>${esc(hint)}</p></body></html>`;
}

// Pas de « matcher » : le contrôle s'applique à toutes les adresses (pages, API, fichiers de l'app).
