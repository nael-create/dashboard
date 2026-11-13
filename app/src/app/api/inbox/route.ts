import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, fail, isSameOrigin } from "@/lib/api";
import { addInboxItem } from "@/lib/inbox";
import { todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

const schema = z.object({ text: z.string().trim().min(1, "Rien à ajouter.").max(500, "Texte trop long (500 caractères max).") });

/** Ajoute « - [ ] YYYY-MM-DD — texte » à INBOX.md (capture rapide). */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides.");
  try {
    await addInboxItem(parsed.data.text, todayISO());
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
