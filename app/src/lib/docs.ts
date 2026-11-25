/**
 * Pages de documentation d'un projet ou d'un domaine : projects/<projet>/docs/<page>.md (ou
 * areas/<domaine>/docs/<page>.md, même fonctionnement) (frontmatter title, created,
 * updated, order + texte Markdown libre). Images : projects/<projet>/assets/ (5 Mo max, PNG/JPG/WebP/GIF).
 * Supprimer une page = la ranger dans docs/_archive/ (jamais d'effacement). Modèles :
 * projects/_template/docs-templates/*.md. Écritures par content-file.ts (version vérifiée, écriture atomique).
 */
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { UserError } from "./api";
import { CONTENT_DIR, isValidSlug } from "./content";
import { contentPath, readVersioned, updateFile } from "./content-file";
import { parseDoc, serializeDoc, setField } from "./markdown-doc";
import { detectSensitive } from "./secrets";
import { slugify } from "./slug";

export const TEMPLATES_DIR = "projects/_template/docs-templates";
export const MAX_ASSET_BYTES = 5 * 1024 * 1024;
export const ASSET_TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };

export interface DocMeta { slug: string; title: string; created: string | null; updated: string | null; order: number }
export interface DocPage extends DocMeta { project: string; body: string; version: string }
export interface DocTemplate { id: string; title: string; description: string }

/**
 * Dossier du projet, ou du domaine du même nom s'il n'y a pas de projet : les adresses
 * (/projets/<nom>/docs/…, /api/projects/<nom>/docs) servent aux deux.
 */
export function ownerDir(slug: string): string {
  if (!existsSync(/*turbopackIgnore: true*/ contentPath(`projects/${slug}/README.md`)) && existsSync(/*turbopackIgnore: true*/ contentPath(`areas/${slug}/README.md`))) return `areas/${slug}`;
  return `projects/${slug}`;
}
export const ownerKind = (slug: string): "project" | "area" => (ownerDir(slug).startsWith("areas/") ? "area" : "project");
const docsDir = (project: string) => `${ownerDir(project)}/docs`;
const docPath = (project: string, doc: string) => `${docsDir(project)}/${doc}.md`;

function assertNames(project: string, doc?: string) {
  if (!isValidSlug(project)) throw new UserError("Projet invalide.", 404);
  if (doc !== undefined && !isValidSlug(doc)) throw new UserError("Page invalide.", 404);
}

function checkText(...texts: string[]) {
  const reason = detectSensitive(texts.join("\n"));
  if (reason) throw new UserError(`Non enregistré : ${reason}. Ce fichier est publié sur GitHub.`);
}

/** Lit le frontmatter simple d'une page (clé: valeur), sans échouer. */
function parseMeta(text: string, slug: string): { meta: DocMeta; body: string } {
  const d = parseDoc(text);
  const meta: DocMeta = { slug, title: slug, created: null, updated: null, order: 0 };
  if (d.fm) {
    for (let i = d.fm.start + 1; i < d.fm.end; i++) {
      const m = d.lines[i].match(/^([a-z_]+)\s*:\s*(.*?)\s*$/i);
      if (!m) continue;
      let v = m[2].replace(/\s+#.*$/, "");
      if (/^".*"$/.test(v)) v = v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      else if (/^'.*'$/.test(v)) v = v.slice(1, -1).replace(/''/g, "'");
      if (m[1] === "title" && v) meta.title = v;
      if (m[1] === "created" && v) meta.created = v;
      if (m[1] === "updated" && v) meta.updated = v;
      if (m[1] === "order" && /^-?\d+$/.test(v)) meta.order = Number(v);
    }
  }
  const body = d.fm ? d.lines.slice(d.fm.end + 1).join("\n").replace(/^\n+/, "") : text;
  return { meta, body };
}

export async function listDocs(project: string): Promise<DocMeta[]> {
  assertNames(project);
  let files: string[];
  try {
    files = (await fs.readdir(/*turbopackIgnore: true*/ contentPath(docsDir(project)))).filter((f) => f.endsWith(".md") && isValidSlug(f.slice(0, -3)));
  } catch {
    return [];
  }
  const out: DocMeta[] = [];
  for (const f of files) {
    const cur = await readVersioned(`${docsDir(project)}/${f}`);
    out.push(parseMeta(cur.text, f.slice(0, -3)).meta);
  }
  return out.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "fr"));
}

