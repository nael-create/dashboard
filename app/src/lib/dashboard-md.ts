/**
 * Régénère DASHBOARD.md selon CLAUDE.md (section 7) : uniquement des informations dérivées
 * du frontmatter des projets / domaines, de la dernière revue et d'INBOX.md.
 */
import { countInbox, getWeeklyFocus, listAreas, listProjects, sortEntries } from "./content";
import { updateFile } from "./content-file";
import { todayISO } from "./dates";

const cell = (s: string | null) => (s ?? "—").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim() || "—";
const link = (title: string, href: string) => `[${title.replace(/[[\]]/g, "")}](${href})`;

export async function renderDashboard(): Promise<string> {
  const [projects, areas, focus, inbox] = await Promise.all([listProjects(), listAreas(), getWeeklyFocus(), countInbox()]);
  const active = sortEntries(projects.filter((p) => p.status === "active"));
  const parked = projects.filter((p) => p.status === "paused" || p.status === "idea");

  const lines = [
    "# Dashboard",
    "",
    "<!-- Fichier généré à partir du frontmatter des projets/domaines, des revues et de INBOX.md. Ne pas éditer à la main. -->",
    `Dernière mise à jour : ${todayISO()}`,
    "",
    "## Focus de la semaine",
    "",
    ...(focus.items.length ? focus.items.map((f, i) => `${i + 1}. ${f}`) : ["TODO: fill in"]),
    "",
    "## Projets actifs",
    "",
    "| Projet | Priorité | Statut | Prochaine action | Deadline |",
    "|--------|----------|--------|------------------|----------|",
    ...active.map((p) => `| ${link(p.title, `projects/${p.slug}/README.md`)} | ${cell(p.priority)} | ${cell(p.status)} | ${cell(p.nextAction)} | ${cell(p.deadline)} |`),
    ...(active.length ? [] : ["", "_Aucun projet actif._"]),
    "",
    "## En pause / idées",
    "",
    ...(parked.length
      ? parked.map((p) => `- ${link(p.title, `projects/${p.slug}/README.md`)} — ${p.status === "paused" ? "en pause" : "idée"}`)
      : ["_Aucun._"]),
    "",
    "## Domaines",
    "",
    ...(areas.length ? areas.map((a) => `- ${link(a.title, `areas/${a.slug}/README.md`)}`) : ["_Aucun domaine._"]),
    "",
    "## Inbox",
    "",
    `${inbox} élément(s) non traité(s) — voir [INBOX.md](INBOX.md)`,
  ];
  return lines.join("\n") + "\n";
}

/** Réécrit DASHBOARD.md (fichier entièrement dérivé : pas de version à vérifier). */
export async function regenerateDashboard() {
  const text = await renderDashboard();
  await updateFile("DASHBOARD.md", undefined, () => ({ text }));
}
