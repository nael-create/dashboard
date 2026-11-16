/**
 * Politique de sécurité (CSP) des pages de lecture des newsletters (/newsletters/…).
 *
 * Le mode « Lecture » affiche le HTML nettoyé de l'e-mail directement dans la page (pour pouvoir le
 * surligner). Deuxième barrière derrière le nettoyage (sanitize-html) : seuls les scripts de l'app,
 * marqués d'un nonce tiré au hasard à chaque requête, peuvent s'exécuter — jamais un script ni un
 * attribut « onerror=… » venu d'un e-mail. Images distantes autorisées seulement si l'utilisateur
 * a cliqué « Images ». Fonction pure, testée dans test/csp.test.ts.
 */
export function newsletterCsp(nonce: string, opts: { images: boolean; dev: boolean }): string {
  return [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic'${opts.dev ? " 'unsafe-eval'" : ""}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${opts.images ? " https: http:" : ""}`,
    "font-src 'self'",
    `connect-src 'self'${opts.dev ? " ws: wss:" : ""}`,
    "media-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** Pages concernées : la lecture d'une newsletter. */
export const needsNewsletterCsp = (pathname: string) => /^\/newsletters\/[^/]+$/.test(pathname);
