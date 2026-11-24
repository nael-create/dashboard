import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, fail, isSameOrigin } from "@/lib/api";
import { remindersStatus, sendTestEmail } from "@/lib/gh";
import { syncNow, taskSyncStatus } from "@/lib/task-sync";

export const dynamic = "force-dynamic";

/** État des rappels : derniers passages du workflow (via gh) et synchro de TACHES.md. */
export async function GET(req: Request) {
  try {
    const force = new URL(req.url).searchParams.has("rafraichir");
    return NextResponse.json({ ...(await remindersStatus(force)), sync: taskSyncStatus() });
  } catch (e) {
    return errorResponse(e);
  }
}

const schema = z.object({ action: z.enum(["test", "sync"]) });

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Action inconnue.");
  try {
    if (parsed.data.action === "sync") return NextResponse.json({ sync: await syncNow() });
    // Le test lit TACHES.md sur GitHub : on synchronise d'abord.
    const sync = await syncNow();
    const r = await sendTestEmail();
    return r.ok ? NextResponse.json({ ok: true, sync }) : fail(r.message, 502);
  } catch (e) {
    return errorResponse(e);
  }
}
