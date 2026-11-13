import { NextResponse } from "next/server";
import { fail, isSameOrigin } from "@/lib/api";
import { logout } from "@/lib/outlook";

export const dynamic = "force-dynamic";

/** Déconnexion : supprime les jetons stockés sur l'ordinateur. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  await logout();
  return NextResponse.redirect(new URL("/newsletters", req.url), 303);
}
