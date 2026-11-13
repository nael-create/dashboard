import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, fail, isSameOrigin } from "@/lib/api";
import { addMemo, readMemo } from "@/lib/memo";
import { todayISO } from "@/lib/dates";
import { memoFields } from "@/lib/memo-schema";

export const dynamic = "force-dynamic";


export async function GET() {
  try {
    return NextResponse.json(await readMemo());
  } catch (e) {
    return errorResponse(e);
  }
}

const addSchema = z.object({
  version: z.string(),
  title: memoFields.title,
  text: memoFields.text.default(""),
  tags: memoFields.tags.default([]),
  pinned: memoFields.pinned.default(false),
});

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const parsed = addSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides.");
  try {
    const { version, ...input } = parsed.data;
    const res = await addMemo(version, { ...input, date: todayISO() });
    return NextResponse.json({ version: res.version, id: res.result?.id }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
