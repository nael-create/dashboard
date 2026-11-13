import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { listProjects } from "@/lib/content";
import { todayISO } from "@/lib/dates";
import { readInbox } from "@/lib/inbox";
import { focusOptions, isoWeek, prefillDone, readReview } from "@/lib/review";

export const dynamic = "force-dynamic";

/** Tout ce qu'il faut pour la revue de la semaine en cours (fuseau d'affichage). */
export async function GET() {
  try {
    const today = todayISO();
    const week = isoWeek(today);
    const [existing, done, inbox, projects, focus] = await Promise.all([
      readReview(week.label), prefillDone(week), readInbox(), listProjects(), focusOptions(),
    ]);
    return NextResponse.json({
      today,
      week,
      existing,
      prefill: { done },
      inbox: inbox.items.filter((i) => !i.done),
      projects: projects.filter((p) => p.status === "active" || p.status === "idea" || p.status === "paused").map((p) => ({ slug: p.slug, title: p.title, status: p.status })),
      focusOptions: focus,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
