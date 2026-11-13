import { NextResponse } from "next/server";
import config from "@config";
import { errorResponse } from "@/lib/api";
import { dueNotions } from "@/lib/notions";
import { todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** GET /api/notions/due?offset=0 — notions à revoir aujourd'hui, par paquets de `notionsPerDay`. */
export async function GET(req: Request) {
  const offset = Math.max(0, Number(new URL(req.url).searchParams.get("offset")) || 0);
  try {
    return NextResponse.json(await dueNotions(todayISO(), config.notionsPerDay, offset));
  } catch (e) {
    return errorResponse(e);
  }
}
