import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, fail, isSameOrigin } from "@/lib/api";
import { addNotion, notionsWithProgress } from "@/lib/notions";
import { notionFields } from "@/lib/notion-schema";
import { todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await notionsWithProgress(todayISO()));
  } catch (e) {
    return errorResponse(e);
  }
}

const schema = z.object({
  version: z.string().optional(), // facultatif pour l'ajout rapide : ajout en fin de fichier, rien n'est écrasé
  term: notionFields.term,
  definition: notionFields.definition.default(""),
  example: notionFields.example.default(""),
  tags: notionFields.tags.default([]),
});

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides.");
  const { version, ...input } = parsed.data;
  try {
    const res = await addNotion(input, todayISO(), version);
    return NextResponse.json({ version: res.version }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
