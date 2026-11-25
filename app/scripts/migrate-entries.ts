/**
 * Migration vers les projets / domaines simplifiés (voir src/lib/migrate-entries.ts). IDEMPOTENTE :
 * la relancer ne change rien. Lancement (depuis app/) :
 *   node --experimental-strip-types scripts/migrate-entries.ts [dossier du contenu, par défaut ..] [--dry-run]
 * Écrit les README de projects/ et areas/ (hors _template et archive/) et ajoute les tâches dans TACHES.md.
 * Pensé pour être lancé une fois, puis commité à part (git revert possible).
 */
import fs from "node:fs";
import path from "node:path";
import { migrateReadme, type EntryKind } from "../src/lib/migrate-entries.ts";
import { DEFAULT_SETTINGS, formatSettings, formatTaskLine, localNow, nextTaskId, parseTasksFile, type Task } from "../src/lib/tasks-core.ts";

const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const root = path.resolve(args.find((a) => !a.startsWith("--")) ?? "..");
const tasksPath = path.join(root, "TACHES.md");

let tasksText = fs.existsSync(tasksPath)
  ? fs.readFileSync(tasksPath, "utf8")
  : [...formatSettings({ ...DEFAULT_SETTINGS, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_SETTINGS.timezone }), "", "# Tâches", ""].join("\n");
const file = parseTasksFile(tasksText);
const today = localNow(file.settings.timezone, new Date()).date;
const all: Pick<Task, "id">[] = [...file.tasks];
const newLines: string[] = [];
let changedFiles = 0;

for (const [dir, kind] of [["projects", "project"], ["areas", "area"]] as [string, EntryKind][]) {
  const base = path.join(root, dir);
  if (!fs.existsSync(base)) continue;
  for (const slug of fs.readdirSync(base).sort()) {
    const readme = path.join(base, slug, "README.md");
    if (slug.startsWith("_") || !fs.existsSync(readme)) continue;
    const titles = new Set(file.tasks.filter((t) => t.project === slug).map((t) => t.title));
    const res = migrateReadme(fs.readFileSync(readme, "utf8"), kind, slug, titles, today);
    for (const t of res.tasks) {
      const id = nextTaskId(all, today);
      all.push({ id });
      newLines.push(formatTaskLine({ ...t, id, time: null, duration: null, reminder: null, recurrence: null }));
    }
    if (res.changed) {
      changedFiles++;
      if (!dry) fs.writeFileSync(readme, res.text);
    }
    console.log(`${res.changed || res.tasks.length ? "✓" : "·"} ${dir}/${slug}${res.report.length ? ` — ${res.report.join(" ; ")}` : ""}${res.tasks.length ? ` (+${res.tasks.length} tâche(s))` : ""}`);
  }
}

if (newLines.length) {
  const lines = tasksText.replace(/\n+$/, "").split("\n");
  if (!/^- \[[ xX-]\] /.test(lines[lines.length - 1] ?? "")) lines.push("");
  tasksText = [...lines, ...newLines, ""].join("\n");
  if (!dry) fs.writeFileSync(tasksPath, tasksText);
}
console.log(`${dry ? "[essai] " : ""}${changedFiles} fichier(s) migré(s), ${newLines.length} tâche(s) ajoutée(s) à TACHES.md.`);
