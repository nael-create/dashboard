/**
 * Liens internes [[…]] des pages de docs, sommaire automatique (fonctions pures, testées).
 *
 *   [[brief]]                → page « brief » du même projet (nom de fichier ou titre)
 *   [[medtech]]              → projet « medtech » (s'il n'y a pas de page de ce nom)
 *   [[medtech/specs]]        → page « specs » du projet « medtech »
 *   [[brief|le brief]]       → texte affiché différent
 * Un lien qui ne mène nulle part reste visible, barré en pointillés (« #lien-casse »), sans erreur.
 */
import { fold, slugify } from "./slug";

export interface LinkContext {
  project: string;
  projects: { slug: string; title: string }[];
  docs: { project: string; slug: string; title: string }[];
}

export const BROKEN_HREF = "#lien-casse";

const same = (a: string, b: string) => fold(a).trim() === fold(b).trim();

export function resolveWikiLink(target: string, ctx: LinkContext): { href: string; label: string } | null {
  const t = target.trim();
  if (!t) return null;
  const findDoc = (project: string, name: string) =>
    ctx.docs.find((d) => d.project === project && (d.slug === name || d.slug === slugify(name) || same(d.title, name)));
  const slash = t.indexOf("/");
  if (slash > 0) {
    const p = ctx.projects.find((x) => x.slug === t.slice(0, slash) || same(x.title, t.slice(0, slash)));
    const d = p && findDoc(p.slug, t.slice(slash + 1));
    return d ? { href: `/projets/${d.project}/docs/${d.slug}`, label: d.title } : null;
  }
  const d = findDoc(ctx.project, t);
  if (d) return { href: `/projets/${d.project}/docs/${d.slug}`, label: d.title };
  const p = ctx.projects.find((x) => x.slug === t || x.slug === slugify(t) || same(x.title, t));
  return p ? { href: `/projets/${p.slug}`, label: p.title } : null;
}

/** Applique `fn` au texte hors blocs de code (``` … ```) et hors code en ligne (`…`). */
function outsideCode(md: string, fn: (s: string) => string): string {
  const parts = md.split(/(```[\s\S]*?(?:```|$))/g);
  return parts
    .map((part, i) => (i % 2 === 1 ? part : part.split(/(`[^`\n]*`)/g).map((p, j) => (j % 2 === 1 ? p : fn(p))).join("")))
    .join("");
}

const escapeLabel = (s: string) => s.replace(/([[\]\\])/g, "\\$1");

/** Remplace les [[liens]] par des liens Markdown (les liens cassés pointent vers #lien-casse). */
export function linkify(md: string, ctx: LinkContext): string {
  return outsideCode(md, (s) =>
    s.replace(/\[\[([^\]\n|]+)(?:\|([^\]\n]+))?\]\]/g, (_m, target: string, label?: string) => {
      const r = resolveWikiLink(target, ctx);
      const text = escapeLabel((label ?? r?.label ?? target).trim());
      return r ? `[${text}](${r.href})` : `[${text}](${BROKEN_HREF})`;
    }),
  );
}

/** Pages et projets proposés après « [[ » (autocomplétion). */
export function wikiSuggestions(query: string, ctx: LinkContext, limit = 8): { insert: string; label: string; hint: string }[] {
  const q = fold(query);
  const docs = ctx.docs
    .filter((d) => fold(d.title).includes(q) || d.slug.includes(q))
    .sort((a, b) => Number(b.project === ctx.project) - Number(a.project === ctx.project))
    .map((d) => ({ insert: d.project === ctx.project ? d.slug : `${d.project}/${d.slug}`, label: d.title, hint: d.project === ctx.project ? "page" : `page · ${d.project}` }));
  const projects = ctx.projects
    .filter((p) => fold(p.title).includes(q) || p.slug.includes(q))
    .map((p) => ({ insert: p.slug, label: p.title, hint: "projet" }));
  return [...docs, ...projects].slice(0, limit);
}

/** Titres ## et ### (hors code) avec un identifiant d'ancre unique, pour le sommaire. */
export function headings(md: string): { level: 2 | 3; text: string; id: string; line: number }[] {
  const out: { level: 2 | 3; text: string; id: string; line: number }[] = [];
  const seen = new Map<string, number>();
  let fence = false;
  for (const [n, line] of md.split("\n").entries()) {
    if (/^\s*```/.test(line)) fence = !fence;
    if (fence) continue;
    const m = line.match(/^(#{2,3})\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    const text = m[2].replace(/[*_`]/g, "").trim();
    out.push({ level: m[1].length as 2 | 3, text, id: headingId(text, seen), line: n + 1 });
  }
  return out;
}

/** Identifiant d'ancre : « Ce qui a marché » → « ce-qui-a-marche » (suffixe -2, -3 si répété). */
export function headingId(text: string, seen: Map<string, number>): string {
  const base = slugify(text) || "section";
  const n = (seen.get(base) ?? 0) + 1;
  seen.set(base, n);
  return n === 1 ? base : `${base}-${n}`;
}
