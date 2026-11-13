import { NextResponse } from "next/server";
import { completeLogin, explainAuthError, OutlookError } from "@/lib/outlook";

export const dynamic = "force-dynamic";

/**
 * Retour de Microsoft (sur http://localhost:3000, l'adresse enregistrée dans Entra).
 * Les jetons sont stockés côté serveur ; on renvoie ensuite vers l'adresse habituelle de l'app.
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const back = (msg?: string) =>
    NextResponse.redirect(`http://127.0.0.1:3000/newsletters${msg ? `?erreur=${encodeURIComponent(msg)}` : ""}`);

  if (sp.get("error")) return back(explainAuthError(sp.get("error"), sp.get("error_description")));
  const code = sp.get("code");
  const state = sp.get("state");
  if (!code || !state) return back("Réponse de connexion incomplète. Recommence.");
  try {
    await completeLogin(code, state);
    return back();
  } catch (e) {
    if (e instanceof OutlookError) return back(e.message);
    const err = e as { errorCode?: string; errorMessage?: string; message?: string };
    return back(explainAuthError(err.errorCode ?? null, err.errorMessage ?? err.message ?? null));
  }
}
