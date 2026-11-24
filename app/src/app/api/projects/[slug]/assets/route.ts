import { NextResponse } from "next/server";
import { errorResponse, fail, isSameOrigin } from "@/lib/api";
import { MAX_ASSET_BYTES, saveAsset } from "@/lib/docs";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ slug: string }> };

/** Image collée ou déposée dans une page de docs (corps brut, nom dans ?nom=). */
export async function POST(req: Request, { params }: Ctx) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const { slug } = await params;
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_ASSET_BYTES) return fail("Image trop lourde (5 Mo au plus).", 413);
  try {
    const buf = new Uint8Array(await req.arrayBuffer());
    const name = await saveAsset(slug, new URL(req.url).searchParams.get("nom") ?? "image", buf, new Date());
    return NextResponse.json({ name, markdown: `../assets/${name}` }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
