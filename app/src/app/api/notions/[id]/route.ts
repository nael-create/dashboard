import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, fail, isSameOrigin } from "@/lib/api";
import { deleteNotion, updateNotion } from "@/lib/notions";
import { notionFields } from "@/lib/notion-schema";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  version: z.string(),
  term: notionFields.term.optional(),
  definition: notionFields.definition.optional(),
  example: notionFields.example.optional(),
  tags: notionFields.tags.optional(),
});

export async function PATCH(req: Request, { params }: Ctx) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides.");
  const { version, ...patch } = parsed.data;
  try {
    const res = await updateNotion(version, (await params).id, patch);
    return NextResponse.json({ version: res.version });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const version = new URL(req.url).searchParams.get("version") ?? "";
  try {
    await deleteNotion(version, (await params).id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
