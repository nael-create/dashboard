import { fail } from "@/lib/api";
import { readAsset } from "@/lib/docs";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ slug: string; file: string }> };

/** Affiche une image d'un projet (projects/<projet>/assets/). Type fixé par l'extension, jamais de SVG. */
export async function GET(_req: Request, { params }: Ctx) {
  const { slug, file } = await params;
  const a = await readAsset(slug, file);
  if (!a) return fail("Image introuvable.", 404);
  return new Response(new Uint8Array(a.data), {
    headers: { "Content-Type": a.type, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=3600", "Content-Security-Policy": "default-src 'none'" },
  });
}
