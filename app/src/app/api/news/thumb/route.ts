import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { ogImage } from "@/lib/og-image";
import { cachedArticles } from "@/lib/rss";

export const dynamic = "force-dynamic";

/** GET /api/news/thumb?id=… — image d'aperçu d'un article déjà en cache (jamais une URL arbitraire). */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const article = cachedArticles().find((a) => a.id === id);
  if (!article) return fail("Article inconnu.", 404);
  const image = article.thumbnail ?? (await ogImage(article.link));
  return NextResponse.json({ image }, { headers: { "Cache-Control": "private, max-age=3600" } });
}
