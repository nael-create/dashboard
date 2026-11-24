import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "save-test-"));
const remote = path.join(root, "remote.git");
const A = path.join(root, "a"); // l'ordinateur du dashboard
const B = path.join(root, "b"); // « quelqu'un d'autre » (ou GitHub en ligne)
const env = { GIT_AUTHOR_NAME: "Test", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "Test", GIT_COMMITTER_EMAIL: "t@example.invalid" };
Object.assign(process.env, env);
const sh = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, env: { ...process.env, ...env }, encoding: "utf8" });
vi.stubEnv("CONTENT_DIR", A);
vi.stubEnv("DASHBOARD_DATA_DIR", path.join(root, "data"));

const G = await import("@/lib/git");
const write = (dir: string, rel: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};
const read = (rel: string) => fs.readFileSync(path.join(A, rel), "utf8");

beforeAll(() => {
  sh(root, "init", "-q", "--bare", "--initial-branch=main", remote);
  sh(root, "clone", "-q", remote, A);
  write(A, ".gitignore", "app/data/*\n");
  write(A, "MEMO.md", "# Mémo\n\nligne commune\n");
  write(A, "app/code.ts", "export {};\n");
  sh(A, "add", "-A");
  sh(A, "commit", "-qm", "init");
  sh(A, "push", "-q", "-u", "origin", "main");
  sh(root, "clone", "-q", remote, B);
});

describe("bouton Sauvegarder", () => {
  it("ne compte et ne sauvegarde que le contenu (jamais app/ ni app/data/)", async () => {
    write(A, "MEMO.md", "# Mémo\n\n## 2026-11-13 — A\nid: 20261113-1\npinned: no\ntags:\n\nligne commune\n");
    write(A, "NOTIONS.md", "# Notions\n\n## Spread\nadded: 2026-11-13\n\nécart\n");
    write(A, "projects/site/README.md", "---\ntitle: Site\n---\n");
    write(A, "app/code.ts", "export const changé = 1;\n");
    write(A, "app/data/calendars.local.json", "{\"secret\":true}\n");
    const st = await G.saveStatus();
    expect(st.files.sort()).toEqual(["MEMO.md", "NOTIONS.md", "projects/site/README.md"]);
    const res = await G.save(false);
    expect(res.kind).toBe("ok");
    const log = sh(A, "log", "-1", "--format=%B");
    expect(log).toContain("Contenu : MEMO.md, 1 mémo ajouté ; NOTIONS.md, 1 notion ajoutée ; projet site créé");
    const files = sh(A, "show", "--name-only", "--format=", "HEAD").trim().split("\n").sort();
    expect(files).toEqual(["MEMO.md", "NOTIONS.md", "projects/site/README.md"]);
    expect(sh(A, "status", "--porcelain")).toContain(" M app/code.ts"); // code non touché
    expect(sh(remote, "log", "-1", "--format=%s", "main")).toMatch(/^Contenu :/); // envoyé
    expect((await G.saveStatus()).count).toBe(0);
  });

  it("refuse (sans rien commiter) un secret dans le contenu", async () => {
    const before = read("MEMO.md");
    write(A, "MEMO.md", before + "\nAgenda : webcal://p01-caldav.icloud.com/published/2/ABCDEF\n");
    const res = await G.save(false);
    expect(res).toMatchObject({ kind: "error", stage: "secrets", committed: false });
    expect(sh(A, "diff", "--cached", "--name-only").trim()).toBe(""); // index propre
    expect(read("MEMO.md")).toContain("webcal://"); // fichier intact
    write(A, "MEMO.md", before);
  });

  it("demande confirmation hors de la branche main", async () => {
    sh(A, "checkout", "-q", "-b", "essai");
    write(A, "INBOX.md", "# Inbox\n\n- [ ] 2026-11-13 — truc\n");
    expect(await G.save(false)).toEqual({ kind: "needs-confirmation", branch: "essai" });
    expect(sh(A, "log", "-1", "--format=%s")).not.toMatch(/INBOX/);
    const res = await G.save(true);
    expect(res.kind).toBe("ok");
    expect(sh(remote, "log", "-1", "--format=%s", "essai")).toContain("INBOX.md");
    sh(A, "checkout", "-q", "main");
  });

  it("conflit au pull : rebase annulé, fichiers intacts, commit local gardé, jamais de push forcé", async () => {
    sh(B, "pull", "-q");
    write(B, "MEMO.md", read("MEMO.md").replace("ligne commune", "version de B"));
    sh(B, "commit", "-qam", "B");
    sh(B, "push", "-q");
    write(A, "MEMO.md", read("MEMO.md").replace("ligne commune", "version de A"));
    const res = await G.save(false);
    expect(res).toMatchObject({ kind: "error", stage: "pull", committed: true });
    expect(read("MEMO.md")).toContain("version de A");
    expect(read("MEMO.md")).not.toContain("<<<<<<<");
    expect(sh(A, "status")).not.toMatch(/rebase in progress/);
    expect(sh(remote, "log", "-1", "--format=%s", "main")).toBe("B\n"); // GitHub intact
    expect((await G.saveStatus()).ahead).toBe(1);
    // Résolution : on aligne A sur B puis on resauvegarde.
    sh(A, "reset", "-q", "--hard", "origin/main");
  });

  it("échec du push : le commit local est gardé et le message explique", async () => {
    sh(A, "pull", "-q");
    sh(A, "remote", "set-url", "origin", path.join(root, "introuvable.git"));
    write(A, "NOTIONS.md", read("NOTIONS.md") + "\n## Duration\nadded: 2026-11-13\n\nsensibilité\n");
    const res = await G.save(false);
    expect(res).toMatchObject({ kind: "error", committed: true });
    expect(sh(A, "log", "-1", "--format=%s")).toContain("NOTIONS.md, 1 notion ajoutée");
    sh(A, "remote", "set-url", "origin", remote);
    // Nouvelle tentative : rien à commiter, mais le commit en attente est envoyé.
    expect((await G.saveStatus()).ahead).toBe(1);
    expect((await G.save(false)).kind).toBe("ok");
    expect((await G.saveStatus()).ahead).toBe(0);
  });

  it("chemins autorisés", () => {
    expect(["MEMO.md", "projects/x/README.md", "reviews/2026-W46.md", "archive/x/README.md"].every(G.isContentPath)).toBe(true);
    expect(["app/src/a.ts", "app/data/news.local.json", ".env.local", "projects/.env", "docs/x.md"].some(G.isContentPath)).toBe(false);
  });
});

