/**
 * TACHES.md — cœur sans dépendance (utilisé par l'app ET par le workflow GitHub Actions des rappels,
 * exécuté avec `node --experimental-strip-types` : pas d'alias, imports relatifs en .ts, pas d'enum).
 *
 *   ---
 *   timezone: Asia/Kuala_Lumpur
 *   reminders: yes
 *   evening_digest: "18:00"
 *   morning_digest: "08:00"
 *   morning_enabled: no
 *   autosync: yes
 *   ---
 *
 *   # Tâches
 *
 *   - [ ] 2026-11-25 14:00 Appeler la banque ⏱30min #medtech ⏰-30m id:t-20261124-1
 *   - [ ] 2026-11-30 Payer le loyer 🔁le-30-du-mois id:t-20261124-2
 *   - [x] 2026-11-24 Relire le contrat id:t-20261123-4 ✓2026-11-24
 *   - [-] 2026-11-20 Ancienne idée id:t-20261119-1 ✗2026-11-22
 *
 * Une ligne par tâche : case ([ ] à faire, [x] faite, [-] abandonnée), date (obligatoire, sauf pour une
 * tâche liée à un projet ou un domaine : « - [ ] Titre #projet id:… » sans date), heure,
 * titre, puis des marqueurs facultatifs dans n'importe quel ordre : ⏱durée, #projet, ⏰rappel,
 * 🔁récurrence, id:…, ✓date de fin / ✗date d'abandon. Les autres lignes sont gardées telles quelles.
 */

export type TaskStatus = "todo" | "done" | "dropped";
export type Recurrence = { kind: "daily" } | { kind: "weekly"; weekday: number } | { kind: "monthly"; day: number };

export interface Task {
  id: string;
  status: TaskStatus;
  /** YYYY-MM-DD, ou null (tâche sans date d'un projet / domaine : jamais dans « aujourd'hui »). */
  date: string | null;
  /** HH:MM ou null */
  time: string | null;
  /** minutes */
  duration: number | null;
  title: string;
  project: string | null;
  /** minutes avant l'heure (0 = à l'heure) ; null = pas de rappel propre à la tâche */
  reminder: number | null;
  recurrence: Recurrence | null;
  /** date de fin (faite) ou d'abandon */
  closedOn: string | null;
  /** index de la ligne dans le fichier */
  line: number;
}

/** Tâche datée (vue « aujourd'hui », calendrier, rappels : seules les tâches datées y figurent). */
export type DatedTask = Task & { date: string };
export const isDated = (t: Task): t is DatedTask => !!t.date;

export interface TaskSettings {
  timezone: string;
  reminders: boolean;
  eveningDigest: string;
  morningDigest: string;
  morningEnabled: boolean;
  autosync: boolean;
}

export const DEFAULT_SETTINGS: TaskSettings = {
  timezone: "Europe/Paris",
  reminders: true,
  eveningDigest: "18:00",
  morningDigest: "08:00",
  morningEnabled: false,
  autosync: true,
};

export const WEEKDAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

/* ------------------------------------------------------------------ */
/* Dates (chaînes YYYY-MM-DD, calcul en UTC pour éviter les décalages)  */
/* ------------------------------------------------------------------ */

const toUtc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fromUtc = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(iso: string, n: number): string {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtc(d);
}

/** 1 = lundi … 7 = dimanche */
export function isoWeekday(iso: string): number {
  const d = toUtc(iso).getUTCDay();
  return d === 0 ? 7 : d;
}

export const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

export function isValidDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split("-").map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export const isValidTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
export const timeToMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const minutesToTime = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Date et minute de la journée dans un fuseau donné (sans dépendance). */
export function localNow(timeZone: string, now: Date): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

/** Lundi de la semaine (ISO) d'une date. */
export const weekStart = (iso: string) => addDays(iso, 1 - isoWeekday(iso));

/* ------------------------------------------------------------------ */
/* Récurrence                                                           */
/* ------------------------------------------------------------------ */

export function recurrenceToken(r: Recurrence): string {
  if (r.kind === "daily") return "🔁tous-les-jours";
  if (r.kind === "weekly") return `🔁chaque-${WEEKDAYS[r.weekday - 1]}`;
  return `🔁le-${r.day}-du-mois`;
}

