/**
 * Rappels par e-mail — choix des mails à envoyer (fonctions pures, sans dépendance ; partagées par le
 * workflow GitHub Actions `.github/workflows/rappels.yml` via `node --experimental-strip-types`).
 *
 * Règles (CLAUDE.md, section 21) :
 * - récapitulatif du soir (heure `evening_digest`) : tâches non faites d'aujourd'hui + en retard ;
 * - récapitulatif du matin (`morning_digest`, si `morning_enabled`) : tâches d'aujourd'hui ;
 * - rappel d'une tâche (`⏰` = à l'heure, `⏰-30m` = 30 min avant) : au premier passage horaire
 *   à partir de ce moment (6 h au plus tard, sinon il est sauté) ;
 * - au plus 3 mails par jour (une place est gardée pour le soir), aucun mail s'il n'y a rien à dire ;
 * - jamais deux fois le même rappel : clé par mail (jour, ou tâche + date + heure + rappel), gardée
 *   dans l'état `sent` (hors de TACHES.md), oubliée au bout de 14 jours.
 */
import { addDays, isDated, localNow, timeToMinutes, type DatedTask, type TasksFile } from "./tasks-core.ts";

export const MAX_PER_DAY = 3;
/** Fenêtre après l'heure prévue pendant laquelle un rappel est encore envoyé (workflow en retard). */
export const LATE_WINDOW_MIN = 6 * 60;
export const KEEP_DAYS = 14;
export const APP_URL = "http://127.0.0.1:3000/projets/aujourdhui";

/** État des envois (hors de TACHES.md) : clés déjà envoyées → date locale, et une date par mail parti. */
export interface SentState {
  keys: Record<string, string>;
  mails: string[];
}
export const emptyState = (): SentState => ({ keys: {}, mails: [] });

/** Relit un état JSON quelconque sans échouer (fichier absent ou abîmé → état vide). */
export function parseState(raw: unknown): SentState {
  const st = emptyState();
  if (!raw || typeof raw !== "object") return st;
  const r = raw as { keys?: unknown; mails?: unknown };
  if (r.keys && typeof r.keys === "object") {
    for (const [k, v] of Object.entries(r.keys as Record<string, unknown>)) if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) st.keys[k] = v;
  }
  if (Array.isArray(r.mails)) st.mails = r.mails.filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d));
  return st;
}

export interface Email {
  kind: "evening" | "morning" | "task" | "test";
  /** Clés marquées « envoyées » si le mail part (une seule pour un récapitulatif, une par tâche sinon). */
  keys: string[];
  subject: string;
  html: string;
  text: string;
}

export const taskKey = (t: DatedTask) => `task:${t.id}:${t.date}T${t.time}:${t.reminder}`;

/** Minutes locales (depuis minuit du jour `today`) d'une date + heure. */
const minutesFrom = (today: string, date: string, time: string) =>
  Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 60000) + timeToMinutes(time);

/**
 * Mails à envoyer maintenant. `state` n'est pas modifié : utiliser `markSent` pour chaque mail parti.
 */
export function selectReminders(file: TasksFile, state: SentState, now: Date): Email[] {
  const s = file.settings;
  if (!s.reminders) return [];
  const { date: today, minutes } = localNow(s.timezone, now);
  const todo = file.tasks.filter(isDated).filter((t) => t.status === "todo");
  const out: Email[] = [];
  let count = state.mails.filter((d) => d === today).length;

  const eveningKey = `evening:${today}`;
  const morningKey = `morning:${today}`;
  const eveningAt = timeToMinutes(s.eveningDigest);
  const eveningPending = !(eveningKey in state.keys);

  // 1. Rappels de tâches (les plus urgents), regroupés en un seul mail par passage.
  const due = todo.filter((t) => {
    if (!t.time || t.reminder === null || taskKey(t) in state.keys) return false;
    const at = minutesFrom(today, t.date, t.time) - t.reminder;
    return minutes >= at && minutes < at + LATE_WINDOW_MIN;
  });
  const reserve = eveningPending && minutes < eveningAt + LATE_WINDOW_MIN ? 1 : 0;
  if (due.length && count + reserve < MAX_PER_DAY) {
    out.push(taskEmail(due, today));
    count++;
  }

  // 2. Récapitulatif du matin.
  const morningAt = timeToMinutes(s.morningDigest);
  if (s.morningEnabled && !(morningKey in state.keys) && minutes >= morningAt && minutes < morningAt + LATE_WINDOW_MIN) {
    const list = todo.filter((t) => t.date === today);
    if (list.length && count + reserve < MAX_PER_DAY) {
      out.push(digestEmail("morning", today, list, []));
      count++;
    }
  }

  // 3. Récapitulatif du soir (jusqu'à la fin de la journée locale).
  if (eveningPending && minutes >= eveningAt) {
    const list = todo.filter((t) => t.date === today);
    const late = todo.filter((t) => t.date < today);
    if ((list.length || late.length) && count < MAX_PER_DAY) out.push(digestEmail("evening", today, list, late));
  }
  return out;
}

/** Enregistre un mail parti (le test n'est pas compté) et oublie ce qui a plus de 14 jours. */
export function markSent(state: SentState, email: Email, now: Date, timeZone: string): SentState {
  const { date } = localNow(timeZone, now);
  const limit = addDays(date, -KEEP_DAYS);
  const next: SentState = { keys: {}, mails: state.mails.filter((d) => d >= limit) };
  for (const [k, d] of Object.entries(state.keys)) if (d >= limit) next.keys[k] = d;
  if (email.kind === "test") return next;
  for (const k of email.keys) next.keys[k] = date;
  next.mails.push(date);
  return next;
}

