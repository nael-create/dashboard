import { NextResponse } from "next/server";
import { loginUrl, OutlookError } from "@/lib/outlook";

export const dynamic = "force-dynamic";

/** Redirige vers la page de connexion Microsoft. */
export async function GET() {
  try {
    return NextResponse.redirect(await loginUrl());
  } catch (e) {
    const msg = e instanceof OutlookError ? e.message : "Impossible de démarrer la connexion à Outlook.";
    return NextResponse.redirect(`http://127.0.0.1:3000/newsletters?erreur=${encodeURIComponent(msg)}`);
  }
}
