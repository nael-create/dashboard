import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, fail, isSameOrigin } from "@/lib/api";
import { createEntry } from "@/lib/entries-edit";

export const dynamic = "force-dynamic";
const KINDS = { project: "project", area: "area" } as const;

const schema = z.object({ title: z.string().trim().min(1, "Donne un titre.").max(120, "Titre trop long (120 caractères max).") });

/** POST /api/entries/project|area — crée le dossier depuis le template (seul le titre est demandé). */
export async function POST(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const kind = KINDS[(await params).kind as keyof typeof KINDS];
  if (!kind) return fail("Type inconnu.", 404);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides.");
  try {
    return NextResponse.json({ slug: await createEntry(kind, parsed.data.title) }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