export function parseRecurrenceToken(tok: string): Recurrence | null {
  const t = tok.replace(/^🔁/, "").toLowerCase();
  if (t === "tous-les-jours" || t === "chaque-jour") return { kind: "daily" };
  const w = t.match(/^chaque-([a-z]+)$/);
  if (w && WEEKDAYS.includes(w[1])) return { kind: "weekly", weekday: WEEKDAYS.indexOf(w[1]) + 1 };
  const m = t.match(/^le-(\d{1,2})-du-mois$/);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 31) return { kind: "monthly", day: Number(m[1]) };
  return null;
}

/** Prochaine date STRICTEMENT après `from` (le 31 d'un mois court devient le dernier jour du mois). */
export function nextOccurrence(r: Recurrence, from: string): string {
  if (r.kind === "daily") return addDays(from, 1);
  if (r.kind === "weekly") {
    const delta = ((r.weekday - isoWeekday(from) + 7) % 7) || 7;
    return addDays(from, delta);
  }
  const [y, m, d] = from.split("-").map(Number);
  const inMonth = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, "0")}-${String(Math.min(r.day, daysInMonth(yy, mm))).padStart(2, "0")}`;
  const same = inMonth(y, m);
  if (Number(same.slice(8)) > d) return same;
  return m === 12 ? inMonth(y + 1, 1) : inMonth(y, m + 1);
}

/* ------------------------------------------------------------------ */
/* Lignes de tâches                                                     */
/* ------------------------------------------------------------------ */

const LINE = /^- \[( |x|X|-)\] (\d{4}-\d{2}-\d{2})(?: ([01]\d:[0-5]\d|2[0-3]:[0-5]\d))?(?: (.*))?$/;
/** Tâche sans date : « - [ ] Titre … #projet … » (le #projet est alors obligatoire). */
const UNDATED = /^- \[( |x|X|-)\] (?!\d{4}-\d{2}-\d{2}(?:\s|$))(.+)$/;

export function parseDuration(tok: string): number | null {
  const m = tok.match(/^(\d{1,2})h(\d{1,2})?$|^(\d{1,3})min$/);
  if (!m) return null;
  return m[3] ? Number(m[3]) : Number(m[1]) * 60 + Number(m[2] ?? 0);
}
export const formatDuration = (min: number) => (min % 60 === 0 ? `${min / 60}h` : min < 60 ? `${min}min` : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`);

export function parseReminder(tok: string): number | null {
  if (tok === "⏰") return 0;
  const m = tok.match(/^⏰-(\d{1,3})(m|min|h)$/);
  if (!m) return null;
  return m[2] === "h" ? Number(m[1]) * 60 : Number(m[1]);
}
export const formatReminder = (min: number) => (min === 0 ? "⏰" : min % 60 === 0 ? `⏰-${min / 60}h` : `⏰-${min}m`);

