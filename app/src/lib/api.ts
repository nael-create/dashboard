import { NextResponse } from "next/server";

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
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}