/** Toutes les pages des projets en cours et des domaines (liens [[…]], palette, favoris). */
export async function listAllDocs(): Promise<(DocMeta & { project: string; kind: "project" | "area" })[]> {
  const dirs = async (root: string) =>
    fs.readdir(/*turbopackIgnore: true*/ path.join(CONTENT_DIR, root), { withFileTypes: true })
      .then((l) => l.filter((d) => d.isDirectory() && isValidSlug(d.name)).map((d) => d.name), () => [] as string[]);
  const projects = await dirs("projects");
  const areas = (await dirs("areas")).filter((a) => !projects.includes(a));
  const all = await Promise.all([
    ...projects.map(async (p) => (await listDocs(p)).map((d) => ({ ...d, project: p, kind: "project" as const }))),
    ...areas.map(async (p) => (await listDocs(p)).map((d) => ({ ...d, project: p, kind: "area" as const }))),
  ]);
  return all.flat();
}

export async function readDocPage(project: string, doc: string): Promise<DocPage | null> {
  assertNames(project, doc);
  const cur = await readVersioned(docPath(project, doc));
  if (!cur.exists) return null;
  const { meta, body } = parseMeta(cur.text, doc);
  return { ...meta, project, body, version: cur.version };
}

export async function listTemplates(): Promise<DocTemplate[]> {
  let files: string[];
  try {
    files = (await fs.readdir(/*turbopackIgnore: true*/ contentPath(TEMPLATES_DIR))).filter((f) => f.endsWith(".md")).sort();
  } catch {
    return [];
  }
  const out: DocTemplate[] = [];
  for (const f of files) {
    const text = (await readVersioned(`${TEMPLATES_DIR}/${f}`)).text;
    const { meta } = parseMeta(text, f.slice(0, -3));
    const description = text.match(/^description\s*:\s*"?(.*?)"?\s*$/m)?.[1] ?? "";
    out.push({ id: f.slice(0, -3), title: meta.title, description });
  }
  return out.sort((a, b) => (parseOrder(a.id) - parseOrder(b.id)) || a.title.localeCompare(b.title, "fr"));
}
const parseOrder = (id: string) => Number(id.match(/^(\d+)-/)?.[1] ?? 99);

/** « order: 3 » (nombre YAML, sans guillemets). */
function setOrder(d: ReturnType<typeof parseDoc>, n: number) {
  setField(d, "order", String(n));
  for (let i = d.fm!.start + 1; i < d.fm!.end; i++) d.lines[i] = d.lines[i].replace(/^order: "(\d+)"/, "order: $1");
}

function frontmatter(title: string, today: string, order: number): string[] {
  const d = parseDoc("---\n---\n");
  setField(d, "title", title);
  setField(d, "created", today);
  setField(d, "updated", today);
  setOrder(d, order);
  return d.lines.slice(0, d.fm!.end + 1);
}

/** Nouvelle page, vide ou à partir d'un modèle. Renvoie son nom de fichier (sans .md). */
export async function createDoc(project: string, title: string, templateId: string | null, today: string): Promise<string> {
  assertNames(project);
  const clean = title.replace(/\s+/g, " ").trim();
  if (!clean) throw new UserError("La page a besoin d'un titre.");
  if (clean.length > 120) throw new UserError("Titre trop long (120 caractères au plus).");
  checkText(clean);
  try {
    await fs.access(/*turbopackIgnore: true*/ contentPath(`${ownerDir(project)}/README.md`));
  } catch {
    throw new UserError("Projet introuvable.", 404);
  }
  let body = "";
  if (templateId) {
    if (!/^[a-z0-9-]+$/.test(templateId)) throw new UserError("Modèle inconnu.");
    const tpl = await readVersioned(`${TEMPLATES_DIR}/${templateId}.md`);
    if (!tpl.exists) throw new UserError("Modèle introuvable.");
    body = parseMeta(tpl.text, templateId).body;
  }
  const base = slugify(clean) || "page";
  const existing = await listDocs(project);
  const taken = async (n: string) => (await readVersioned(docPath(project, n))).exists || (await readVersioned(`${docsDir(project)}/_archive/${n}.md`)).exists;
  let slug = base;
  for (let n = 2; await taken(slug); n++) slug = `${base}-${n}`;
  const order = existing.reduce((m, d) => Math.max(m, d.order), 0) + 1;
  await updateFile(docPath(project, slug), "absent", () => ({ text: [...frontmatter(clean, today, order), "", body.trim(), ""].join("\n") }));
  return slug;
}

