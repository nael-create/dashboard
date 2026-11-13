import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, fail, isSameOrigin } from "@/lib/api";
import { removeFavorite, setFavoriteNote } from "@/lib/favorites";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({ version: z.string(), note: z.string().max(280, "Note trop longue (280 caractères max).") });

export async function PATCH(req: Request, { params }: Ctx) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides.");
  try {
    const res = await setFavoriteNote(parsed.data.version, (await params).id, parsed.data.note);
    return NextResponse.json({ version: res.version });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const version = new URL(req.url).searchParams.get("version") ?? "";
  try {
    const res = await removeFavorite(version, (await params).id);
    return NextResponse.json({ version: res.version });
  } catch (e) {
    return errorResponse(e);
  }
}
