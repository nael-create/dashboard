/**
 * Sauvegarde du CONTENU (Markdown) avec git : ajout, commit, pull --rebase, push.
 *
 * Garanties :
 * - git est lancé SANS shell, avec des arguments FIXES (jamais construits à partir de saisies) ;
 *   le message de commit passe par l'entrée standard (`commit -F -`).
 * - Seuls les fichiers de contenu sont ajoutés : *.md à la racine, projects/, areas/, reviews/, archive/.
 *   Jamais app/, app/data/, .env*, ni un fichier ignoré par git.
 * - Contrôle des secrets avant le commit (même règle que pour les commits de code) ; en cas de doute,
 *   rien n'est commité et les fichiers restent tels quels.
 * - Jamais de push forcé. Conflit au pull : rebase annulé, fichiers intacts, commit local conservé.
 *   Échec du push : le commit local est conservé (rien n'est perdu).
 */
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { CONTENT_DIR } from "./content";
import { detectSensitive } from "./secrets";

const CONTENT_PATHSPECS = [":(glob)*.md", "projects", "areas", "reviews", "archive"] as const;
const repo = () => CONTENT_DIR;

/* ------------------------------------------------------------------ */
/* Test d'envoi vers GitHub (écrit par le lanceur, mis à jour ici)      */
/* ------------------------------------------------------------------ */

export type PushCheck = { result: "ok" | "auth" | "network" | "other"; checkedAt: string } | null;
const pushCheckFile = () =>
  path.join(/*turbopackIgnore: true*/ process.env.DASHBOARD_DATA_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "data"), "push-check.local.json");

export async function readPushCheck(): Promise<PushCheck> {
  try {
    const raw = JSON.parse(await fs.readFile(/*turbopackIgnore: true*/ pushCheckFile(), "utf8"));
    return ["ok", "auth", "network", "other"].includes(raw.result) ? raw : null;
  } catch {
    return null;
  }
}

async function writePushCheck(result: NonNullable<PushCheck>["result"]) {
  try {
    const file = pushCheckFile();
    await fs.mkdir(/*turbopackIgnore: true*/ path.dirname(file), { recursive: true });
    await fs.writeFile(/*turbopackIgnore: true*/ file, JSON.stringify({ result, checkedAt: new Date().toISOString() }) + "\n");
  } catch {
    /* information facultative */
  }
}

interface Run { code: number; stdout: string; stderr: string }

function git(args: readonly string[], input?: string, timeoutMs = 60_000): Promise<Run> {
  return new Promise((resolve) => {
    const child = execFile(
      "git",
      args as string[],
      {
        cwd: repo(),
        timeout: timeoutMs,
        maxBuffer: 20 * 1024 * 1024,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0", LC_ALL: "C", LANG: "C" },
      },
      (err, stdout, stderr) => {
        const code = err ? (typeof (err as NodeJS.ErrnoException & { code?: unknown }).code === "number" ? (err as unknown as { code: number }).code : 1) : 0;
        resolve({ code, stdout: String(stdout), stderr: String(stderr) });
      },
    );
    if (input !== undefined) child.stdin?.end(input);
  });
}

/**
 * Nouvelle version de l'app sur GitHub ? Nombre de commits de « origin/main » absents d'ici
 * (null si GitHub est injoignable). « git fetch » au plus toutes les 10 minutes, sans question.
 */
let updateCache: { at: number; behind: number | null } | null = null;
export async function updatesAvailable(force = false): Promise<number | null> {
  if (!force && updateCache && Date.now() - updateCache.at < 10 * 60_000) return updateCache.behind;
  let behind: number | null = null;
  const fetched = await git(["fetch", "--quiet", "origin", "main"], undefined, 20_000);
  if (fetched.code === 0) {
    const count = await git(["rev-list", "--count", "HEAD..origin/main"]);
    if (count.code === 0) behind = Number.parseInt(count.stdout.trim(), 10) || 0;
  }
  updateCache = { at: Date.now(), behind };
  return behind;
}

