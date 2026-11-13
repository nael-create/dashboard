import { NextResponse } from "next/server";
import { loginUrl, OutlookError } from "@/lib/outlook";
import { isLocalRequest } from "@/lib/remote-access";

export const dynamic = "force-dynamic";

/** Redirection relative (fonctionne aussi bien sur le Mac qu'à travers Tailscale Serve). */
const backToNewsletters = (msg: string) =>
  new Response(null, { status: 303, headers: { Location: `/newsletters?erreur=${encodeURIComponent(msg)}` } });

/** Redirige vers la page de connexion Microsoft. */
export async function GET(req: Request) {
  // Microsoft renvoie vers http://localhost:3000 : la connexion ne peut se faire que depuis le Mac.
  if (!isLocalRequest(req.headers)) {
    return backToNewsletters("La connexion à Outlook se fait depuis le Mac (http://localhost:3000). Une fois connecté, tes newsletters sont aussi lisibles ici.");
  }
  try {
    return NextResponse.redirect(await loginUrl());
  } catch (e) {
    return backToNewsletters(e instanceof OutlookError ? e.message : "Impossible de démarrer la connexion à Outlook.");
  }
}
