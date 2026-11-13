import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { listAreas, listProjects } from "@/lib/content";
import { readFavorites } from "@/lib/favorites";
import { readInbox } from "@/lib/inbox";
import { readMemo } from "@/lib/memo";
import { readNotions } from "@/lib/notions";
import { cachedNewsletters } from "@/lib/outlook";
import { cachedArticles, byDateDesc, dedupe } from "@/lib/rss";

export const dynamic = "force-dynamic";

export interface SearchItem {
  type: "project" | "area" | "memo" | "notion" | "inbox" | "favorite" | "newsletter" | "news";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  external?: boolean;
}

/**
 * Index de la palette de commandes. Newsletters : objet et expéditeur seulement, depuis la liste déjà
 * en mémoire ; actus : titres déjà en cache. Aucun appel réseau ici.
 */
export async function GET() {
  try {
    const [projects, areas, memo, notions, inbox, favorites] = await Promise.all([
      listProjects(), listAreas(), readMemo(), readNotions(), readInbox(), readFavorites(),
    ]);
    const items: SearchItem[] = [
      ...projects.map((p) => ({ type: "project" as const, id: p.slug, title: p.title, subtitle: [p.status, p.priority].filter(Boolean).join(" · "), href: `/projets/${p.slug}` })),
      ...areas.map((a) => ({ type: "area" as const, id: a.slug, title: a.title, href: `/domaines/${a.slug}` })),
      ...memo.entries.map((e) => ({ type: "memo" as const, id: e.key, title: e.title, subtitle: e.text.slice(0, 80), href: `/memo#memo-${e.id ?? e.key}` })),
      ...notions.notions.map((n) => ({
        type: "notion" as const, id: n.id, title: n.term, subtitle: n.definition ? n.definition.slice(0, 80) : "à compléter",
        href: n.definition ? `/notions#notion-${n.id}` : "/notions?onglet=gerer",
      })),
      ...inbox.items.filter((i) => !i.done).map((i) => ({ type: "inbox" as const, id: String(i.index), title: i.text, subtitle: i.date ?? undefined, href: "/revue" })),
      ...favorites.favorites.map((f) => ({
        type: "favorite" as const, id: f.id, title: f.title, subtitle: f.source || undefined,
        href: f.type === "article" || f.type === "newsletter" ? f.ref : "/favoris", external: f.type === "article" || f.type === "newsletter",
      })),
      ...cachedNewsletters().map((m) => ({ type: "newsletter" as const, id: m.id, title: m.subject, subtitle: m.from, href: `/newsletters/${encodeURIComponent(m.id)}` })),
      ...dedupe([...cachedArticles()].sort(byDateDesc)).slice(0, 300).map((a) => ({ type: "news" as const, id: a.id, title: a.title, subtitle: a.publisher, href: a.link, external: true })),
    ];
    return NextResponse.json({ items });
  } catch (e) {
    return errorResponse(e);
  }
}
