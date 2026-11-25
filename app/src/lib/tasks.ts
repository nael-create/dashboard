/**
 * TACHES.md côté app : lecture, ajout, modification, cochage, report, réorganisation, réglages.
 * Format et règles : src/lib/tasks-core.ts et CLAUDE.md (section 20). Chaque écriture suit la règle
 * « fichier inchangé depuis la lecture » (sauf l'ajout, sûr sans version : une ligne en plus).
 */
import { UserError } from "./api";
import { isValidSlug } from "./content";
import { joinLines, readVersioned, updateFile } from "./content-file";
import { displayTimeZone } from "./display-tz";
import { entryKindOf, recordDone } from "./entries-edit";
import { lineSecretReason } from "./secrets";
import { insertionLine } from "./tasks-view";
import {
  DEFAULT_SETTINGS, formatSettings, formatTaskLine, isValidDate, isValidTime, nextOccurrence, nextTaskId,
  parseTasksFile, type Recurrence, type Task, type TaskSettings, type TaskStatus,
} from "./tasks-core";

export const TASKS_FILE = "TACHES.md";

const HEADER_BODY = [
  "",
  "# Tâches",
  "",
  "> Une ligne par tâche : `- [ ] AAAA-MM-JJ [HH:MM] Titre [⏱durée] [#projet] [⏰ ou ⏰-30m] [🔁récurrence] id:…`.",
  "> [x] = faite (✓date), [-] = abandonnée (✗date). Pas de mots de passe ni de codes : ce fichier est sur GitHub.",
  "",
];

export interface TaskInput {
  title: string;
  /** null = sans date (seulement pour une tâche liée à un projet ou un domaine). */
  date: string | null;
  time?: string | null;
  duration?: number | null;
  project?: string | null;
  reminder?: number | null;
  recurrence?: Recurrence | null;
}

function check(t: Partial<TaskInput>) {
  if (t.title !== undefined) {
    const title = t.title.replace(/\s+/g, " ").trim();
    if (!title) throw new UserError("La tâche a besoin d'un titre.");
    if (title.length > 300) throw new UserError("Titre trop long (300 caractères au plus).");
    if (/(^|\s)(id:|[✓✗]\d{4}-|🔁|⏱)/.test(title)) throw new UserError("Le titre contient un marqueur réservé (id:, ✓, ✗, 🔁, ⏱).");
    const reason = lineSecretReason(title);
    if (reason) throw new UserError(`Non enregistré : ${reason}. TACHES.md est publié sur GitHub.`);
  }
  if (t.date !== undefined && t.date !== null && !isValidDate(t.date)) throw new UserError("Date invalide.");
  if (t.time && !isValidTime(t.time)) throw new UserError("Heure invalide.");
  if (t.duration !== undefined && t.duration !== null && (t.duration < 1 || t.duration > 24 * 60)) throw new UserError("Durée invalide.");
  if (t.project && !isValidSlug(t.project)) throw new UserError("Projet invalide.");
  if (t.reminder !== undefined && t.reminder !== null && (t.reminder < 0 || t.reminder > 24 * 60)) throw new UserError("Rappel invalide.");
}

/** Lignes du fichier, créé avec ses réglages par défaut (fuseau d'affichage) s'il n'existe pas. */
function baseLines(text: string, exists: boolean): string[] {
  if (exists) return text.replace(/\r\n/g, "\n").split("\n");
  return [...formatSettings({ ...DEFAULT_SETTINGS, timezone: displayTimeZone() }), ...HEADER_BODY];
}

function findTask(text: string, id: string) {
  const file = parseTasksFile(text);
  const task = file.tasks.find((t) => t.id === id);
  if (!task) throw new UserError("Tâche introuvable (elle a peut-être été modifiée ailleurs).", 404);
  return { file, task };
}

/** Prochaine occurrence d'une tâche récurrente, à partir d'aujourd'hui au plus tôt. */
function upcoming(rec: Recurrence, from: string, today: string): string {
  let n = nextOccurrence(rec, from);
  while (n < today) n = nextOccurrence(rec, n);
  return n;
}

export async function readTasks() {
  const { text, version, exists } = await readVersioned(TASKS_FILE);
  const file = parseTasksFile(exists ? text : "");
  return { tasks: file.tasks, settings: exists ? file.settings : { ...DEFAULT_SETTINGS, timezone: displayTimeZone() }, version, exists };
}

