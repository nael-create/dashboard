/**
 * Revue hebdomadaire guidée : semaine ISO (fuseau d'affichage), pré-remplissage depuis les journaux,
 * traitement de l'inbox, focus, puis génération de reviews/YYYY-Www.md à partir de reviews/_template.md.
 */
import fs from "node:fs/promises";
import path from "node:path";
import config from "@config";
import { UserError } from "./api";
import { CONTENT_DIR, isValidSlug, listProjects } from "./content";
import { readVersioned, updateFile } from "./content-file";
import { regenerateDashboard } from "./dashboard-md";
import { todayISO } from "./dates";
import { readTasks } from "./tasks";
import type { Task } from "./tasks-core";
import { entryTasks } from "./tasks-view";
import { findSection, fmField, parseDoc, sectionText, serializeDoc, setSectionText } from "./markdown-doc";
import { detectSensitive } from "./secrets";
import { addDays } from "./tz";

/* ------------------------------------------------------------------ */
/* Semaine ISO 8601                                                     */
/* ------------------------------------------------------------------ */

export interface IsoWeek { year: number; week: number; label: string; monday: string; sunday: string }

/** Semaine ISO d'une date « YYYY-MM-DD » (lundi → dimanche ; la semaine 1 contient le premier jeudi). */
export function isoWeek(date: string): IsoWeek {
  const [y, m, d] = date.split("-").map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // lundi = 0
  const thursday = new Date(Date.UTC(y, m - 1, d - dow + 3)); // le jeudi de cette semaine fixe l'année ISO
  const year = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week1Thursday = new Date(Date.UTC(year, 0, 4 - ((jan4.getUTCDay() + 6) % 7) + 3));
  const week = 1 + Math.round((thursday.getTime() - week1Thursday.getTime()) / (7 * 86_400_000));
  const monday = addDays(date, -dow);
  return { year, week, label: `${year}-W${String(week).padStart(2, "0")}`, monday, sunday: addDays(monday, 6) };
}

export const reviewFile = (label: string) => `reviews/${label}.md`;

/** Lundi = 0 … dimanche = 6. */
const weekday = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;

/** Lien discret sur l'accueil : à partir du jour de revue et tant qu'aucune revue n'existe pour la semaine. */
export async function shouldShowReviewLink(today = todayISO()): Promise<boolean> {
  const reviewDay = (((config.reviewDay % 7) + 7) % 7 + 6) % 7; // 0 = dimanche (JS) → 6 (lundi = 0)
  if (weekday(today) < reviewDay) return false;
  return !(await readVersioned(reviewFile(isoWeek(today).label))).exists;
}

/* ------------------------------------------------------------------ */
/* Données de départ                                                    */
/* ------------------------------------------------------------------ */

async function readmes(dir: "projects" | "archive" | "areas") {
  const base = path.join(/*turbopackIgnore: true*/ CONTENT_DIR, dir);
  let names: string[] = [];
  try {
    names = (await fs.readdir(/*turbopackIgnore: true*/ base, { withFileTypes: true })).filter((d) => d.isDirectory() && isValidSlug(d.name)).map((d) => d.name);
  } catch {
    return [];
  }
  const out: { slug: string; text: string }[] = [];
  for (const slug of names) {
    const { text, exists } = await readVersioned(`${dir}/${slug}/README.md`);
    if (exists) out.push({ slug, text });
  }
  return out;
}

const titleOf = (text: string, slug: string) => {
  const t = fmField(text, "title") ?? "";
  return t && t !== "TODO: fill in" ? t : slug;
};

/**
 * « Fait cette semaine » : tâches faites cette semaine (TACHES.md), précédées du nom de leur projet ou
 * domaine (actif ou archivé). Les notes du jour restent dans les projets (elles ne sont pas recopiées).
 */
export async function prefillDone(week: IsoWeek): Promise<string[]> {
  const titles = new Map<string, string>();
  for (const dir of ["projects", "archive", "areas"] as const) {
    for (const { slug, text } of await readmes(dir)) if (!titles.has(slug)) titles.set(slug, titleOf(text, slug));
  }
  const { tasks } = await readTasks().catch(() => ({ tasks: [] as Task[] }));
  return tasks
    .filter((t) => t.status === "done" && t.closedOn && t.closedOn >= week.monday && t.closedOn <= week.sunday)
    .sort((a, b) => a.closedOn!.localeCompare(b.closedOn!) || a.line - b.line)
    .map((t) => (t.project ? `${titles.get(t.project) ?? t.project} : ${t.title}` : t.title));
}

/** Choix du focus : tâches ouvertes des projets actifs (dans l'ordre du projet : en retard, datées, sans date). */
export async function focusOptions(): Promise<{ slug: string; project: string; text: string }[]> {
  const active = (await listProjects()).filter((p) => p.status === "active");
  const { tasks } = await readTasks().catch(() => ({ tasks: [] as Task[] }));
  const today = todayISO();
  const out: { slug: string; project: string; text: string }[] = [];
  for (const p of active) for (const t of entryTasks(tasks, p.slug, today).open) out.push({ slug: p.slug, project: p.title, text: t.title });
  return out;
}

export interface ReviewContent { done: string[]; blocked: string; inbox: string[]; focus: string[] }

