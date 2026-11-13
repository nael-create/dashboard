import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { favoriteKey, resolveFavorites } from "@/lib/favorites";

export const dynamic = "force-dynamic";

/** Favoris résolus + clés « type|ref » (pour afficher l'état des étoiles partout). */
export async function GET() {
  try {
    const { favorites, version } = await resolveFavorites();
    return NextResponse.json({ favorites, version, keys: favorites.map((f) => favoriteKey(f.type, f.ref)) });
  } catch (e) {
    return errorResponse(e);
  }
}
