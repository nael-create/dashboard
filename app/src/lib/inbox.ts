/**
 * INBOX.md — liste datée de cases à cocher sous « ## Éléments » (voir CLAUDE.md, section 6).
 * Traité = coché `- [x]` ; « Supprimer » retire la ligne. L'exemple (section « Exemple ») n'est jamais touché.
 */
import { UserError } from "./api";
import { joinLines, readVersioned, splitLines, updateFile } from "./content-file";
import { regenerateDashboard } from "./dashboard-md";
import { detectSensitive } from "./secrets";

export const INBOX_FILE = "INBOX.md";
const SECTION = "## Éléments";
const ITEM = /^(\s*[-*]\s+)\[([ xX])\]\s+(?:(\d{4}-\d{2}-\d{2})\s+[—–-]\s+)?(.*)$/;

export interface InboxItem { index: number; line: number; done: boolean; date: string | null; text: string; raw: string }

export function parseInbox(text: string): InboxItem[] {
  const lines = splitLines(text);
  const start = lines.findIndex((l) => l.trim() === SECTION);
  if (start === -1) return [];
  const out: InboxItem[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{1,2}\s/.test(lines[i])) break;
    const m = lines[i].match(ITEM);
    if (m) out.push({ index: out.length, line: i, done: m[2] !== " ", date: m[3] ?? null, text: m[4].trim(), raw: lines[i] });
  }
  return out;
}

export async function readInbox() {
  const { text, version } = await readVersioned(INBOX_FILE);
  return { items: parseInbox(text), version };
}

function locate(text: string, index: number, raw: string) {
  const item = parseInbox(text)[index];
  if (!item || item.raw !== raw) throw new UserError("Cet élément de l'inbox a changé entre-temps. Recharge la page.", 409);
  return item;
}

/** Coche un élément (traité). */
export async function markInboxDone(index: number, raw: string) {
  await updateFile(INBOX_FILE, undefined, (text) => {
    const lines = splitLines(text);
    const item = locate(text, index, raw);
    lines[item.line] = lines[item.line].replace(/\[ \]/, "[x]");
    return { text: joinLines(lines) };
  });
  await regenerateDashboard();
}

/** Retire la ligne (« Supprimer »). */
export async function removeInboxItem(index: number, raw: string) {
  await updateFile(INBOX_FILE, undefined, (text) => {
    const lines = splitLines(text);
    const item = locate(text, index, raw);
    lines.splice(item.line, 1);
    return { text: joinLines(lines) };
  });
  await regenerateDashboard();
}

/** Ajoute « - [ ] YYYY-MM-DD — texte » en fin de section (ajout seul : rien d'autre n'est réécrit). */
export async function addInboxItem(textIn: string, date: string) {
  const t = textIn.replace(/\s+/g, " ").trim();
  if (!t) throw new UserError("Le texte est vide.");
  if (t.length > 500) throw new UserError("Texte trop long (500 caractères max).");
  const reason = detectSensitive(t);
  if (reason) throw new UserError(`Non enregistré : ${reason}. INBOX.md est publié sur GitHub.`);
  await updateFile(INBOX_FILE, undefined, (text, exists) => {
    const lines = exists ? splitLines(text) : ["# Inbox", ""];
    let start = lines.findIndex((l) => l.trim() === SECTION);
    if (start === -1) {
      while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
      lines.push("", SECTION, "");
      start = lines.length - 2;
    }
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) if (/^#{1,2}\s/.test(lines[i])) { end = i; break; }
    let at = end;
    while (at > start + 1 && !lines[at - 1].trim()) at--;
    const entry = `- [ ] ${date} — ${t}`;
    if (at === start + 1) lines.splice(at, 0, "", entry);
    else lines.splice(at, 0, entry);
    return { text: joinLines(lines) };
  });
  await regenerateDashboard();
}
