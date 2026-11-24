import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, fail, isSameOrigin } from "@/lib/api";
import { todayISO } from "@/lib/dates";
import { addDecision, archiveDoc, readDocPage, updateDoc } from "@/lib/docs";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ slug: string; doc: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { slug, doc } = await params;
  try {
    const page = await readDocPage(slug, doc);
    return page ? NextResponse.json(page) : fail("Page introuvable.", 404);
  } catch (e) {
    return errorResponse(e);
  }
}

const patchSchema = z.object({ version: z.string(), title: z.string().max(120).optional(), body: z.string().max(200_000).optional() });

/** Renommer (titre) et/ou modifier le texte. */
export async function PATCH(req: Request, { params }: Ctx) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const { slug, doc } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides.");
  try {
    const { version, ...patch } = parsed.data;
    const res = await updateDoc(slug, doc, version, patch, todayISO());
    return NextResponse.json({ version: res.version });
  } catch (e) {
    return errorResponse(e);
  }
}

const postSchema = z.object({ action: z.literal("decision"), version: z.string(), title: z.string().max(160) });

/** « Nouvelle décision » (journal de décisions). */
export async function POST(req: Request, { params }: Ctx) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const { slug, doc } = await params;
  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides.");
  try {
    const res = await addDecision(slug, doc, parsed.data.version, parsed.data.title, todayISO());
    return NextResponse.json({ version: res.version });
  } catch (e) {
    return errorResponse(e);
  }
}

/** « Supprimer » : rangée dans docs/_archive/ du projet (après confirmation dans l'interface). */
export async function DELETE(req: Request, { params }: Ctx) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const { slug, doc } = await params;
  const version = new URL(req.url).searchParams.get("version") ?? "";
  try {
    return NextResponse.json({ archivedTo: await archiveDoc(slug, doc, version, todayISO()) });
  } catch (e) {
    return errorResponse(e);
  }
}
