import { NextResponse } from "next/server";
import { readHighlights } from "@/lib/highlights";
import { findNewsletterId } from "@/lib/outlook";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Redirection relative (fonctionne sur le Mac comme à travers Tailscale). */
const go = (location: string) => new Response(null, { status: 303, headers: { Location: location } });

/**
 * « Ouvrir dans la newsletter » : la lecture, défilée jusqu'au surlignage ; si la newsletter n'est plus
 * disponible (supprimée, Outlook déconnecté…), son lien Outlook web.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const id = (await params).id;
  const h = (await readHighlights()).highlights.find((x) => x.id === id);
  if (!h) return go("/surlignages");
  try {
    const messageId = await findNewsletterId(h);
    if (messageId) return go(`/newsletters/${encodeURIComponent(messageId)}?surlignage=${encodeURIComponent(h.id)}`);
  } catch {
    /* Outlook indisponible : on se rabat sur le lien web */
  }
  if (h.link) return NextResponse.redirect(h.link, 303);
  return go(`/surlignages?introuvable=${encodeURIComponent(h.id)}#${h.id}`);
}