/** Chemins de contenu autorisés à être sauvegardés. */
export function isContentPath(p: string): boolean {
  if (/(^|\/)\.env/.test(p) || /\.local\.json$/.test(p) || p.startsWith("app/")) return false;
  return /^[^/]+\.md$/.test(p) || /^(projects|areas|reviews|archive)\//.test(p);
}

export interface SaveStatus {
  isRepo: boolean;
  branch: string | null;
  /** Fichiers de contenu modifiés et pas encore commités. */
  files: string[];
  count: number;
  /** Commits locaux pas encore envoyés sur GitHub (ex. après un échec de push). */
  ahead: number;
  /** Âge (jours) de la plus ancienne modification non sauvegardée. */
  oldestDays: number | null;
  /** Dernier test d'envoi vers GitHub (lanceur ou dernière sauvegarde). */
  pushCheck: PushCheck;
}

/** Analyse `git status --porcelain=v1 -z`. */
function parseStatus(out: string): string[] {
  const parts = out.split("\0").filter(Boolean);
  const files: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i];
    const xy = entry.slice(0, 2);
    files.push(entry.slice(3));
    if (xy[0] === "R" || xy[0] === "C") i++; // l'entrée suivante est l'ancien chemin
  }
  return files;
}

export async function saveStatus(): Promise<SaveStatus> {
  const inside = await git(["rev-parse", "--is-inside-work-tree"]);
  if (inside.code !== 0 || inside.stdout.trim() !== "true") {
    return { isRepo: false, branch: null, files: [], count: 0, ahead: 0, oldestDays: null, pushCheck: null };
  }
  const [branch, status, ahead] = await Promise.all([
    git(["rev-parse", "--abbrev-ref", "HEAD"]),
    git(["status", "--porcelain=v1", "-z", "--untracked-files=all", "--", ...CONTENT_PATHSPECS]),
    git(["rev-list", "--count", "@{upstream}..HEAD"]),
  ]);
  const files = parseStatus(status.stdout).filter(isContentPath);
  let oldest: number | null = null;
  for (const f of files) {
    try {
      const st = await fs.stat(/*turbopackIgnore: true*/ path.join(repo(), f));
      oldest = oldest === null ? st.mtimeMs : Math.min(oldest, st.mtimeMs);
    } catch {
      /* fichier supprimé : pas de date */
    }
  }
  return {
    isRepo: true,
    branch: branch.code === 0 ? branch.stdout.trim() : null,
    files,
    count: files.length,
    ahead: ahead.code === 0 ? Number(ahead.stdout.trim()) || 0 : 0,
    oldestDays: oldest === null ? null : Math.floor((Date.now() - oldest) / 86_400_000),
    pushCheck: await readPushCheck(),
  };
}

/* ------------------------------------------------------------------ */
/* Contrôle des secrets (lignes ajoutées)                              */
/* ------------------------------------------------------------------ */

const SECRET_PATTERNS: [RegExp, string][] = [
  [/webcals?:\/\//i, "lien d'abonnement de calendrier (webcal)"],
  [/https?:\/\/\S+\.ics\b/i, "lien d'abonnement de calendrier (.ics)"],
  [/client_secret|refresh_token|access_token|id_token/i, "jeton ou secret d'application"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "clé privée"],
  [/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|xox[abp]-[A-Za-z0-9-]{20,}|sk-[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16})\b/, "clé d'API"],
  [/https?:\/\/[^\s)]*[?&](?:token|key|apikey|api_key|secret|sig|signature|auth)=[^\s&)]{8,}/i, "lien contenant une clé personnelle"],
  [/myft\/[a-z0-9-]{20,}/i, "flux myFT personnel"],
];

/** Lignes ajoutées suspectes, par fichier. */
export function findSecrets(diff: string): { file: string; reason: string }[] {
  const found: { file: string; reason: string }[] = [];
  let file = "";
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) {
      file = line.replace(/^\+\+\+ (b\/)?/, "");
      continue;
    }
    if (!line.startsWith("+") || line.startsWith("+++")) continue;
    const added = line.slice(1);
    const hit = SECRET_PATTERNS.find(([re]) => re.test(added));
    // Les liens d'articles (souvent longs) sont retirés avant le contrôle générique.
    const reason = hit?.[1] ?? detectSensitive(added.replace(/https?:\/\/\S+/g, ""));
    if (reason && !found.some((f) => f.file === file && f.reason === reason)) found.push({ file, reason });
  }
  return found;
}

