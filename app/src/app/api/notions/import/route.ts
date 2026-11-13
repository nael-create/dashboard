import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, fail, isSameOrigin } from "@/lib/api";
import { importNotions } from "@/lib/notions";
import { notionFields } from "@/lib/notion-schema";
import { todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

const schema = z.object({
  version: z.string(),
  items: z.array(z.object({ term: notionFields.term, definition: notionFields.definition })).min(1).max(500),
});

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides.");
  try {
    const res = await importNotions(parsed.data.items, todayISO(), parsed.data.version);
    return NextResponse.json({ version: res.version, imported: res.result ?? 0 });
  } catch (e) {
    return errorResponse(e);
  }
}