/**
 * Tâches récurrentes non faites dont la date est passée : l'occurrence dépassée reste (en retard,
 * sans récurrence) et la suivante est créée à partir d'aujourd'hui. Écrit seulement si nécessaire.
 */
export async function rollRecurring(today: string) {
  const cur = await readTasks();
  if (!cur.tasks.some((t) => t.status === "todo" && t.recurrence && t.date && t.date < today)) return cur;
  await updateFile(TASKS_FILE, cur.version, (text) => {
    const file = parseTasksFile(text);
    const lines = [...file.lines];
    const all = [...file.tasks];
    for (const t of file.tasks) {
      if (t.status !== "todo" || !t.recurrence || !t.date || t.date >= today) continue;
      lines[t.line] = formatTaskLine({ ...t, recurrence: null });
      const next = { ...t, id: nextTaskId(all, today), date: upcoming(t.recurrence, t.date, today), closedOn: null };
      all.push({ ...next, line: -1 });
      lines.push(formatTaskLine(next));
    }
    return { text: joinLines(trimEnd(lines)) };
  });
  return readTasks();
}

const trimEnd = (lines: string[]) => {
  const out = [...lines];
  while (out.length > 1 && out[out.length - 1] === "" && out[out.length - 2] === "") out.pop();
  return out;
};

/** Une tâche sans date doit être liée à un projet ou un domaine existant. */
async function checkUndated(date: string | null | undefined, project: string | null | undefined) {
  if (date === null && !project) throw new UserError("Une tâche sans date doit être liée à un projet ou un domaine.");
  if (date === null && project && !(await entryKindOf(project))) throw new UserError("Projet ou domaine introuvable.");
}

export async function addTask(input: TaskInput, today: string, version?: string) {
  check(input);
  await checkUndated(input.date, input.project);
  return updateFile<Task>(TASKS_FILE, version, (text, exists) => {
    const lines = baseLines(text, exists);
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    // Une ligne vide sépare l'en-tête (ou du texte écrit à la main) de la liste des tâches.
    if (lines.length && !/^- \[[ xX-]\] /.test(lines[lines.length - 1])) lines.push("");
    const file = parseTasksFile(lines.join("\n"));
    const task: Omit<Task, "line"> = {
      id: nextTaskId(file.tasks, today), status: "todo", date: input.date, time: input.date ? input.time ?? null : null,
      duration: input.duration ?? null, title: input.title.replace(/\s+/g, " ").trim(), project: input.project ?? null,
      reminder: input.time && input.date ? input.reminder ?? null : null, recurrence: input.date ? input.recurrence ?? null : null, closedOn: null,
    };
    const at = insertionLine(file.tasks, task.date, task.time, lines.length);
    lines.splice(at, 0, formatTaskLine(task));
    return { text: joinLines(lines), result: { ...task, line: at } };
  });
}

export async function updateTask(version: string, id: string, patch: Partial<TaskInput>) {
  check(patch);
  if (patch.date === null) {
    const cur = parseTasksFile((await readVersioned(TASKS_FILE)).text).tasks.find((t) => t.id === id);
    await checkUndated(null, patch.project !== undefined ? patch.project : cur?.project);
  }
  return updateFile<Task>(TASKS_FILE, version, (text) => {
    const { file, task } = findTask(text, id);
    const merged: Task = {
      ...task,
      ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
      title: patch.title !== undefined ? patch.title.replace(/\s+/g, " ").trim() : task.title,
    };
    if (!merged.date) {
      merged.time = null;
      merged.recurrence = null;
    }
    if (!merged.time) merged.reminder = null;
    const lines = [...file.lines];
    lines[task.line] = formatTaskLine(merged);
    return { text: joinLines(lines), result: merged };
  });
}

/**
 * Fait / à faire / abandonnée. Faite : date de fin, entrée « Fait : … » dans le journal du projet lié,
 * et, pour une tâche récurrente, l'occurrence suivante (la tâche faite perd sa récurrence).
 */
