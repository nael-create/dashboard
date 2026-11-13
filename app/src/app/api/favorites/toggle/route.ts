import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, fail, isSameOrigin } from "@/lib/api";
import { FAVORITE_TYPES, toggleFavorite } from "@/lib/favorites";
import { readMemo, updateMemo } from "@/lib/memo";
import { todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

const schema = z.object({
  type: z.enum(FAVORITE_TYPES),
  ref: z.string().min(1).max(2000),
  title: z.string().max(500),
  source: z.string().max(200).optional(),
  published: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

/** Ajoute ou retire un favori. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Favori invalide.");
  const input = { ...parsed.data };
  try {
    // Un mémo écrit à la main sans « id: » reçoit d'abord un id stable (sinon la référence changerait).
    if (input.type === "memo" && /^memo:h[0-9a-f]+$/.test(input.ref)) {
      const key = input.ref.slice(5);
      const { version } = await readMemo();
      await updateMemo(version, key, {});
      const e = (await readMemo()).entries.find((x) => x.title === input.title && x.id);
      if (e?.id) input.ref = `memo:${e.id}`;
    }
    const res = await toggleFavorite(input, todayISO());
    return NextResponse.json({ ...res, ref: input.ref });
  } catch (e) {
    return errorResponse(e);
  }
}
