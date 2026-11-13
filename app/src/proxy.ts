import { NextResponse, type NextRequest } from "next/server";

/**
 * Garde-fou pour un éventuel déploiement futur.
 * - En local (127.0.0.1 / localhost) : accès libre.
 * - Ailleurs : authentification HTTP Basic OBLIGATOIRE via DASHBOARD_BASIC_AUTH
 *   (« identifiant:mot-de-passe »). Sans cette variable, tout accès distant est refusé.
 */
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export function proxy(request: NextRequest) {
  const credentials = process.env.DASHBOARD_BASIC_AUTH;
  // En-tête Host tel qu'envoyé par le navigateur, sans le port.
  const host = (request.headers.get("host") ?? "").replace(/:\d+$/, "").toLowerCase();

  if (!credentials) {
    if (LOCAL_HOSTS.has(host)) return NextResponse.next();
    return new NextResponse("Accès refusé : authentification non configurée.", { status: 403 });
  }

  const header = request.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  let given = "";
  try {
    given = scheme === "Basic" && encoded ? atob(encoded) : "";
  } catch {
    /* en-tête mal formé */
  }
  if (given && safeEqual(given, credentials)) return NextResponse.next();

  return new NextResponse("Authentification requise.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="dashboard", charset="UTF-8"' },
  });
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
