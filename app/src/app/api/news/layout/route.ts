import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, fail, isSameOrigin } from "@/lib/api";
import { saveLayout } from "@/lib/news-config";

export const dynamic = "force-dynamic";

const schema = z.object({
  version: z.string(),
  mode: z.enum(["source", "category"]).optional(),
  order: z.array(z.object({ key: z.string().min(1).max(80), visible: z.boolean() })).max(200).optional(),
});

/** Ordre, visibilité des widgets et regroupement (par source ou par catégorie), enregistrés dans NEWS.md. */
export async function PATCH(req: Request) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Réglage invalide.");
  const { version, ...patch } = parsed.data;
  try {
    const res = await saveLayout(version, patch);
    return NextResponse.json({ version: res.version });
  } catch (e) {
    return errorResponse(e);
  }
}
