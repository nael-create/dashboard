import { NextResponse } from "next/server";
import { ConflictError } from "./content-file";

/** Réponse d'erreur JSON avec un message en français. */
export const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

/**
 * Refuse les requêtes d'écriture venant d'une autre origine (protection CSRF :
 * une page web malveillante ne doit pas pouvoir modifier tes calendriers).
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") !== "cross-site";
  try {
    const host = new URL(origin).host;
    // Derrière Tailscale Serve, l'hôte d'origine est aussi transmis dans X-Forwarded-Host.
    return host === req.headers.get("host") || host === req.headers.get("x-forwarded-host");
  } catch {
    return false;
  }
}

/** Transforme une erreur connue en réponse JSON claire (409 pour un conflit d'écriture). */
export function errorResponse(e: unknown) {
  if (e instanceof ConflictError) return fail(e.message, 409);
  if (e instanceof UserError) return fail(e.message, e.status);
  console.error(e);
  return fail(e instanceof Error ? e.message : String(e), 500);
}

/** Erreur destinée à être affichée telle quelle à l'utilisateur. */
export class UserError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}
