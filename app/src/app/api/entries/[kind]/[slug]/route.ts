import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, fail, isSameOrigin } from "@/lib/api";
import { deleteProject, editEntry, projectContents, readEditable } from "@/lib/entries-edit";

export const dynamic = "force-dynamic";
const KINDS = { project: "project", area: "area" } as const;
type Ctx = { params: Promise<{ kind: string; slug: string }> };

const opSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("fields"), fields: z.record(z.string(), z.string().max(300)) }),
  z.object({ op: z.literal("note"), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), text: z.string().max(20_000, "Note trop longue.") }),
]);
const schema = z.object({ version: z.string(), confirmArchive: z.boolean().default(false), change: opSchema });

export async function GET(req: Request, { params }: Ctx) {
  const { kind: k, slug } = await params;
  const kind = KINDS[k as keyof typeof KINDS];
  if (!kind) return fail("Type inconnu.", 404);
  try {
    // ?contenu=1 : ce que contient le dossier (confirmation de suppression).
    if (kind === "project" && new URL(req.url).searchParams.has("contenu")) return NextResponse.json(await projectContents(slug));
    const e = await readEditable(kind, slug);
    return e ? NextResponse.json(e) : fail("Introuvable.", 404);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const { kind: k, slug } = await params;
  const kind = KINDS[k as keyof typeof KINDS];
  if (!kind) return fail("Type inconnu.", 404);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides.");
  try {
    return NextResponse.json(await editEntry(kind, slug, parsed.data.version, parsed.data.change, parsed.data.confirmArchive));
  } catch (e) {
    return errorResponse(e);
  }
}

/** Supprime définitivement un projet (dossier entier), après confirmation dans l'interface. ?version= obligatoire. */
export async function DELETE(req: Request, { params }: Ctx) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const { kind, slug } = await params;
  if (kind !== "project") return fail("Seuls les projets peuvent être supprimés.", 400);
  const version = new URL(req.url).searchParams.get("version") ?? "";
  if (!version) return fail("Version manquante : recharge la page.", 400);
  try {
    return NextResponse.json(await deleteProject(slug, version));
  } catch (e) {
    return errorResponse(e);
  }
}
