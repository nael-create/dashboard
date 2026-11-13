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
/* Listes : prochaines actions (cases à cocher) et journal              */
/* ------------------------------------------------------------------ */

export interface ListItem { line: number; text: string; done: boolean }

const CHECK = /^(\s*[-*]\s+)\[([ xX])\]\s+(.*)$/;

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

const isPlaceholder = (t: string) => t.trim() === "TODO: fill in";

function ensureSection(d: Doc, name: string): Section {
  if (!findSection(d, name)) setSectionText(d, name, "");
  return findSection(d, name)!;
}

export function addAction(d: Doc, text: string) {
  // La première vraie action remplace le marqueur « TODO: fill in ».
  for (const a of actions(d).reverse()) if (isPlaceholder(a.text)) d.lines.splice(a.line, 1);
  const list = actions(d);
  if (list.length) {
    d.lines.splice(list[list.length - 1].line + 1, 0, `- [ ] ${text}`);
    return;
  }
  // Liste vide : l'action se place en tête de section, le reste (commentaires…) est conservé.
  const s = ensureSection(d, "Prochaines actions");
  const rest = trimBlank(d.lines.slice(s.start, s.end));
  d.lines.splice(s.start, s.end - s.start, "", `- [ ] ${text}`, ...(rest.length ? ["", ...rest] : []), "");
}

function trimBlank(lines: string[]): string[] {
  const out = [...lines];
  while (out.length && !out[0].trim()) out.shift();
  while (out.length && !out[out.length - 1].trim()) out.pop();
  return out;
}

function itemAt(d: Doc, index: number, expected: string): ListItem {
  const item = actions(d)[index];
  if (!item || item.text !== expected) throw new Error("Cette action a changé entre-temps. Recharge la page.");
  return item;
}

export function editAction(d: Doc, index: number, expected: string, text: string) {
  const item = itemAt(d, index, expected);
  d.lines[item.line] = d.lines[item.line].replace(CHECK, (_m, pre, box) => `${pre}[${box}] ${text}`);
}

export function moveAction(d: Doc, index: number, expected: string, dir: -1 | 1) {
  const list = actions(d);
  const item = itemAt(d, index, expected);
  const other = list[index + dir];
  if (!other) return;
  [d.lines[item.line], d.lines[other.line]] = [d.lines[other.line], d.lines[item.line]];
}

/** Ajoute « - YYYY-MM-DD — texte » en HAUT du journal (ordre antichronologique). */
export function addJournal(d: Doc, date: string, text: string) {
  const s = ensureSection(d, "Journal");
  let firstItem = -1;
  for (let i = s.start; i < s.end; i++) {
    if (/^\s*[-*]\s+/.test(d.lines[i])) {
      firstItem = i;
      break;
    }
  }
  const entry = `- ${date} — ${text}`;
  if (firstItem >= 0) {
    d.lines.splice(firstItem, 0, entry);
    return;
  }
  // Pas encore d'entrée : après les éventuels commentaires / paragraphes de la section.
  const rest = trimBlank(d.lines.slice(s.start, s.end));
  d.lines.splice(s.start, s.end - s.start, "", ...(rest.length ? [...rest, ""] : []), entry, "");
}

/** Coche une action : elle quitte « Prochaines actions » et devient « YYYY-MM-DD — Fait : … » dans le journal. */
export function checkAction(d: Doc, index: number, expected: string, date: string) {
  const item = itemAt(d, index, expected);
  d.lines.splice(item.line, 1);
  addJournal(d, date, `Fait : ${item.text}`);
}

/** Entrées du journal (« - YYYY-MM-DD — texte »). */
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