describe("synchro automatique de TACHES.md", () => {
  it("ne commite et n'envoie que TACHES.md, même si d'autres fichiers sont modifiés ou préparés", async () => {
    sh(A, "checkout", "-q", "main");
    sh(A, "pull", "-q", "--rebase");
    write(A, "TACHES.md", "# Tâches\n\n- [ ] 2026-11-24 Appeler la banque id:t-20261124-1\n");
    write(A, "NOTIONS.md", read("NOTIONS.md") + "\n## Autre\nadded: 2026-11-24\n\nx\n");
    write(A, "INBOX.md", "# Inbox\n");
    sh(A, "add", "INBOX.md");
    const res = await G.syncTasksFile();
    expect(res).toEqual({ kind: "ok", committed: true });
    expect(sh(A, "show", "--name-only", "--format=%s", "HEAD").trim().split("\n").filter(Boolean)).toEqual(["Tâches : TACHES.md mis à jour", "TACHES.md"]);
    expect(sh(remote, "log", "-1", "--format=%s", "main").trim()).toBe("Tâches : TACHES.md mis à jour");
    const st = sh(A, "status", "--porcelain");
    expect(st).toContain(" M NOTIONS.md");
    expect(st).toContain("A  INBOX.md");
    sh(A, "reset", "-q");
    fs.rmSync(path.join(A, "INBOX.md"));
    sh(A, "checkout", "-q", "--", "NOTIONS.md");
  });

  it("récupère d'abord les modifications de GitHub (rebase), sans push forcé", async () => {
    sh(B, "pull", "-q", "--rebase");
    write(B, "NEWS.md", "# News\n");
    sh(B, "add", "NEWS.md");
    sh(B, "commit", "-qm", "ailleurs");
    sh(B, "push", "-q");
    write(A, "TACHES.md", read("TACHES.md") + "- [ ] 2026-11-25 Deuxième id:t-20261124-2\n");
    expect(await G.syncTasksFile()).toEqual({ kind: "ok", committed: true });
    expect(sh(remote, "log", "-2", "--format=%s", "main").trim().split("\n")).toEqual(["Tâches : TACHES.md mis à jour", "ailleurs"]);
  });

  it("refuse un secret dans TACHES.md (rien n'est commité)", async () => {
    const before = sh(A, "rev-parse", "HEAD");
    write(A, "TACHES.md", read("TACHES.md") + "- [ ] 2026-11-25 mot de passe : hunter22 id:t-20261124-3\n");
    const res = await G.syncTasksFile();
    expect(res).toMatchObject({ kind: "error", committed: false });
    expect(sh(A, "rev-parse", "HEAD")).toBe(before);
    expect(sh(A, "diff", "--cached", "--name-only").trim()).toBe("");
    sh(A, "checkout", "-q", "--", "TACHES.md");
  });

  it("hors de main : rien n'est fait", async () => {
    sh(A, "checkout", "-q", "-b", "essai-sync");
    write(A, "TACHES.md", read("TACHES.md") + "- [ ] 2026-11-26 Trois id:t-20261124-4\n");
    expect((await G.syncTasksFile()).kind).toBe("skipped");
    sh(A, "checkout", "-q", "--", "TACHES.md");
    sh(A, "checkout", "-q", "main");
  });
});
