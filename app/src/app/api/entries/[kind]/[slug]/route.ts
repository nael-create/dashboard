import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, fail, isSameOrigin } from "@/lib/api";
import { editEntry, readEditable } from "@/lib/entries-edit";

export const dynamic = "force-dynamic";
const KINDS = { project: "project", area: "area" } as const;
type Ctx = { params: Promise<{ kind: string; slug: string }> };

const line = z.string().max(500, "Texte trop long.");
const opSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("fields"), fields: z.record(z.string(), z.string().max(300)) }),
  z.object({ op: z.literal("section"), name: z.string(), text: z.string().max(20_000, "Texte trop long.") }),
  z.object({ op: z.literal("action-add"), text: line }),
  z.object({ op: z.literal("action-check"), index: z.number().int().min(0), text: z.string() }),
  z.object({ op: z.literal("action-edit"), index: z.number().int().min(0), text: z.string(), newText: line }),
  z.object({ op: z.literal("action-move"), index: z.number().int().min(0), text: z.string(), dir: z.union([z.literal(-1), z.literal(1)]) }),
  z.object({ op: z.literal("journal-add"), text: line, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }),
]);
const schema = z.object({ version: z.string(), confirmArchive: z.boolean().default(false), change: opSchema });

export async function GET(_req: Request, { params }: Ctx) {
  const { kind: k, slug } = await params;
  const kind = KINDS[k as keyof typeof KINDS];
  if (!kind) return fail("Type inconnu.", 404);
  try {
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
