/**
 * Modifications ligne par ligne d'un README de projet ou de domaine.
 * Principe : on ne remplace QUE les lignes concernées ; commentaires, mise en page et sections
 * inconnues sont conservés tels quels, pour que le fichier reste agréable à éditer à la main.
 */

export interface Doc {
  lines: string[];
  /** Index des lignes « --- » ouvrante et fermante du frontmatter (ou null). */
  fm: { start: number; end: number } | null;
}

export function parseDoc(text: string): Doc {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let fm: Doc["fm"] = null;
  if (lines[0]?.trim() === "---") {
    const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
    if (end > 0) fm = { start: 0, end };
  }
  return { lines, fm };
}

export const serializeDoc = (d: Doc) => {
  const out = d.lines.join("\n");
  return out.endsWith("\n") ? out : out + "\n";
};

/* ------------------------------------------------------------------ */
/* Frontmatter                                                          */
/* ------------------------------------------------------------------ */

/**
 * Valeur d'une ligne de frontmatter « clé: valeur   # commentaire » (lecture simple, sans YAML complet) :
 * guillemets retirés, commentaire « # » (précédé d'un espace, ou seul) ignoré. « deadline:   # optionnel » → "".
 */
export function fmValue(rest: string): string {
  const t = rest.trim();
  const q = t.match(/^"((?:[^"\\]|\\.)*)"/);
  if (q) return q[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  const sq = t.match(/^'((?:[^']|'')*)'/);
  if (sq) return sq[1].replace(/''/g, "'");
  return t.replace(/(?:^|\s)#.*$/, "").trim();
}

/** Champ du frontmatter (null s'il est absent). */
export function fmField(text: string, key: string): string | null {
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return null;
  const m = fm[1].match(new RegExp(`^${key}[ \\t]*:(.*)$`, "m"));
  return m ? fmValue(m[1]) : null;
}

/** Met une valeur YAML entre guillemets quand c'est nécessaire (ex. « TODO: fill in » contient « : »). */
export function yamlValue(v: string): string {
  if (v === "") return "";
  const needsQuotes =
    /: |:$| #|^[\s#&*!|>'"%@`?,[\]{}]|^-(\s|$)|\s$/.test(v) ||
    /^(yes|no|true|false|null|on|off|~)$/i.test(v) ||
    (/^[\d.+-]+$/.test(v) && !/^\d{4}-\d{2}-\d{2}$/.test(v));
  return needsQuotes ? `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"` : v;
}

/** Remplace (ou ajoute) `key: valeur` dans le frontmatter, en gardant un éventuel commentaire de fin de ligne. */
export function setField(d: Doc, key: string, value: string) {
  if (!d.fm) {
    d.lines.unshift("---", "---");
    d.fm = { start: 0, end: 1 };
  }
  const re = new RegExp(`^(${key})\\s*:(.*)$`);
  for (let i = d.fm.start + 1; i < d.fm.end; i++) {
    const m = d.lines[i].match(re);
    if (!m) continue;
    // Commentaire « # … » précédé d'espaces (hors guillemets) : conservé, et aligné si possible.
    const comment = m[2].match(/^(?:[^"'#]|"[^"]*"|'[^']*')*?\s+(#.*)$/)?.[1] ?? "";
    const v = yamlValue(value);
    const head = `${key}:${v ? ` ${v}` : ""}`;
    if (comment) {
      const hashCol = d.lines[i].lastIndexOf(comment);
      d.lines[i] = head.length < hashCol ? head.padEnd(hashCol) + comment : `${head}  ${comment}`;
    } else {
      d.lines[i] = head;
    }
    return;
  }
  d.lines.splice(d.fm.end, 0, `${key}:${value ? ` ${yamlValue(value)}` : ""}`);
  d.fm.end++;
}

/* ------------------------------------------------------------------ */
/* Sections « ## Titre »                                                */
/* ------------------------------------------------------------------ */

export interface Section { heading: number; start: number; end: number }

/** Lignes [start, end) du contenu d'une section (sans le titre), ou null. */
export function findSection(d: Doc, name: string): Section | null {
  const from = d.fm ? d.fm.end + 1 : 0;
  const h = d.lines.findIndex((l, i) => i >= from && l.trim() === `## ${name}`);
  if (h === -1) return null;
  let end = d.lines.length;
  for (let i = h + 1; i < d.lines.length; i++) {
    if (/^#{1,2}\s/.test(d.lines[i])) {
      end = i;
      break;
    }
  }
  return { heading: h, start: h + 1, end };
}

/** Texte d'une section, sans les lignes vides de début et de fin. */
export function sectionText(d: Doc, name: string): string | null {
  const s = findSection(d, name);
  if (!s) return null;
  const body = d.lines.slice(s.start, s.end);
  while (body.length && !body[0].trim()) body.shift();
  while (body.length && !body[body.length - 1].trim()) body.pop();
  return body.join("\n");
}

/** Remplace le contenu d'une section (ajoutée en fin de document si absente). */
export function setSectionText(d: Doc, name: string, text: string) {
  const body = text.replace(/\r\n/g, "\n").trim();
  const block = ["", ...(body ? body.split("\n") : []), ""];
  const s = findSection(d, name);
  if (!s) {
    while (d.lines.length && !d.lines[d.lines.length - 1].trim()) d.lines.pop();
    d.lines.push("", `## ${name}`, ...block);
    return;
  }
  d.lines.splice(s.start, s.end - s.start, ...block);
}

/* ------------------------------------------------------------------ */
/* Ancien format (lecture seule, pour la migration) : prochaines        */
/* actions, journal, jalons                                             */
/* ------------------------------------------------------------------ */

export interface ListItem { line: number; text: string; done: boolean }

const CHECK = /^(\s*[-*]\s+)\[([ xX])\]\s+(.*)$/;

/** Cases à cocher de « ## Prochaines actions » (ancien format). */
export function actions(d: Doc, section = "Prochaines actions"): ListItem[] {
  const s = findSection(d, section);
  if (!s) return [];
  const out: ListItem[] = [];
  for (let i = s.start; i < s.end; i++) {
    const m = d.lines[i].match(CHECK);
    if (m) out.push({ line: i, text: m[3].trim(), done: m[2] !== " " });
  }
  return out;
}

/** Entrées de « ## Journal » (« - YYYY-MM-DD — texte », ancien format). */
export function journal(d: Doc): { date: string; text: string }[] {
  const s = findSection(d, "Journal");
  if (!s) return [];
  const out: { date: string; text: string }[] = [];
  for (let i = s.start; i < s.end; i++) {
    const m = d.lines[i].match(/^\s*[-*]\s+(\d{4}-\d{2}-\d{2})\s+[—–-]\s+(.*)$/);
    if (m) out.push({ date: m[1], text: m[2].trim() });
  }
  return out;
}

/** Jalon de « ## Jalons » : « - [ ] YYYY-MM-DD — Titre » ([x] = atteint ; ancien format). */
export interface Milestone { line: number; index: number; date: string; text: string; done: boolean }

const MILESTONE = /^(\s*[-*]\s+)\[([ xX])\]\s+(\d{4}-\d{2}-\d{2})\s+[—–-]\s+(.*)$/;

export function milestones(d: Doc): Milestone[] {
  const s = findSection(d, "Jalons");
  if (!s) return [];
  const out: Milestone[] = [];
  for (let i = s.start; i < s.end; i++) {
    const m = d.lines[i].match(MILESTONE);
    if (m) out.push({ line: i, index: out.length, date: m[3], text: m[4].trim(), done: m[2] !== " " });
  }
  return out;
}
