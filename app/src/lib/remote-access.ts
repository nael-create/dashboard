/**
 * Accès à distance (téléphone via Tailscale Serve, voir app/README.md).
 *
 * - Requête locale (navigateur du Mac sur 127.0.0.1 / localhost, sans relais) : accès libre.
 * - Toute autre requête (relayée par Tailscale Serve ou venant d'ailleurs) : mot de passe
 *   OBLIGATOIRE (authentification HTTP Basic, DASHBOARD_BASIC_AUTH = « identifiant:mot-de-passe »).
 *   Sans mot de passe valide configuré, tout accès distant est refusé.
 *
 * Fonctions pures (pas d'accès réseau ni disque) : testées dans test/remote-access.test.ts.
 */

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

const LOOPBACK_IPS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/** Longueur minimale du mot de passe exigé pour l'accès à distance. */
export const MIN_PASSWORD_LENGTH = 12;

type HeaderBag = { get(name: string): string | null };

/** Nom d'hôte de l'en-tête Host, sans le port, en minuscules. */
function hostOf(headers: HeaderBag): string {
  const host = (headers.get("host") ?? "").trim().toLowerCase();
  if (host.startsWith("[")) return host.slice(0, host.indexOf("]") + 1);
  return host.replace(/:\d+$/, "");
}

/**
 * Vrai seulement pour le navigateur du Mac lui-même : Host local, et adresse d'origine locale.
 *
 * Next.js remplit lui-même X-Forwarded-For / X-Forwarded-Host pour toute requête (avec
 * l'adresse 127.0.0.1 et le Host reçu) : leur seule présence ne prouve donc rien. En revanche,
 * Tailscale Serve y met l'adresse Tailscale de l'appareil (100.x.y.z ou fd7a:…) : un téléphone
 * ne peut pas se faire passer pour le Mac en trichant sur l'en-tête Host.
 */
export function isLocalRequest(headers: HeaderBag): boolean {
  if (!LOCAL_HOSTS.has(hostOf(headers))) return false;
  if (headers.get("tailscale-user-login") || headers.get("forwarded")) return false;
  const fwdHost = headers.get("x-forwarded-host");
  if (fwdHost && !LOCAL_HOSTS.has(hostOf({ get: () => fwdHost }))) return false;
  const chain = (headers.get("x-forwarded-for") ?? "").split(",").map((ip) => ip.trim()).filter(Boolean);
  return chain.every((ip) => LOOPBACK_IPS.has(ip.toLowerCase()));
}

/** Problème de configuration du mot de passe (texte en français), ou null s'il est utilisable. */
export function credentialsProblem(credentials: string | undefined): string | null {
  const value = credentials?.trim() ?? "";
  if (!value) return "Accès à distance désactivé : aucun mot de passe configuré (DASHBOARD_BASIC_AUTH dans app/.env.local).";
  const sep = value.indexOf(":");
  if (sep < 1) return "Accès à distance désactivé : DASHBOARD_BASIC_AUTH doit avoir la forme identifiant:mot-de-passe.";
  if (value.length - sep - 1 < MIN_PASSWORD_LENGTH) {
    return `Accès à distance désactivé : le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`;
  }
  return null;
}

/** Compare l'en-tête Authorization (Basic) aux identifiants attendus, en temps constant. */
export function isAuthorized(authorization: string | null, credentials: string): boolean {
  const [scheme, encoded] = (authorization ?? "").split(" ");
  if (scheme !== "Basic" || !encoded) return false;
  let given = "";
  try {
    given = new TextDecoder().decode(Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)));
  } catch {
    return false;
  }
  return safeEqual(given, credentials.trim());
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type AccessDecision = { allow: true } | { allow: false; status: 401 | 403; message: string };

/** Décision d'accès pour une requête (utilisée par src/proxy.ts). */
export function decideAccess(headers: HeaderBag, credentials: string | undefined): AccessDecision {
  if (isLocalRequest(headers)) return { allow: true };
  const problem = credentialsProblem(credentials);
  if (problem) return { allow: false, status: 403, message: problem };
  if (isAuthorized(headers.get("authorization"), credentials!)) return { allow: true };
  return { allow: false, status: 401, message: "Mot de passe requis." };
}