/* ------------------------------------------------------------------ */
/* Message de commit en français                                        */
/* ------------------------------------------------------------------ */

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export function buildMessage(nameStatus: string, diff: string): string {
  const parts = nameStatus.split("\0").filter(Boolean);
  const changes: { status: string; path: string; from?: string }[] = [];
  for (let i = 0; i < parts.length; i++) {
    const status = parts[i];
    if (/^[RC]/.test(status)) {
      changes.push({ status: status[0], from: parts[i + 1], path: parts[i + 2] });
      i += 2;
    } else {
      changes.push({ status: status[0], path: parts[i + 1] });
      i += 1;
    }
  }

  // Titres « ## » ajoutés / retirés par fichier (entrées de mémo, notions, favoris…).
  const headings = new Map<string, { add: number; del: number }>();
  let file = "";
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) file = line.replace(/^\+\+\+ (b\/)?/, "");
    else if (/^\+## /.test(line)) headings.set(file, { ...(headings.get(file) ?? { add: 0, del: 0 }), add: (headings.get(file)?.add ?? 0) + 1 });
    else if (/^-## /.test(line)) headings.set(file, { ...(headings.get(file) ?? { add: 0, del: 0 }), del: (headings.get(file)?.del ?? 0) + 1 });
  }
  const NOUNS: Record<string, [string, string, string]> = {
    "MEMO.md": ["mémo", "mémos", "ajouté"],
    "NOTIONS.md": ["notion", "notions", "ajoutée"],
    "FAVORIS.md": ["favori", "favoris", "ajouté"],
    "NEWS.md": ["source", "sources", "ajoutée"],
  };

  const out: string[] = [];
  const done = new Set<string>();
  for (const c of changes) {
    const p = c.path;
    const slug = p.split("/")[1];
    if (c.status === "R" && c.from?.startsWith("projects/") && p.startsWith("archive/")) {
      if (!done.has(`arch:${slug}`)) out.push(`projet ${slug} archivé`);
      done.add(`arch:${slug}`);
      done.add(`proj:${slug}`);
    } else if (p.startsWith("projects/") || p.startsWith("areas/")) {
      const kind = p.startsWith("projects/") ? "projet" : "domaine";
      const key = `${kind}:${slug}`;
      if (done.has(key) || done.has(`proj:${slug}`)) continue;
      done.add(key);
      out.push(`${kind} ${slug} ${c.status === "A" ? "créé" : c.status === "D" ? "retiré" : "modifié"}`);
    } else if (p.startsWith("reviews/")) {
      out.push(`revue ${p.replace(/^reviews\/|\.md$/g, "")} ${c.status === "A" ? "ajoutée" : "modifiée"}`);
    } else if (p.startsWith("archive/")) {
      if (!done.has(`arch:${slug}`)) out.push(`archive ${slug} modifiée`);
      done.add(`arch:${slug}`);
    } else {
      const h = headings.get(p);
      const noun = NOUNS[p];
      if (noun && h && (h.add || h.del)) {
        const bits = [];
        const net = h.add - h.del;
        if (net > 0) bits.push(`${plural(net, noun[0], noun[1])} ${noun[2]}${net > 1 ? "s" : ""}`);
        else if (net < 0) bits.push(`${plural(-net, noun[0], noun[1])} supprimé${noun[2].endsWith("e") ? "e" : ""}${-net > 1 ? "s" : ""}`);
        else bits.push("modifié");
        out.push(`${p}, ${bits.join(", ")}`);
      } else {
        out.push(`${p}${c.status === "A" ? " créé" : c.status === "D" ? " supprimé" : ""}`);
      }
    }
  }
  const summary = out.slice(0, 6).join(" ; ") + (out.length > 6 ? ` ; et ${out.length - 6} autre(s)` : "");
  const files = changes.map((c) => `- ${c.status} ${c.path}`).join("\n");
  return `Contenu : ${summary}\n\nSauvegarde depuis le dashboard.\n\n${files}\n`;
}

