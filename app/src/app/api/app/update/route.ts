import { NextResponse } from "next/server";
import { fail, isSameOrigin } from "@/lib/api";
import { updatesAvailable } from "@/lib/git";

export const dynamic = "force-dynamic";

/** Le dashboard tourne-t-il en arrière-plan (agent macOS, voir app/scripts/install-service.sh) ? */
const isService = () => process.env.DASHBOARD_SERVICE === "1";

/** État des mises à jour : { service, behind } (behind = nombre de nouveautés sur GitHub, null si injoignable). */
export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get("check") === "1";
  return NextResponse.json({ service: isService(), behind: await updatesAvailable(force) });
}

/**
 * « Mettre à jour » : le serveur s'arrête volontairement (code 1) ; macOS relance aussitôt le service,
 * dont le lanceur récupère la dernière version (git pull --ff-only, jamais forcé), réinstalle les
 * dépendances si besoin, vide le cache de compilation si la version a changé, puis redémarre l'app.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  if (!isService()) {
    return fail("Le dashboard tourne dans une fenêtre Terminal : ferme-la, puis relance « Lancer le dashboard » (il se met à jour au démarrage).", 409);
  }
  setTimeout(() => process.exit(1), 400);
  return NextResponse.json({ restarting: true }, { status: 202 });
}