/* ------------------------------------------------------------------ */
/* Mise en forme (HTML sobre + texte brut)                              */
/* ------------------------------------------------------------------ */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(Date.UTC(y, m - 1, d)));
}

const taskLabel = (t: DatedTask, today: string) =>
  `${t.date !== today ? `${longDate(t.date)} · ` : ""}${t.time ? `${t.time} · ` : ""}${t.title}${t.project ? ` (#${t.project})` : ""}`;

function layout(title: string, intro: string, groups: { label: string; tasks: DatedTask[] }[], today: string): { html: string; text: string } {
  const rows = groups
    .filter((g) => g.tasks.length)
    .map((g) => `
      <p style="margin:28px 0 8px;font:600 11px/1.4 Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#6b6358">${esc(g.label)}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #1c1a17">
        ${g.tasks.map((t) => `
        <tr><td style="padding:10px 0;border-bottom:1px solid #d8d2c6;font:15px/1.45 Helvetica,Arial,sans-serif;color:#1c1a17">
          <a href="${APP_URL}#task-${esc(t.id)}" style="color:#1c1a17;text-decoration:none">${t.time ? `<span style="color:#6b6358">${esc(t.time)}</span>&nbsp;&nbsp;` : ""}${esc(t.title)}</a>
          ${t.date !== today ? `<br><span style="font-size:12px;color:#a3451f">${esc(longDate(t.date))}</span>` : ""}
          ${t.project ? `<span style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#6b6358">&nbsp;&nbsp;#${esc(t.project)}</span>` : ""}
        </td></tr>`).join("")}
      </table>`)
    .join("");
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#ece8df">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ece8df"><tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
    <tr><td>
      <p style="margin:0 0 4px;font:600 11px/1.4 Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#6b6358">tableau de bord · ${esc(longDate(today))}</p>
      <h1 style="margin:0;font:400 34px/1.1 Helvetica,Arial,sans-serif;letter-spacing:-.02em;color:#1c1a17">${esc(title)}</h1>
      <p style="margin:12px 0 0;font:15px/1.5 Helvetica,Arial,sans-serif;color:#3b362f">${esc(intro)}</p>
      ${rows}
      <p style="margin:28px 0 0"><a href="${APP_URL}" style="display:inline-block;padding:9px 16px;border-radius:999px;background:#1c1a17;color:#ece8df;font:600 12px Helvetica,Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;text-decoration:none">ouvrir aujourd'hui</a></p>
      <p style="margin:24px 0 0;font:12px/1.5 Helvetica,Arial,sans-serif;color:#6b6358">Les liens s'ouvrent sur le Mac où tourne le dashboard. Réglages : onglet « aujourd'hui », panneau « rappels par e-mail ».</p>
    </td></tr>
  </table></td></tr></table></body></html>`;
  const text = [
    title, intro, "",
    ...groups.filter((g) => g.tasks.length).flatMap((g) => [g.label.toUpperCase(), ...g.tasks.map((t) => `- ${taskLabel(t, today)}`), ""]),
    `Ouvrir : ${APP_URL}`,
  ].join("\n");
  return { html, text };
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export function digestEmail(kind: "evening" | "morning", today: string, list: DatedTask[], late: DatedTask[]): Email {
  const title = kind === "evening" ? "ce soir" : "aujourd'hui";
  const intro = kind === "evening"
    ? `${plural(list.length, "tâche reste", "tâches restent")} pour aujourd'hui${late.length ? `, ${plural(late.length, "en retard", "en retard")}` : ""}.`
    : `${plural(list.length, "tâche prévue", "tâches prévues")} aujourd'hui.`;
  const { html, text } = layout(title, intro, [{ label: "aujourd'hui", tasks: list }, { label: "en retard", tasks: late }], today);
  const subject = kind === "evening"
    ? `Ce soir : ${plural(list.length + late.length, "tâche", "tâches")} à faire`
    : `Aujourd'hui : ${plural(list.length, "tâche", "tâches")}`;
  return { kind, keys: [`${kind}:${today}`], subject, html, text };
}

export function taskEmail(tasks: DatedTask[], today: string): Email {
  const first = tasks[0];
  const subject = tasks.length === 1 ? `Rappel : ${first.time ? `${first.time} ` : ""}${first.title}` : `Rappels : ${plural(tasks.length, "tâche", "tâches")}`;
  const intro = tasks.length === 1
    ? (first.reminder ? `Dans ${first.reminder} min${first.time ? ` (à ${first.time})` : ""}.` : `C'est l'heure${first.time ? ` (${first.time})` : ""}.`)
    : "Ces tâches arrivent.";
  const { html, text } = layout("rappel", intro, [{ label: tasks.length > 1 ? "tâches" : "tâche", tasks }], today);
  return { kind: "task", keys: tasks.map(taskKey), subject, html, text };
}

export function testEmail(file: TasksFile, now: Date): Email {
  const { date: today } = localNow(file.settings.timezone, now);
  const list = file.tasks.filter(isDated).filter((t) => t.status === "todo" && t.date <= today);
  const { html, text } = layout("mail de test", `Les rappels fonctionnent. Voici ce qui reste pour aujourd'hui (${plural(list.length, "tâche", "tâches")}).`, [{ label: "aujourd'hui et en retard", tasks: list }], today);
  return { kind: "test", keys: [], subject: "Test : rappels du tableau de bord", html, text };
}
