import { NextResponse } from "next/server";
import { fail, isSameOrigin } from "@/lib/api";
import { resetProgress } from "@/lib/notions";

export const dynamic = "force-dynamic";

/** Remet la progression d'une notion à zéro (fichier local uniquement, NOTIONS.md n'est pas touché). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  await resetProgress((await params).id);
  return NextResponse.json({ ok: true });
}