/* ------------------------------------------------------------------ */
/* Sauvegarde                                                           */
/* ------------------------------------------------------------------ */

export type SaveResult =
  | { kind: "needs-confirmation"; branch: string }
  | { kind: "nothing" }
  | { kind: "ok"; message: string | null; pushed: true }
  | { kind: "error"; stage: "check" | "secrets" | "commit" | "pull" | "push"; message: string; committed: boolean };

let running: Promise<SaveResult> | null = null;

const dirExists = (rel: string) =>
  fs.stat(/*turbopackIgnore: true*/ path.join(repo(), rel)).then((s) => s.isDirectory(), () => false);

/** Une seule sauvegarde à la fois. */
export function save(confirmOtherBranch: boolean): Promise<SaveResult> {
  if (!running) running = doSave(confirmOtherBranch).finally(() => (running = null));
  return running;
}

async function rebaseInProgress() {
  const gitDir = (await git(["rev-parse", "--git-dir"])).stdout.trim() || ".git";
  const abs = path.isAbsolute(gitDir) ? gitDir : path.join(/*turbopackIgnore: true*/ repo(), gitDir);
  const has = (p: string) => fs.access(/*turbopackIgnore: true*/ path.join(abs, p)).then(() => true, () => false);
  return (await has("rebase-merge")) || (await has("rebase-apply")) || (await has("MERGE_HEAD"));
}

function explainPush(stderr: string): string {
  if (/could not read Username|Authentication failed|terminal prompts disabled|Permission denied|403|denied to/i.test(stderr)) {
    return "GitHub a refusé l'envoi : ton ordinateur n'est pas connecté à GitHub pour ce dépôt (identifiants manquants ou expirés). Ta sauvegarde est gardée sur ton ordinateur. Voir app/README.md, « Envoyer sur GitHub sans mot de passe ».";
  }
  if (/Could not resolve host|unable to access|timed out|Connection refused|network/i.test(stderr)) {
    return "Impossible de joindre GitHub (pas de connexion internet ?). Ta sauvegarde est gardée sur ton ordinateur ; clique à nouveau sur « Sauvegarder » plus tard pour l'envoyer.";
  }
  if (/rejected|non-fast-forward|fetch first/i.test(stderr)) {
    return "GitHub a reçu d'autres modifications entre-temps. Ta sauvegarde est gardée sur ton ordinateur ; clique à nouveau sur « Sauvegarder » pour réessayer.";
  }
  return `L'envoi vers GitHub a échoué (${stderr.trim().split("\n").pop()?.slice(0, 160) ?? "erreur inconnue"}). Ta sauvegarde est gardée sur ton ordinateur.`;
}

