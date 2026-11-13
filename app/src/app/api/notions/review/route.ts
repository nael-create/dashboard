import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, fail, isSameOrigin } from "@/lib/api";
import { recordReview } from "@/lib/notions";
import { todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

const schema = z.object({ id: z.string().min(1).max(130), result: z.enum(["knew", "again"]) });

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Données invalides.");
  try {
    const p = await recordReview(parsed.data.id, parsed.data.result === "knew", todayISO());
    return NextResponse.json({ progress: p });
  } catch (e) {
    return errorResponse(e);
  }
}
