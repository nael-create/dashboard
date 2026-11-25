/**
 * Rappels par e-mail — exécuté par le workflow GitHub Actions `.github/workflows/rappels.yml`, toutes les heures.
 *   node --experimental-strip-types app/scripts/send-reminders.ts <TACHES.md> <etat.json> [--test]
 * Lit TACHES.md (branche main), choisit les mails (src/lib/reminders-core.ts), les envoie par l'API Resend
 * et met à jour l'état des envois (fichier JSON, gardé sur la branche « rappels-etat », jamais dans TACHES.md).
 * Secrets (GitHub Actions uniquement) : RESEND_API_KEY, REMINDER_TO. Un seul destinataire : REMINDER_TO.
 * Aucune dépendance : rien n'est installé dans le workflow.
 */
import fs from "node:fs";
import path from "node:path";
import { parseTasksFile } from "../src/lib/tasks-core.ts";
import { markSent, parseState, projectDeadline, selectReminders, testEmail, type Email, type ProjectDeadline } from "../src/lib/reminders-core.ts";

const [tasksPath, statePath] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const test = process.argv.includes("--test");
const apiKey = process.env.RESEND_API_KEY ?? "";
const to = (process.env.REMINDER_TO ?? "").trim();
const from = process.env.REMINDER_FROM?.trim() || "Tableau de bord <onboarding@resend.dev>";

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

if (!tasksPath || !statePath) fail("Usage : send-reminders.ts <TACHES.md> <etat.json> [--test]");
// Secrets pas encore configurés : on s'arrête sans erreur (pas de mail d'échec de GitHub toutes les heures),
// sauf pour le mail de test, qui doit dire ce qui manque.
const missing = !apiKey ? "RESEND_API_KEY" : !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(to) ? "REMINDER_TO (une seule adresse)" : null;
if (missing) {
  const msg = `Secret ${missing} manquant ou invalide (Settings → Secrets and variables → Actions).`;
  if (test) fail(msg);
  console.log(`ℹ ${msg} Rien n'est envoyé.`);
  process.exit(0);
}

const text = fs.existsSync(tasksPath) ? fs.readFileSync(tasksPath, "utf8") : "";
const file = parseTasksFile(text);
let state = parseState(fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8") || "{}") : {});
const now = new Date();

async function send(email: Email): Promise<boolean> {
  // Clé d'idempotence Resend (24 h) : un relancement du même passage ne renvoie pas le mail.
  const idem = email.kind === "test" ? `test-${now.toISOString().slice(0, 16)}` : `${email.keys.join("|")}`.slice(0, 256);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": idem },
    body: JSON.stringify({ from, to: [to], subject: email.subject, html: email.html, text: email.text }),
  });
  if (res.ok) return true;
  const body = await res.text().catch(() => "");
  console.error(`✗ Envoi refusé (${res.status}) : ${body.slice(0, 300)}`);
  if (res.status === 403) console.error("  Sans domaine vérifié, Resend n'envoie qu'à l'adresse du compte Resend : REMINDER_TO doit être celle-là.");
  return false;
}

/** Deadlines des projets en cours : projects/<nom>/README.md à côté de TACHES.md (récapitulatif du soir). */
function readDeadlines(): ProjectDeadline[] {
  const dir = path.join(path.dirname(tasksPath), "projects");
  let names: string[] = [];
  try {
    names = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(d.name)).map((d) => d.name);
  } catch {
    return [];
  }
  const out: ProjectDeadline[] = [];
  for (const n of names) {
    try {
      const d = projectDeadline(n, fs.readFileSync(path.join(dir, n, "README.md"), "utf8"));
      if (d) out.push(d);
    } catch {
      /* README illisible : ignoré */
    }
  }
  return out;
}

const emails = test ? [testEmail(file, now)] : selectReminders(file, state, now, readDeadlines());
if (!file.settings.reminders && !test) console.log("Rappels désactivés dans TACHES.md (reminders: no).");
if (!emails.length) console.log("Rien à envoyer.");
let failed = false;
for (const e of emails) {
  if (await send(e)) {
    console.log(`✓ Envoyé : ${e.kind}`);
    state = markSent(state, e, now, file.settings.timezone);
  } else failed = true;
}
fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
if (failed) process.exit(1);
