import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, fail, isSameOrigin } from "@/lib/api";
import { addSource } from "@/lib/news-config";
import { looksPersonal, sourceFields } from "@/lib/news-schema";
import { probeFeed } from "@/lib/rss";

export const dynamic = "force-dynamic";

const schema = z.object({
  version: z.string(),
  ...sourceFields,
  url: z.string().trim().min(1, "Colle le lien du flux RSS."),
  private: z.boolean().default(false),
});

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return fail("Requête refusée.", 403);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Données invalides.");
  const { version, ...input } = parsed.data;
  let url: string;
  try {
    const u = new URL(input.url.replace(/^feed:\/\//i, "https://"));
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
    url = u.toString();
  } catch {
    return fail("Ce lien n'est pas une adresse web valide.");
  }
  if (!input.private && looksPersonal(url)) {
    return fail("Ce lien semble contenir une clé personnelle : coche « Lien privé » pour qu'il reste sur ton ordinateur.", 422);
  }
  let count: number;
  try {
    count = await probeFeed({ id: "test", name: input.name, url });
  } catch (e) {
    return fail(`Impossible de lire ce flux : ${e instanceof Error ? e.message : String(e)}.`, 422);
  }
  try {
    const source = await addSource(version, { ...input, url });
    return NextResponse.json({ source: { ...source, url: undefined }, count }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
