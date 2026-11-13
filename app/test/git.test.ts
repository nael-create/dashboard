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
