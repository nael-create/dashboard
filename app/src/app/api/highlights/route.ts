import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, fail, isSameOrigin } from "@/lib/api";
import { MAX_PASSAGE } from "@/lib/anchoring";
import { addHighlight, HIGHLIGHT_COLORS, readHighlights, readHighlightStatus } from "@/lib/highlights";
import { todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** GET /api/highlights — tous les surlignages, la version du fichier et l'état « introuvable ». */
export async function GET() {
  try {
    const [{ highlights, version }, status] = await Promise.all([readHighlights(), readHighlightStatus()]);
    return NextResponse.json({ highlights, version, status });
  } catch (e) {
    return errorResponse(e);
  }
}

const schema = z.object({
  version: z.string().optional(), // ajout en haut du fichier : rien n'est écrasé
  text: z.string().max(MAX_PASSAGE * 2),
  prefix: z.string().max(200).default(""),
  suffix: z.string().max(200).default(""),
  color: z.enum(HIGHLIGHT_COLORS),
  note: z.string().max(2000).optional(),
  subject: z.string().max(400),
  from: z.string().max(300),
  received: z.string().max(40),
  link: z.string().max(2000),
});

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides.");
  const { version, ...input } = parsed.data;
  try {
    const res = await addHighlight(input, todayISO(), version);
    return NextResponse.json({ highlight: res.result, version: res.version }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
