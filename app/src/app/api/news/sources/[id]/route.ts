import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, fail, isSameOrigin } from "@/lib/api";
import { removeSource, updateSource } from "@/lib/news-config";
import { sourceFields } from "@/lib/news-schema";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  version: z.string(),
  name: sourceFields.name.optional(),
  category: sourceFields.category.optional(),
  color: sourceFields.color.optional(),
  enabled: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: Ctx) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides.");
  const { version, ...patch } = parsed.data;
  try {
    const s = await updateSource(version, (await params).id, { ...patch, color: patch.color?.toLowerCase() });
    return NextResponse.json({ source: { ...s, url: undefined } });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const version = new URL(req.url).searchParams.get("version") ?? "";
  try {
    await removeSource(version, (await params).id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