/** Modifie le titre (renommer : le nom de fichier ne change pas, les liens restent valides) et/ou le texte. */
export async function updateDoc(project: string, doc: string, version: string, patch: { title?: string; body?: string }, today: string) {
  assertNames(project, doc);
  if (patch.title !== undefined) {
    patch.title = patch.title.replace(/\s+/g, " ").trim();
    if (!patch.title) throw new UserError("La page a besoin d'un titre.");
    if (patch.title.length > 120) throw new UserError("Titre trop long (120 caractères au plus).");
  }
  if (patch.body !== undefined && patch.body.length > 200_000) throw new UserError("Texte trop long.");
  checkText(patch.title ?? "", patch.body ?? "");
  return updateFile(docPath(project, doc), version, (text, exists) => {
    if (!exists) throw new UserError("Cette page n'existe plus. Recharge.", 404);
    const d = parseDoc(text);
    if (patch.title !== undefined) setField(d, "title", patch.title);
    setField(d, "updated", today);
    const head = d.fm ? d.lines.slice(0, d.fm.end + 1) : [];
    const body = patch.body !== undefined ? patch.body.replace(/\r\n/g, "\n").trim() : parseMeta(text, doc).body.trim();
    const d2 = { lines: patch.body !== undefined ? [...head, "", body, ""] : d.lines, fm: d.fm };
    return { text: serializeDoc(d2) };
  });
}

/** Nouvel ordre des pages (liste complète des noms de fichiers). */
export async function reorderDocs(project: string, order: string[]) {
  assertNames(project);
  const current = (await listDocs(project)).map((d) => d.slug);
  if (order.length !== current.length || current.some((s) => !order.includes(s))) throw new UserError("La liste des pages a changé. Recharge.", 409);
  for (const [i, slug] of order.entries()) {
    await updateFile(docPath(project, slug), undefined, (text) => {
      const d = parseDoc(text);
      if (parseMeta(text, slug).meta.order === i + 1) return { text: null };
      setOrder(d, i + 1);
      return { text: serializeDoc(d) };
    });
  }
}

/** « Supprimer » : la page est rangée dans docs/_archive/ (jamais effacée). */
export async function archiveDoc(project: string, doc: string, version: string, today: string): Promise<string> {
  assertNames(project, doc);
  const cur = await readVersioned(docPath(project, doc));
  if (!cur.exists) throw new UserError("Cette page n'existe plus.", 404);
  if (cur.version !== version) throw new UserError("Cette page a été modifiée ailleurs entre-temps. Recharge.", 409);
  let name = doc;
  const exists = (n: string) => fs.access(/*turbopackIgnore: true*/ contentPath(`${docsDir(project)}/_archive/${n}.md`)).then(() => true, () => false);
  if (await exists(name)) name = `${doc}-${today}`;
  for (let n = 2; await exists(name); n++) name = `${doc}-${today}-${n}`;
  await fs.mkdir(/*turbopackIgnore: true*/ contentPath(`${docsDir(project)}/_archive`), { recursive: true });
  await fs.rename(/*turbopackIgnore: true*/ contentPath(docPath(project, doc)), contentPath(`${docsDir(project)}/_archive/${name}.md`));
  return `${docsDir(project)}/_archive/${name}.md`;
}

