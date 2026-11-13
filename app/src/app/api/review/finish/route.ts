import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, fail, isSameOrigin } from "@/lib/api";
import { todayISO } from "@/lib/dates";
import { isoWeek, saveReview } from "@/lib/review";

export const dynamic = "force-dynamic";

const schema = z.object({
  mode: z.enum(["create", "update"]),
  version: z.string().optional(),
  done: z.array(z.string().max(500)).max(200),
  blocked: z.string().max(5000),
  inbox: z.array(z.string().max(700)).max(200),
  focus: z.array(z.string().max(500)).max(3, "3 éléments maximum pour le focus."),
});

/** Écrit reviews/YYYY-Www.md (semaine en cours) puis régénère DASHBOARD.md. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides.");
  const { mode, version, ...content } = parsed.data;
  try {
    const week = isoWeek(todayISO());
    return NextResponse.json({ ...(await saveReview(week.label, content, mode, version)), week: week.label });
  } catch (e) {
    return errorResponse(e);
  }
}