const listOf = (s: string | null) =>
  (s ?? "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .split("\n")
    .map((l) => l.match(/^\s*(?:[-*]|\d+[.)])\s+(.*)$/)?.[1]?.trim() ?? "")
    .filter((t) => t && t !== "TODO: fill in");

/** Contenu d'une revue existante (pour la modifier plutôt que l'écraser). */
export async function readReview(label: string): Promise<(ReviewContent & { version: string }) | null> {
  const cur = await readVersioned(reviewFile(label));
  if (!cur.exists) return null;
  const d = parseDoc(cur.text);
  const blockedRaw = (sectionText(d, "Bloqué") ?? "").replace(/<!--[\s\S]*?-->/g, "").trim();
  const blockedItems = listOf(blockedRaw);
  return {
    version: cur.version,
    done: listOf(sectionText(d, "Fait cette semaine")),
    blocked: blockedRaw === "- TODO: fill in" || blockedRaw === "TODO: fill in" ? "" : blockedItems.length ? blockedItems.join("\n") : blockedRaw,
    inbox: listOf(sectionText(d, "Inbox traitée")),
    focus: listOf(sectionText(d, "Focus semaine prochaine")).slice(0, 3),
  };
}

/* ------------------------------------------------------------------ */
/* Génération du fichier                                                */
/* ------------------------------------------------------------------ */

const bullets = (items: string[]) => (items.length ? items.map((t) => `- ${t}`).join("\n") : "- TODO: fill in");
const FOCUS_COMMENT = "<!-- 3 éléments maximum : ils alimentent « Focus de la semaine » dans DASHBOARD.md. -->";

function clean(c: ReviewContent): ReviewContent {
  const line = (t: string) => t.replace(/\s+/g, " ").trim();
  const out = {
    done: c.done.map(line).filter(Boolean),
    blocked: c.blocked.replace(/\r\n/g, "\n").trim(),
    inbox: c.inbox.map(line).filter(Boolean),
    focus: c.focus.map(line).filter(Boolean).slice(0, 3),
  };
  const all = [...out.done, out.blocked, ...out.inbox, ...out.focus].join("\n");
  if (/^#{1,2}\s/m.test(out.blocked)) throw new UserError("« Bloqué » ne peut pas contenir de titres « # » ou « ## ».");
  const reason = detectSensitive(all);
  if (reason) throw new UserError(`Non enregistré : ${reason}. Les revues sont publiées sur GitHub.`);
  return out;
}

function fill(text: string, c: ReviewContent, label: string, today: string): string {
  const d = parseDoc(text);
  const h1 = d.lines.findIndex((l) => /^#\s/.test(l));
  if (h1 >= 0) d.lines[h1] = d.lines[h1].replace(/YYYY-Www/, label);
  // Commentaire du template remplacé par la date de la revue.
  const comment = d.lines.findIndex((l) => /^<!--.*Copier ce fichier/.test(l));
  if (comment >= 0) d.lines[comment] = `<!-- Revue du ${today}, faite depuis le dashboard. -->`;
  setSectionText(d, "Fait cette semaine", bullets(c.done));
  const blocked = c.blocked.trim();
  setSectionText(d, "Bloqué", !blocked ? "- TODO: fill in" : /^\s*[-*]\s/m.test(blocked) ? blocked : blocked.split("\n").map((l) => (l.trim() ? `- ${l.trim()}` : "")).filter(Boolean).join("\n"));
  setSectionText(d, "Inbox traitée", bullets(c.inbox));
  setSectionText(d, "Focus semaine prochaine", `${FOCUS_COMMENT}\n\n${c.focus.length ? c.focus.map((t, i) => `${i + 1}. ${t}`).join("\n") : "1. TODO: fill in"}`);
  return serializeDoc(d);
}

/**
 * Crée la revue de la semaine (refus si elle existe déjà : il faut alors passer par « modifier »),
 * ou met à jour ses sections (mode « update », avec la version lue).
 */
export async function saveReview(label: string, content: ReviewContent, mode: "create" | "update", version?: string) {
  if (!/^\d{4}-W\d{2}$/.test(label)) throw new UserError("Semaine invalide.");
  const c = clean(content);
  const today = todayISO();
  if (mode === "create") {
    const tpl = await readVersioned("reviews/_template.md");
    if (!tpl.exists) throw new UserError("reviews/_template.md est introuvable.");
    await updateFile(reviewFile(label), undefined, (_t, exists) => {
      if (exists) throw new UserError("Une revue existe déjà pour cette semaine : modifie-la plutôt.", 409);
      return { text: fill(tpl.text, c, label, today) };
    });
  } else {
    if (!version) throw new UserError("Version manquante.");
    await updateFile(reviewFile(label), version, (text, exists) => {
      if (!exists) throw new UserError("Cette revue n'existe plus.", 404);
      const d = parseDoc(text);
      for (const s of ["Fait cette semaine", "Bloqué", "Inbox traitée", "Focus semaine prochaine"]) {
        if (!findSection(d, s)) setSectionText(d, s, "");
      }
      return { text: fill(serializeDoc(d), c, label, today) };
    });
  }
  await regenerateDashboard();
  return { path: reviewFile(label), focus: c.focus };
}
