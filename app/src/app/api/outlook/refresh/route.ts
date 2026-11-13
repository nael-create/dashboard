import { NextResponse } from "next/server";
import { fail, isSameOrigin } from "@/lib/api";
import { listNewsletters, OutlookError } from "@/lib/outlook";

export const dynamic = "force-dynamic";

/** Rafraîchit la liste (ignore le cache de 3 minutes). */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  try {
    await listNewsletters(true);
  } catch (e) {
    if (!(e instanceof OutlookError)) throw e;
  }
  return NextResponse.redirect(new URL("/newsletters", req.url), 303);
}
