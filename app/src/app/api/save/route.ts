import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, fail, isSameOrigin } from "@/lib/api";
import { save } from "@/lib/git";

export const dynamic = "force-dynamic";

const schema = z.object({ confirmOtherBranch: z.boolean().default(false) });

/** Lance la sauvegarde du contenu (commit + pull --rebase + push). Aucun paramètre n'est transmis à git. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail("Requête invalide.");
  try {
    return NextResponse.json(await save(parsed.data.confirmOtherBranch));
  } catch (e) {
    return errorResponse(e);
  }
}