export async function setTaskStatus(version: string, id: string, status: TaskStatus, today: string) {
  let before: Task | null = null;
  const res = await updateFile<{ task: Task; next: Task | null }>(TASKS_FILE, version, (text) => {
    const { file, task } = findTask(text, id);
    before = task;
    const lines = [...file.lines];
    let next: Task | null = null;
    const updated: Task = { ...task, status, closedOn: status === "todo" ? null : today };
    if (status !== "todo" && task.recurrence && task.date && task.status === "todo") {
      updated.recurrence = null;
      next = { ...task, id: nextTaskId(file.tasks, today), date: upcoming(task.recurrence, task.date, today), closedOn: null, line: lines.length };
      lines.push(formatTaskLine(next));
    }
    lines[task.line] = formatTaskLine(updated);
    return { text: joinLines(lines), result: { task: updated, next } };
  });
  // Projet / domaine lié : « ✓ titre » dans la note du jour (retiré si la tâche est décochée).
  const { task } = res.result!;
  const prev = before as Task | null;
  if (task.project) {
    if (status === "done" && prev?.status !== "done") await recordDone(task.project, today, task.title, true);
    if (status !== "done" && prev?.status === "done" && prev.closedOn) await recordDone(task.project, prev.closedOn, task.title, false);
  }
  return res;
}

/** « Annuler » après une suppression : remet la tâche (même identifiant) à sa ligne d'origine. */
export async function restoreTask(task: Omit<Task, "line"> & { line: number }) {
  check({ title: task.title, date: task.date ?? undefined, time: task.time, project: task.project });
  return updateFile(TASKS_FILE, undefined, (text, exists) => {
    const lines = baseLines(text, exists);
    const file = parseTasksFile(lines.join("\n"));
    if (file.tasks.some((t) => t.id === task.id)) return { text: null };
    const at = Math.max(file.front.end, Math.min(task.line, lines.length));
    lines.splice(at, 0, formatTaskLine(task));
    return { text: joinLines(lines) };
  });
}

export async function deleteTask(version: string, id: string) {
  return updateFile(TASKS_FILE, version, (text) => {
    const { file, task } = findTask(text, id);
    const lines = [...file.lines];
    lines.splice(task.line, 1);
    return { text: joinLines(lines) };
  });
}

/** Monte / descend une tâche parmi celles du même jour (échange de lignes). */
export async function moveTask(version: string, id: string, dir: -1 | 1) {
  return updateFile(TASKS_FILE, version, (text) => {
    const { file, task } = findTask(text, id);
    // Tâches sans date : seulement parmi celles du même projet / domaine (elles ne vivent que sur sa page).
    const sameDay = file.tasks.filter((t) => t.date === task.date && t.status === task.status && (task.date || t.project === task.project));
    const i = sameDay.findIndex((t) => t.id === id);
    const other = sameDay[i + dir];
    if (!other) return { text: null };
    const lines = [...file.lines];
    [lines[task.line], lines[other.line]] = [lines[other.line], lines[task.line]];
    return { text: joinLines(lines) };
  });
}

/** Place une tâche juste avant une autre du même jour (glisser-déposer). */
export async function placeTask(version: string, id: string, beforeId: string | null) {
  return updateFile(TASKS_FILE, version, (text) => {
    const { file, task } = findTask(text, id);
    const lines = [...file.lines];
    const line = lines[task.line];
    lines.splice(task.line, 1);
    const reparsed = parseTasksFile(lines.join("\n"));
    const target = beforeId ? reparsed.tasks.find((t) => t.id === beforeId) : null;
    const sameDay = reparsed.tasks.filter((t) => t.date === task.date);
    const at = target ? target.line : sameDay.length ? sameDay[sameDay.length - 1].line + 1 : lines.length;
    lines.splice(at, 0, line);
    return { text: joinLines(lines) };
  });
}

export async function updateTaskSettings(version: string, patch: Partial<TaskSettings>) {
  if (patch.eveningDigest && !isValidTime(patch.eveningDigest)) throw new UserError("Heure du récapitulatif du soir invalide.");
  if (patch.morningDigest && !isValidTime(patch.morningDigest)) throw new UserError("Heure du récapitulatif du matin invalide.");
  if (patch.timezone) {
    try {
      new Intl.DateTimeFormat("fr", { timeZone: patch.timezone });
    } catch {
      throw new UserError("Fuseau horaire inconnu.");
    }
  }
  return updateFile(TASKS_FILE, version, (text, exists) => {
    const lines = baseLines(text, exists);
    const file = parseTasksFile(lines.join("\n"));
    const settings = { ...file.settings, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) };
    const body = file.front.end ? lines.slice(file.front.end) : ["", ...lines];
    return { text: joinLines([...formatSettings(settings), ...body]) };
  });
}
