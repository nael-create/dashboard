import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, fail, isSameOrigin } from "@/lib/api";
import { deleteMemo, updateMemo } from "@/lib/memo";
import { memoFields } from "@/lib/memo-schema";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ key: string }> };

const patchSchema = z.object({
  version: z.string(),
  title: memoFields.title.optional(),
  text: memoFields.text.optional(),
  tags: memoFields.tags.optional(),
  pinned: memoFields.pinned.optional(),
  date: memoFields.date.optional(),
});

export async function PATCH(req: Request, { params }: Ctx) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides.");
  try {
    const { version, ...patch } = parsed.data;
    const res = await updateMemo(version, (await params).key, patch);
    return NextResponse.json({ version: res.version });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const version = new URL(req.url).searchParams.get("version");
  if (!version) return fail("Version manquante.");
  try {
    const res = await deleteMemo(version, (await params).key);
    return NextResponse.json({ version: res.version });
  } catch (e) {
    return errorResponse(e);
  }
}
