import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, fail, isSameOrigin } from "@/lib/api";
import { recordHighlightStatus } from "@/lib/highlights";

export const dynamic = "force-dynamic";

const id = z.string().regex(/^hl-\d{8}-\d+$/);
const schema = z.object({ found: z.array(id).max(500).default([]), missing: z.array(id).max(500).default([]) });

/** La page de lecture signale les surlignages retrouvés / introuvables (état local, jamais dans le dépôt). */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Données invalides.");
  try {
    await recordHighlightStatus(parsed.data.found, parsed.data.missing);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
