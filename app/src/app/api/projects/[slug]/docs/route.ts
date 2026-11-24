import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, fail, isSameOrigin } from "@/lib/api";
import { todayISO } from "@/lib/dates";
import { createDoc, listDocs, listTemplates, reorderDocs } from "@/lib/docs";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ slug: string }> };

/** Pages de docs d'un projet et modèles disponibles. */
export async function GET(_req: Request, { params }: Ctx) {
  const { slug } = await params;
  try {
    return NextResponse.json({ docs: await listDocs(slug), templates: await listTemplates() });
  } catch (e) {
    return errorResponse(e);
  }
}

const createSchema = z.object({ title: z.string().max(120, "Titre trop long."), template: z.string().max(60).nullable().default(null) });

export async function POST(req: Request, { params }: Ctx) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const { slug } = await params;
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides.");
  try {
    const doc = await createDoc(slug, parsed.data.title, parsed.data.template, todayISO());
    return NextResponse.json({ doc }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

const orderSchema = z.object({ order: z.array(z.string().max(80)).max(500) });

/** Nouvel ordre des pages. */
export async function PATCH(req: Request, { params }: Ctx) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const { slug } = await params;
  const parsed = orderSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Ordre invalide.");
  try {
    await reorderDocs(slug, parsed.data.order);
    return NextResponse.json({ docs: await listDocs(slug) });
  } catch (e) {
    return errorResponse(e);
  }
}
