import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { listWithBody } from "@/lib/content";
import { dayNotes } from "@/lib/daily-notes";
import { longDate } from "@/lib/fr-dates";
import { parseDoc } from "@/lib/markdown-doc";
import { readFavorites } from "@/lib/favorites";
import { readInbox } from "@/lib/inbox";
import { listAllDocs } from "@/lib/docs";
import { readTasks } from "@/lib/tasks";
import { readNotions } from "@/lib/notions";
import { readAgenda } from "@/lib/agenda";
import { readHighlights } from "@/lib/highlights";
import { cachedNewsletters } from "@/lib/outlook";
import { cachedArticles, byDateDesc, dedupe } from "@/lib/rss";

export const dynamic = "force-dynamic";

export interface SearchItem {
  type: "project" | "area" | "task" | "note" | "doc" | "notion" | "inbox" | "favorite" | "newsletter" | "news" | "event" | "highlight";
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
    const [projects, areas, notions, inbox, favorites, agenda, highlights, tasks, docs] = await Promise.all([
      listWithBody("project"), listWithBody("area"), readNotions(), readInbox(), readFavorites(), readAgenda(), readHighlights(),
      readTasks().then((t) => t.tasks).catch(() => []), listAllDocs().catch(() => []),
    ]);
    const projectTitle = new Map([...areas, ...projects].map((p) => [p.slug, p.title]));
    const entryHref = (slug: string) => (projects.some((p) => p.slug === slug) ? `/projets/${slug}` : areas.some((a) => a.slug === slug) ? `/domaines/${slug}` : null);
    // Notes du jour des projets et domaines : une entrée par jour avec du texte (premiers mots en titre).
    const notes = [...projects, ...areas].flatMap((e) => dayNotes(parseDoc(e.body)).filter((n) => n.text.trim()).map((n) => ({
      type: "note" as const, id: `${e.slug}:${n.date}`,
      title: n.text.replace(/[*_#>`[\]]/g, "").replace(/\s+/g, " ").trim().slice(0, 120),
      subtitle: `${longDate(n.date)} · ${e.title}`,
      href: e.kind === "project" ? `/projets/${e.slug}` : `/domaines/${e.slug}`,
    })));
    const items: SearchItem[] = [
      ...projects.map((p) => ({ type: "project" as const, id: p.slug, title: p.title, subtitle: [p.status, p.priority].filter(Boolean).join(" · "), href: `/projets/${p.slug}` })),
      ...areas.map((a) => ({ type: "area" as const, id: a.slug, title: a.title, href: `/domaines/${a.slug}` })),
      // Tâches à faire (toutes) et faites récemment (les 200 dernières lignes du fichier).
      ...tasks.filter((t) => t.status === "todo").concat(tasks.filter((t) => t.status !== "todo").slice(-200)).map((t) => ({
        type: "task" as const, id: t.id, title: t.title,
        subtitle: [t.date ? t.date + (t.time ? ` ${t.time}` : "") : "sans date", t.status === "done" ? "faite" : t.status === "dropped" ? "abandonnée" : "", t.project ? projectTitle.get(t.project) ?? `#${t.project}` : ""].filter(Boolean).join(" · "),
        // Tâche datée → onglet « aujourd'hui » ; sans date → page de son projet / domaine.
        href: (!t.date && t.project && entryHref(t.project)) || (t.status === "todo" ? `/projets/aujourdhui#task-${t.id}` : "/projets/aujourdhui?vue=historique"),
      })),
      ...notes,
      ...docs.map((d) => ({
        type: "doc" as const, id: `${d.project}/${d.slug}`, title: d.title, subtitle: projectTitle.get(d.project) ?? d.project, href: `/projets/${d.project}/docs/${d.slug}`,
      })),
      ...notions.notions.map((n) => ({
        type: "notion" as const, id: n.id, title: n.term, subtitle: n.definition ? n.definition.slice(0, 80) : "à compléter",
        href: n.definition ? `/notions#notion-${n.id}` : "/notions?onglet=gerer",
      })),
      ...inbox.items.filter((i) => !i.done).map((i) => ({ type: "inbox" as const, id: String(i.index), title: i.text, subtitle: i.date ?? undefined, href: "/revue" })),
      ...favorites.favorites.map((f) => ({
        type: "favorite" as const, id: f.id, title: f.title, subtitle: f.source || undefined,
        href: f.type === "article" || f.type === "newsletter" ? f.ref : "/favoris", external: f.type === "article" || f.type === "newsletter",
      })),
      ...agenda.events.filter((e) => !e.problem).map((e) => ({
        type: "event" as const, id: e.id, title: e.title,
        subtitle: [e.allDay ? e.start : e.start.replace(" ", " · "), e.repeat ? "chaque semaine" : "", e.location].filter(Boolean).join(" — "),
        href: `/?jour=${e.start.slice(0, 10)}`,
      })),
      ...highlights.highlights.map((h) => ({
        type: "highlight" as const, id: h.id, title: h.text.length > 120 ? `${h.text.slice(0, 120)}…` : h.text,
        subtitle: [h.note, `${h.subject} — ${h.from.replace(/\s*<[^>]*>\s*$/, "")}`].filter(Boolean).join(" · ").slice(0, 160),
        href: `/surlignages#${h.id}`,
      })),
      ...cachedNewsletters().map((m) => ({ type: "newsletter" as const, id: m.id, title: m.subject, subtitle: m.from, href: `/newsletters/${encodeURIComponent(m.id)}` })),
      ...dedupe([...cachedArticles()].sort(byDateDesc)).slice(0, 300).map((a) => ({ type: "news" as const, id: a.id, title: a.title, subtitle: a.publisher, href: a.link, external: true })),
    ];
    return NextResponse.json({ items });
  } catch (e) {
    return errorResponse(e);
  }
}
