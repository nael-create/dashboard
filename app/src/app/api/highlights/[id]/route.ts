import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, fail, isSameOrigin } from "@/lib/api";
import { deleteHighlight, HIGHLIGHT_COLORS, updateHighlight } from "@/lib/highlights";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  version: z.string(),
  color: z.enum(HIGHLIGHT_COLORS).optional(),
  note: z.string().max(2000).optional(),
});

export async function PATCH(req: Request, { params }: Ctx) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides.");
  try {
    const { version, ...patch } = parsed.data;
    const res = await updateHighlight(version, (await params).id, patch);
    return NextResponse.json({ highlight: res.result, version: res.version });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const version = new URL(req.url).searchParams.get("version");
  if (!version) return fail("Version manquante.");
  try {
    const res = await deleteHighlight(version, (await params).id);
    return NextResponse.json({ version: res.version });
  } catch (e) {
    return errorResponse(e);
  }
}
