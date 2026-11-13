/**
 * AGENDA.md — calendrier « Perso » : événements créés depuis le dashboard (ou à la main).
 *
 *   ## Réglages
 *   name: Perso
 *   color: #a3451f
 *
 *   ## 2026-11-20 — Dîner chez Paul
 *   id: evt-20261120-1
 *   start: 2026-11-20 19:30          ← « YYYY-MM-DD » seul = journée entière
 *   end: 2026-11-20 22:00            ← journée entière : date de fin INCLUSE
 *   timezone: Asia/Kuala_Lumpur      ← fuseau IANA explicite, obligatoire
 *   location: Chez Paul              ← facultatif
 *   repeat: weekly                   ← facultatif (« weekly » = chaque semaine)
 *   until: 2026-12-31                ← facultatif (fin de la répétition, incluse)
 *
 *   Note libre (facultative), sur une ou plusieurs lignes.
 *
 * Les calendriers abonnés (ICS) restent en lecture seule ; seul ce fichier est modifiable.
 */
import { UserError } from "./api";
import { joinLines, readVersioned, splitLines, updateFile } from "./content-file";
import { detectSensitive } from "./secrets";
import { addDays, instantFromWallTime, isValidTimeZone, localStamp } from "./tz";
import type { CalEvent } from "./ics";

export const AGENDA_FILE = "AGENDA.md";
export const PERSO_ID = "perso";
const SETTINGS = "## Réglages";
const HEADING = /^##\s+(\d{4}-\d{2}-\d{2})\s+[—–-]\s+(.+?)\s*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})$/;
const MAX_OCCURRENCES = 1000;

export interface AgendaSettings { name: string; color: string }

export interface AgendaEvent {
  id: string;
  title: string;
  allDay: boolean;
  /** Journée entière : « YYYY-MM-DD » ; sinon « YYYY-MM-DD HH:mm » (heure murale dans `timezone`). */
  start: string;
  end: string;
  timezone: string;
  location: string;
  repeat: "weekly" | null;
  until: string | null;
  note: string;
  /** Lignes [start, end) du bloc. */
  from: number;
  to: number;
  /** Problème de lecture (bloc écrit à la main) : l'événement est ignoré à l'affichage. */
  problem: string | null;
}

const HEADER = [
  "# Agenda",
  "",
  "> Événements personnels (calendrier « Perso » du dashboard). Un bloc par événement ; heures avec un fuseau IANA explicite.",
  "",
  SETTINGS,
  "name: Perso",
  "color: #a3451f",
  "",
];

/* ------------------------------------------------------------------ */
/* Lecture                                                              */
/* ------------------------------------------------------------------ */

