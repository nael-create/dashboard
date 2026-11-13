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
  return new NextResponse(decision.message, {
    status: decision.status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...(decision.status === 401 ? { "WWW-Authenticate": 'Basic realm="dashboard", charset="UTF-8"' } : {}),
    },
  });
}

// Pas de « matcher » : le contrôle s'applique à toutes les adresses (pages, API, fichiers de l'app).