export function parseTaskLine(text: string, line: number): Task | null {
  let m = text.match(LINE);
  if (m && !isValidDate(m[2])) return null;
  if (!m) {
    const u = text.match(UNDATED);
    if (!u) return null;
    m = [u[0], u[1], undefined, undefined, u[2]] as unknown as RegExpMatchArray;
  }
  const status: TaskStatus = m[1] === " " ? "todo" : m[1] === "-" ? "dropped" : "done";
  let id = "";
  let duration: number | null = null;
  let project: string | null = null;
  let reminder: number | null = null;
  let recurrence: Recurrence | null = null;
  let closedOn: string | null = null;
  const words: string[] = [];
  for (const w of (m[4] ?? "").split(/\s+/).filter(Boolean)) {
    let mm: RegExpMatchArray | null;
    if ((mm = w.match(/^id:(t-[a-z0-9-]+)$/i))) id = mm[1];
    else if ((mm = w.match(/^[✓✗](\d{4}-\d{2}-\d{2})$/))) closedOn = mm[1];
    else if (w.startsWith("⏱") && parseDuration(w.slice(1)) !== null) duration = parseDuration(w.slice(1));
    else if (w.startsWith("⏰") && parseReminder(w) !== null) reminder = parseReminder(w);
    else if (w.startsWith("🔁") && parseRecurrenceToken(w)) recurrence = parseRecurrenceToken(w);
    else if ((mm = w.match(/^#([a-z][a-z0-9]*(?:-[a-z0-9]+)*)$/)) && !project) project = mm[1];
    else words.push(w);
  }
  const date = m[2] ?? null;
  // Sans date, seule une tâche liée à un projet / domaine est une tâche (pas une case à cocher quelconque).
  if (!date && !project) return null;
  return {
    id: id || `t-ligne-${line + 1}`, status, date, time: date ? m[3] ?? null : null, duration,
    title: words.join(" "), project, reminder: date ? reminder : null, recurrence: date ? recurrence : null, closedOn, line,
  };
}

export function formatTaskLine(t: Omit<Task, "line">): string {
  const box = t.status === "todo" ? " " : t.status === "done" ? "x" : "-";
  const parts = [t.date ? `- [${box}] ${t.date}` : `- [${box}]`];
  if (t.date && t.time) parts.push(t.time);
  parts.push(t.title.replace(/\s+/g, " ").trim() || "(sans titre)");
  if (t.duration) parts.push(`⏱${formatDuration(t.duration)}`);
  if (t.project) parts.push(`#${t.project}`);
  if (t.reminder !== null && t.time && t.date) parts.push(formatReminder(t.reminder));
  if (t.recurrence && t.date) parts.push(recurrenceToken(t.recurrence));
  parts.push(`id:${t.id}`);
  if (t.closedOn && t.status !== "todo") parts.push(`${t.status === "done" ? "✓" : "✗"}${t.closedOn}`);
  return parts.join(" ");
}

/* ------------------------------------------------------------------ */
/* Fichier : réglages (frontmatter) + tâches                            */
/* ------------------------------------------------------------------ */

export interface TasksFile {
  settings: TaskSettings;
  tasks: Task[];
  lines: string[];
  /** lignes [start, end) du frontmatter (0,0 s'il n'y en a pas) */
  front: { start: number; end: number };
}

const yes = (v: string) => /^(yes|oui|true)$/i.test(v.trim());
const unquote = (v: string) => v.replace(/\s+#.*$/, "").trim().replace(/^["']|["']$/g, "").trim();

export function parseTasksFile(text: string): TasksFile {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const settings: TaskSettings = { ...DEFAULT_SETTINGS };
  let front = { start: 0, end: 0 };
  if (lines[0] === "---") {
    const close = lines.indexOf("---", 1);
    if (close > 0) {
      front = { start: 0, end: close + 1 };
      for (const l of lines.slice(1, close)) {
        const m = l.match(/^([a-z_]+)\s*:\s*(.*)$/);
        if (!m) continue;
        const v = unquote(m[2]);
        if (m[1] === "timezone" && v) settings.timezone = v;
        else if (m[1] === "reminders") settings.reminders = yes(v);
        else if (m[1] === "evening_digest" && isValidTime(v)) settings.eveningDigest = v;
        else if (m[1] === "morning_digest" && isValidTime(v)) settings.morningDigest = v;
        else if (m[1] === "morning_enabled") settings.morningEnabled = yes(v);
        else if (m[1] === "autosync") settings.autosync = yes(v);
      }
    }
  }
  const tasks: Task[] = [];
  lines.forEach((l, i) => {
    if (i < front.end) return;
    const t = parseTaskLine(l, i);
    if (t) tasks.push(t);
  });
  return { settings, tasks, lines, front };
}

export function formatSettings(s: TaskSettings): string[] {
  return [
    "---",
    `timezone: ${s.timezone}`,
    `reminders: ${s.reminders ? "yes" : "no"}            # rappels par e-mail (GitHub Actions, voir app/README.md)`,
    `evening_digest: "${s.eveningDigest}"     # récapitulatif du soir`,
    `morning_digest: "${s.morningDigest}"     # récapitulatif du matin`,
    `morning_enabled: ${s.morningEnabled ? "yes" : "no"}`,
    `autosync: ${s.autosync ? "yes" : "no"}             # envoi automatique de TACHES.md sur GitHub`,
    "---",
  ];
}

/** Identifiant suivant pour une date de création donnée : t-YYYYMMDD-n. */
export function nextTaskId(tasks: Pick<Task, "id">[], created: string): string {
  const prefix = `t-${created.replace(/-/g, "")}-`;
  let n = 0;
  for (const t of tasks) if (t.id.startsWith(prefix)) n = Math.max(n, Number(t.id.slice(prefix.length)) || 0);
  return `${prefix}${n + 1}`;
}
