import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { buildNews } from "@/lib/news";

export const dynamic = "force-dynamic";

/** GET /api/news[?refresh=1] — refresh retente aussi les flux en échec (les flux à jour restent en cache 5 min). */
export async function GET(req: Request) {
  try {
    return NextResponse.json(await buildNews(new URL(req.url).searchParams.get("refresh") === "1"));
  } catch (e) {
    return errorResponse(e);
  }
}