function blocks(lines: string[]) {
  const starts = lines.map((l, i) => (/^##\s/.test(l) ? i : -1)).filter((i) => i >= 0);
  return starts.map((s, k) => ({ start: s, end: k + 1 < starts.length ? starts[k + 1] : lines.length }));
}

export function parseAgenda(text: string): { settings: AgendaSettings; events: AgendaEvent[] } {
  const lines = splitLines(text);
  const settings: AgendaSettings = { name: "Perso", color: "#a3451f" };
  const events: AgendaEvent[] = [];
  for (const b of blocks(lines)) {
    if (lines[b.start].trim() === SETTINGS) {
      for (let i = b.start + 1; i < b.end; i++) {
        const m = lines[i].match(/^(name|color)\s*:\s*(.*?)\s*$/i);
        if (m && m[1].toLowerCase() === "name" && m[2]) settings.name = m[2];
        if (m && m[1].toLowerCase() === "color" && /^#[0-9a-f]{6}$/i.test(m[2])) settings.color = m[2].toLowerCase();
      }
      continue;
    }
    const h = lines[b.start].match(HEADING);
    if (!h) continue;
    const meta: Record<string, string> = {};
    let i = b.start + 1;
    for (; i < b.end; i++) {
      const m = lines[i].match(/^([a-z]+)\s*:\s*(.*?)\s*$/i);
      if (!m) break;
      meta[m[1].toLowerCase()] = m[2];
    }
    const body = lines.slice(i, b.end);
    while (body.length && !body[0].trim()) body.shift();
    while (body.length && !body[body.length - 1].trim()) body.pop();

    const start = meta.start || h[1];
    const allDay = DATE.test(start);
    const end = meta.end || start;
    let problem: string | null = null;
    if (!allDay && !DATETIME.test(start)) problem = "début illisible";
    else if (allDay ? !DATE.test(end) : !DATETIME.test(end)) problem = "fin illisible";
    else if (!meta.timezone || !isValidTimeZone(meta.timezone)) problem = "fuseau horaire manquant ou inconnu";
    events.push({
      id: meta.id || `evt-${h[1].replace(/-/g, "")}-l${b.start}`,
      title: h[2], allDay, start, end,
      timezone: meta.timezone || "",
      location: meta.location ?? "",
      repeat: /^weekly$/i.test(meta.repeat ?? "") ? "weekly" : null,
      until: DATE.test(meta.until ?? "") ? meta.until : null,
      note: body.join("\n"),
      from: b.start, to: b.end, problem,
    });
  }
  return { settings, events };
}

export async function readAgenda() {
  const { text, version } = await readVersioned(AGENDA_FILE);
  return { ...parseAgenda(text), version };
}

/* ------------------------------------------------------------------ */
/* Occurrences dans le fuseau d'affichage                               */
/* ------------------------------------------------------------------ */

function wall(stamp: string) {
  const m = stamp.match(DATETIME)!;
  const [y, mo, d] = m[1].split("-").map(Number);
  return { year: y, month: mo, day: d, hour: Number(m[2]), minute: Number(m[3]), second: 0 };
}

/** Événements « Perso » qui chevauchent [rangeStart, rangeEnd) (dates dans le fuseau d'affichage). */
export function expandAgenda(events: AgendaEvent[], rangeStart: string, rangeEnd: string, displayTz: string): CalEvent[] {
  const out: CalEvent[] = [];
  const rs = `${rangeStart}T00:00`;
  const re = `${rangeEnd}T00:00`;
  for (const ev of events) {
    if (ev.problem) continue;
    const firstDate = ev.start.slice(0, 10);
    const spanDays = Math.max(0, Math.round((Date.parse(`${ev.end.slice(0, 10)}T00:00:00Z`) - Date.parse(`${firstDate}T00:00:00Z`)) / 86_400_000));
    // Une semaine de marge de chaque côté pour les fuseaux éloignés et les événements longs.
    const last = ev.repeat ? (ev.until && ev.until < addDays(rangeEnd, 7) ? ev.until : addDays(rangeEnd, 7)) : firstDate;
    let k = 0;
    if (ev.repeat && firstDate < addDays(rangeStart, -7 - spanDays)) {
      k = Math.floor((Date.parse(`${addDays(rangeStart, -7 - spanDays)}T00:00:00Z`) - Date.parse(`${firstDate}T00:00:00Z`)) / (7 * 86_400_000));
    }
    for (let n = 0; n < MAX_OCCURRENCES; n++, k++) {
      const date = addDays(firstDate, k * 7);
      if (date > last) break;
      const endDate = addDays(date, spanDays);
      let s: string;
      let e: string;
      if (ev.allDay) {
        s = date;
        e = addDays(endDate, 1); // fin exclusive pour l'affichage
        if (!(s < rangeEnd && e > rangeStart)) { if (!ev.repeat) break; continue; }
      } else {
        const sw = { ...wall(ev.start), ...ymd(date) };
        const ew = { ...wall(ev.end), ...ymd(endDate) };
        const sMs = instantFromWallTime(sw, ev.timezone);
        let eMs = instantFromWallTime(ew, ev.timezone);
        if (eMs <= sMs) eMs = sMs + 30 * 60_000;
        s = localStamp(sMs, displayTz);
        e = localStamp(eMs, displayTz);
        if (!(s < re && e > rs)) { if (!ev.repeat) break; continue; }
      }
      out.push({
        id: `${PERSO_ID}:${ev.id}@${date}`, calendarId: PERSO_ID, title: ev.title, allDay: ev.allDay,
        start: s, end: e, location: ev.location || undefined, sourceId: ev.id, editable: true,
      });
      if (!ev.repeat) break;
    }
  }
  return out;
}

function ymd(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

/* ------------------------------------------------------------------ */
/* Écriture (bloc par bloc)                                             */
/* ------------------------------------------------------------------ */

export interface AgendaInput {
  title: string;
  date: string;
  allDay: boolean;
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  location?: string;
  note?: string;
  repeat?: "weekly" | null;
  until?: string | null;
  timezone: string;
}

function validate(input: AgendaInput) {
  if (!input.title.trim() || /[\r\n]/.test(input.title)) throw new UserError("Le titre est obligatoire et doit tenir sur une ligne.");
  if (!DATE.test(input.date)) throw new UserError("Date invalide.");
  if (!isValidTimeZone(input.timezone)) throw new UserError("Fuseau horaire inconnu.");
  if (!input.allDay && (!/^\d{2}:\d{2}$/.test(input.startTime ?? "") || !/^\d{2}:\d{2}$/.test(input.endTime ?? ""))) {
    throw new UserError("Indique une heure de début et de fin (ou coche « toute la journée »).");
  }
  if (input.until && (!DATE.test(input.until) || input.until < input.date)) throw new UserError("La fin de la répétition doit être après la date de l'événement.");
  if (/^#{1,2}\s/m.test(input.note ?? "")) throw new UserError("La note ne peut pas contenir de titres « # » ou « ## ».");
  if (/[\r\n]/.test(input.location ?? "")) throw new UserError("Le lieu doit tenir sur une ligne.");
  const reason = detectSensitive([input.title, input.location, input.note].filter(Boolean).join("\n"));
  if (reason) throw new UserError(`Non enregistré : ${reason}. AGENDA.md est publié sur GitHub.`);
}

function serialize(id: string, input: AgendaInput): string[] {
  const title = input.title.replace(/\s+/g, " ").trim();
  let start: string;
  let end: string;
  if (input.allDay) {
    start = input.date;
    end = input.date;
  } else {
    start = `${input.date} ${input.startTime}`;
    // Fin avant le début (ex. 23:00 → 01:00) : le lendemain.
    end = `${input.endTime! <= input.startTime! ? addDays(input.date, 1) : input.date} ${input.endTime}`;
  }
  const out = [`## ${input.date} — ${title}`, `id: ${id}`, `start: ${start}`, `end: ${end}`, `timezone: ${input.timezone}`];
  if (input.location?.trim()) out.push(`location: ${input.location.trim()}`);
  if (input.repeat === "weekly") {
    out.push("repeat: weekly");
    if (input.until) out.push(`until: ${input.until}`);
  }
  const note = (input.note ?? "").replace(/\r\n/g, "\n").trim();
  if (note) out.push("", ...note.split("\n"));
  out.push("");
  return out;
}

/** Ajout : en fin de fichier, sans réécrire le reste (sûr même sans version). */
export async function addAgendaEvent(input: AgendaInput, version?: string) {
  validate(input);
  return updateFile<string>(AGENDA_FILE, version, (text, exists) => {
    const lines = exists ? splitLines(text) : [...HEADER];
    const { events } = parseAgenda(lines.join("\n"));
    const prefix = `evt-${input.date.replace(/-/g, "")}-`;
    const n = Math.max(0, ...events.filter((e) => e.id.startsWith(prefix)).map((e) => Number(e.id.slice(prefix.length)) || 0)) + 1;
    const id = `${prefix}${n}`;
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    lines.push("", ...serialize(id, input));
    return { text: joinLines(lines), result: id };
  });
}

export async function updateAgendaEvent(version: string, id: string, input: AgendaInput) {
  validate(input);
  return updateFile(AGENDA_FILE, version, (text) => {
    const lines = splitLines(text);
    const ev = parseAgenda(text).events.find((e) => e.id === id);
    if (!ev) throw new UserError("Événement introuvable (supprimé ou modifié à la main ?).", 404);
    lines.splice(ev.from, ev.to - ev.from, ...serialize(id, input));
    return { text: joinLines(lines) };
  });
}

export async function deleteAgendaEvent(version: string, id: string) {
  return updateFile(AGENDA_FILE, version, (text) => {
    const lines = splitLines(text);
    const ev = parseAgenda(text).events.find((e) => e.id === id);
    if (!ev) throw new UserError("Événement introuvable (déjà supprimé ?).", 404);
    lines.splice(ev.from, ev.to - ev.from);
    return { text: joinLines(lines) };
  });
}

/** Nom et couleur du calendrier « Perso » (section « ## Réglages »). */
export async function updateAgendaSettings(version: string | undefined, patch: Partial<AgendaSettings>) {
  if (patch.name !== undefined && (!patch.name.trim() || /[\r\n]/.test(patch.name))) throw new UserError("Nom invalide.");
  if (patch.color !== undefined && !/^#[0-9a-f]{6}$/i.test(patch.color)) throw new UserError("Couleur invalide.");
  return updateFile(AGENDA_FILE, version, (text, exists) => {
    const lines = exists ? splitLines(text) : [...HEADER];
    const cur = parseAgenda(lines.join("\n")).settings;
    const next = { name: patch.name?.trim() ?? cur.name, color: (patch.color ?? cur.color).toLowerCase() };
    const block = [SETTINGS, `name: ${next.name}`, `color: ${next.color}`, ""];
    const b = blocks(lines).find((x) => lines[x.start].trim() === SETTINGS);
    if (b) lines.splice(b.start, b.end - b.start, ...block);
    else {
      const first = blocks(lines)[0];
      lines.splice(first ? first.start : lines.length, 0, ...block);
    }
    return { text: joinLines(lines) };
  });
}

/** Champs d'un événement pour le formulaire de modification. */
export function toInput(ev: AgendaEvent): AgendaInput & { id: string } {
  return {
    id: ev.id, title: ev.title, date: ev.start.slice(0, 10), allDay: ev.allDay,
    startTime: ev.allDay ? undefined : ev.start.slice(11, 16),
    endTime: ev.allDay ? undefined : ev.end.slice(11, 16),
    location: ev.location, note: ev.note, repeat: ev.repeat, until: ev.until, timezone: ev.timezone,
  };
}