async function doSave(confirmOtherBranch: boolean): Promise<SaveResult> {
  const st = await saveStatus();
  if (!st.isRepo) return { kind: "error", stage: "check", message: "Le dossier du dashboard n'est pas un dépôt git.", committed: false };
  if (await rebaseInProgress()) {
    return { kind: "error", stage: "check", message: "Une opération git est déjà en cours dans ce dossier (fusion ou rebase). Termine-la (par exemple dans GitHub Desktop) avant de sauvegarder.", committed: false };
  }
  if (st.count === 0 && st.ahead === 0) return { kind: "nothing" };
  if (st.branch !== "main" && !confirmOtherBranch) return { kind: "needs-confirmation", branch: st.branch ?? "(inconnue)" };

  let message: string | null = null;
  if (st.count > 0) {
    // Rien ne doit déjà être indexé en dehors du contenu (on ne commite que ce qu'on a choisi).
    const pre = await git(["diff", "--cached", "--name-only", "-z"]);
    const preStaged = pre.stdout.split("\0").filter(Boolean);
    if (preStaged.some((p) => !isContentPath(p))) {
      return { kind: "error", stage: "check", message: `Des fichiers hors contenu sont déjà préparés pour un commit (${preStaged.filter((p) => !isContentPath(p)).slice(0, 3).join(", ")}). Ils ne seront pas sauvegardés par le dashboard : retire-les de l'index (par exemple dans GitHub Desktop) puis recommence.`, committed: false };
    }

    // git refuse un chemin qui n'existe nulle part : on ne garde que les dossiers présents
    // (ou contenant une suppression). La liste reste fixe : jamais construite depuis une saisie.
    const specs: string[] = [];
    for (const spec of CONTENT_PATHSPECS) {
      if (spec.startsWith(":")) specs.push(spec);
      else if (st.files.some((f) => f.startsWith(`${spec}/`)) || (await dirExists(spec))) specs.push(spec);
    }
    const add = await git(["add", "--all", "--", ...specs]);
    if (add.code !== 0) return { kind: "error", stage: "commit", message: `Préparation impossible : ${add.stderr.trim().slice(0, 200)}`, committed: false };

    const staged = (await git(["diff", "--cached", "--name-only", "-z"])).stdout.split("\0").filter(Boolean);
    const outside = staged.filter((p) => !isContentPath(p));
    const diff = (await git(["diff", "--cached", "--no-color", "--no-ext-diff", "-U0"])).stdout;
    const secrets = findSecrets(diff);
    if (outside.length || secrets.length) {
      await git(["reset", "-q"]); // retire de l'index ; les fichiers eux-mêmes ne bougent pas
      const why = outside.length
        ? `fichiers hors contenu détectés (${outside.slice(0, 3).join(", ")})`
        : secrets.map((s) => `${s.file} : ${s.reason}`).join(" ; ");
      return { kind: "error", stage: "secrets", message: `Sauvegarde annulée par sécurité : ${why}. Rien n'a été commité ; retire l'information concernée du fichier puis recommence.`, committed: false };
    }
    if (staged.length === 0) return { kind: "nothing" };

    message = buildMessage((await git(["diff", "--cached", "--name-status", "-z", "-M"])).stdout, diff);
    const commit = await git(["commit", "-q", "--no-verify", "-F", "-"], message);
    if (commit.code !== 0) {
      await git(["reset", "-q"]);
      const noIdentity = /Please tell me who you are|user\.email|user\.name/i.test(commit.stderr);
      return {
        kind: "error", stage: "commit", committed: false,
        message: noIdentity
          ? "git ne connaît pas encore ton nom et ton e-mail. Le plus simple : ouvre GitHub Desktop et connecte-toi (il les configure). Voir app/README.md, « Envoyer sur GitHub sans mot de passe »."
          : `Le commit a échoué : ${commit.stderr.trim().slice(0, 200)}`,
      };
    }
  }

  // Récupère les modifications de GitHub (rebase), sans jamais rien écraser.
  const upstream = await git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]);
  if (upstream.code === 0) {
    const pull = await git(["pull", "--rebase", "--autostash", "--no-edit", "--quiet"], undefined, 120_000);
    if (pull.code !== 0) {
      if (await rebaseInProgress()) {
        await git(["rebase", "--abort"]);
        return {
          kind: "error", stage: "pull", committed: true,
          message: "Conflit : un même passage a été modifié ici et sur GitHub. Tes fichiers n'ont pas été touchés et ta sauvegarde est gardée sur ton ordinateur, mais rien n'a été envoyé. Que faire : ouvre le dépôt dans GitHub Desktop, clique sur « Fetch origin » puis « Pull », choisis la bonne version pour chaque fichier en conflit, puis reviens cliquer sur « Sauvegarder ».",
        };
      }
      return { kind: "error", stage: "pull", committed: true, message: explainPush(pull.stderr) };
    }
  }

  const push = upstream.code === 0
    ? await git(["push", "--quiet"], undefined, 120_000)
    : await git(["push", "--quiet", "--set-upstream", "origin", "HEAD"], undefined, 120_000);
  if (push.code !== 0) {
    if (/could not read Username|Authentication failed|terminal prompts disabled|Permission denied|403|denied to/i.test(push.stderr)) await writePushCheck("auth");
    return { kind: "error", stage: "push", committed: true, message: explainPush(push.stderr) };
  }
  await writePushCheck("ok");
  return { kind: "ok", message, pushed: true };
}