/** Journal de décisions : ajoute un bloc daté en tête de la section « ## Décisions » (ou en fin de page). */
export async function addDecision(project: string, doc: string, version: string, title: string, today: string) {
  const clean = title.replace(/\s+/g, " ").trim();
  if (!clean) throw new UserError("Donne un titre à la décision.");
  if (/^#/.test(clean)) throw new UserError("Titre invalide.");
  checkText(clean);
  return updateFile(docPath(project, doc), version, (text, exists) => {
    if (!exists) throw new UserError("Cette page n'existe plus. Recharge.", 404);
    const d = parseDoc(text);
    setField(d, "updated", today);
    const block = [`### ${today} — ${clean}`, "", "- **Contexte** : TODO: fill in", "- **Options envisagées** : TODO: fill in", "- **Décision** : TODO: fill in", "- **Conséquences** : TODO: fill in", ""];
    const h = d.lines.findIndex((l, i) => (!d.fm || i > d.fm.end) && /^##\s+Décisions\s*$/.test(l));
    if (h >= 0) {
      let at = h + 1;
      while (at < d.lines.length && !d.lines[at].trim()) at++;
      // Sauter un éventuel commentaire d'aide juste sous le titre.
      while (at < d.lines.length && /^<!--.*-->$/.test(d.lines[at].trim())) at++;
      while (at < d.lines.length && !d.lines[at].trim()) at++;
      d.lines.splice(at, 0, ...block);
    } else {
      while (d.lines.length && !d.lines[d.lines.length - 1].trim()) d.lines.pop();
      d.lines.push("", ...block);
    }
    return { text: serializeDoc(d) };
  });
}

/* ------------------------------------------------------------------ */
/* Images                                                               */
/* ------------------------------------------------------------------ */

/** Vérifie la signature du fichier (le type annoncé ne suffit pas). */
export function sniffImage(buf: Uint8Array): string | null {
  const b = (i: number) => buf[i];
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return "png";
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "jpg";
  if (b(0) === 0x47 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x38) return "gif";
  if (b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 && b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50) return "webp";
  return null;
}

/** Enregistre une image collée ou déposée ; renvoie son nom (à insérer en ../assets/<nom>). */
export async function saveAsset(project: string, originalName: string, buf: Uint8Array, now: Date): Promise<string> {
  assertNames(project);
  if (buf.byteLength === 0) throw new UserError("Image vide.");
  if (buf.byteLength > MAX_ASSET_BYTES) throw new UserError("Image trop lourde (5 Mo au plus).", 413);
  const ext = sniffImage(buf);
  if (!ext) throw new UserError("Format refusé : PNG, JPG, WebP ou GIF seulement.", 415);
  try {
    await fs.access(/*turbopackIgnore: true*/ contentPath(`${ownerDir(project)}/README.md`));
  } catch {
    throw new UserError("Projet introuvable.", 404);
  }
  const stamp = now.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  const base = slugify(originalName.replace(/\.[a-z0-9]+$/i, "")).slice(0, 40) || "image";
  const dir = contentPath(`${ownerDir(project)}/assets`);
  await fs.mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
  let name = `${stamp}-${base}.${ext}`;
  for (let n = 2; await fs.access(/*turbopackIgnore: true*/ path.join(dir, name)).then(() => true, () => false); n++) name = `${stamp}-${base}-${n}.${ext}`;
  const tmp = path.join(dir, `.${name}.${process.pid}.tmp`);
  await fs.writeFile(/*turbopackIgnore: true*/ tmp, buf, { flag: "wx" });
  await fs.rename(/*turbopackIgnore: true*/ tmp, path.join(dir, name));
  return name;
}

/** Lit une image d'un projet (pour l'affichage) ; null si absente ou nom invalide. */
export async function readAsset(project: string, name: string): Promise<{ data: Buffer; type: string } | null> {
  if (!isValidSlug(project) || !/^[a-z0-9][a-z0-9._-]{0,120}$/i.test(name) || name.includes("..")) return null;
  const ext = name.split(".").pop()!.toLowerCase();
  const type = ASSET_TYPES[ext];
  if (!type) return null;
  try {
    return { data: await fs.readFile(/*turbopackIgnore: true*/ contentPath(`${ownerDir(project)}/assets/${name}`)), type };
  } catch {
    return null;
  }
}
