/**
 * GitHub CLI (`gh`, installé et connecté sur le Mac) pour le workflow des rappels : lancer un mail de test,
 * lire l'état des derniers passages. Lancé SANS shell, avec des arguments FIXES (aucune saisie).
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import { CONTENT_DIR } from "./content";

const WORKFLOW = "rappels.yml";
const CANDIDATES = ["/opt/homebrew/bin/gh", "/usr/local/bin/gh", "/usr/bin/gh"];

function ghPath(): string {
  return CANDIDATES.find((p) => fs.existsSync(p)) ?? "gh";
}

function gh(args: readonly string[], timeoutMs = 30_000): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(ghPath(), args as string[], { cwd: CONTENT_DIR, timeout: timeoutMs, env: { ...process.env, GH_PROMPT_DISABLED: "1", NO_COLOR: "1" } }, (err, stdout, stderr) => {
      const code = err ? ((err as NodeJS.ErrnoException).code === "ENOENT" ? 127 : 1) : 0;
      resolve({ code, stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

function explain(r: { code: number; stderr: string }): string {
  if (r.code === 127) return "GitHub CLI (gh) est introuvable sur cet ordinateur. Voir app/README.md, « Rappels par e-mail ».";
  if (/auth login|not logged|authentication/i.test(r.stderr)) return "GitHub CLI n'est pas connecté : lance « gh auth login » une fois (voir app/README.md).";
  if (/not a git repository|failed to determine base repo/i.test(r.stderr)) return "Ce dossier n'est pas relié à un dépôt GitHub.";
  if (/could not find any workflows|workflow .* not found|HTTP 404/i.test(r.stderr)) return "Le workflow « Rappels » n'est pas encore sur GitHub (branche main). Mets le dashboard à jour, puis réessaie.";
  if (/disabled/i.test(r.stderr)) return "Le workflow « Rappels » est désactivé sur GitHub : onglet Actions → Rappels → « Enable workflow ».";
  return r.stderr.trim().split("\n").pop()?.slice(0, 200) || "Erreur inconnue de GitHub CLI.";
}

export interface RunInfo { status: string; conclusion: string | null; createdAt: string; event: string; url: string }
export interface RemindersStatus { lastRun: RunInfo | null; lastSuccess: RunInfo | null; error: string | null }

let cache: { at: number; value: RemindersStatus } | null = null;

/** Derniers passages du workflow (au plus une requête par minute). */
export async function remindersStatus(force = false): Promise<RemindersStatus> {
  if (!force && cache && Date.now() - cache.at < 60_000) return cache.value;
  const r = await gh(["run", "list", "--workflow", WORKFLOW, "--limit", "20", "--json", "status,conclusion,createdAt,event,url"]);
  let value: RemindersStatus;
  if (r.code !== 0) value = { lastRun: null, lastSuccess: null, error: explain(r) };
  else {
    try {
      const runs = (JSON.parse(r.stdout) as RunInfo[]).filter((x) => x && typeof x.createdAt === "string");
      value = { lastRun: runs[0] ?? null, lastSuccess: runs.find((x) => x.conclusion === "success") ?? null, error: null };
    } catch {
      value = { lastRun: null, lastSuccess: null, error: "Réponse illisible de GitHub CLI." };
    }
  }
  cache = { at: Date.now(), value };
  return value;
}

/** Lance le workflow en mode « mail de test » (il lit TACHES.md sur main). */
export async function sendTestEmail(): Promise<{ ok: true } | { ok: false; message: string }> {
  const r = await gh(["workflow", "run", WORKFLOW, "--ref", "main", "-f", "test=true"]);
  cache = null;
  return r.code === 0 ? { ok: true } : { ok: false, message: explain(r) };
}
