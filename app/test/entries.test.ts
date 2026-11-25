import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "entries-test-"));
const repoRoot = path.resolve(__dirname, "../..");
for (const p of ["projects/_template", "areas/_template", "reviews", "INBOX.md"]) {
  fs.cpSync(path.join(repoRoot, p), path.join(dir, p), { recursive: true });
}
vi.stubEnv("CONTENT_DIR", dir);
vi.stubEnv("TZ", "Asia/Kuala_Lumpur");
const E = await import("@/lib/entries-edit");
const D = await import("@/lib/markdown-doc");
const { todayISO } = await import("@/lib/dates");
const today = todayISO();
const readme = (rel: string) => fs.readFileSync(path.join(dir, rel), "utf8");

describe("édition des projets et domaines", () => {
  it("crée un projet depuis le modèle simplifié (titre seul, idea/P3, deadline facultative)", async () => {
    const slug = await E.createEntry("project", "Site perso : refonte", "2026-12-07");
    expect(slug).toBe("site-perso-refonte");
    const t = readme("projects/site-perso-refonte/README.md");
    expect(t).toContain('title: "Site perso : refonte"');
    expect(t).toMatch(/status: idea\s+# idea \| active/); // commentaire du modèle conservé
    expect(t).toMatch(/priority: P3\s+#/);
    expect(t).toContain(`created: ${today}`);
    expect(t).toContain("deadline: 2026-12-07");
    expect(t).not.toMatch(/next_action|stage|## Objectif|## Journal/);
    expect(t).toContain("# Site perso : refonte");
    expect(t).toContain("## Notes");
    expect(await E.createEntry("project", "Site perso : refonte")).toBe("site-perso-refonte-2");
    const area = await E.createEntry("area", "Santé");
    expect(readme(`areas/${area}/README.md`)).toMatch(/status: active/);
    expect(readme("DASHBOARD.md")).toContain("- [Site perso : refonte](projects/site-perso-refonte/README.md) — idée");
    expect(readme("DASHBOARD.md")).toContain("- [Santé](areas/sante/README.md)");
  });

  it("notes du jour : écrire, modifier, vider ; updated mis à jour ; version périmée refusée", async () => {
    const slug = "site-perso-refonte";
    let e = (await E.readEditable("project", slug))!;
    expect(e.notes).toEqual([]);
    expect(e.legacy).toBe(false);
    await E.editEntry("project", slug, e.version, { op: "note", date: "2026-11-20", text: "Maquette **validée**." });
    e = (await E.readEditable("project", slug))!;
    await E.editEntry("project", slug, e.version, { op: "note", date: "2026-11-24", text: "Appel avec le graphiste." });
    e = (await E.readEditable("project", slug))!;
    expect(e.notes.map((n) => [n.date, n.text])).toEqual([["2026-11-24", "Appel avec le graphiste."], ["2026-11-20", "Maquette **validée**."]]);
    expect(e.fields.updated).toBe(today);
    await E.editEntry("project", slug, e.version, { op: "note", date: "2026-11-24", text: "" });
    e = (await E.readEditable("project", slug))!;
    expect(e.notes.map((n) => n.date)).toEqual(["2026-11-20"]);
    await expect(E.editEntry("project", slug, "ancienne", { op: "note", date: today, text: "x" })).rejects.toThrow(/modifié ailleurs/);
  });

  it("cocher une tâche liée l'inscrit dans la note du jour (et la retire si on décoche)", async () => {
    await E.recordDone("site-perso-refonte", "2026-11-20", "Choisir un thème", true);
    await E.recordDone("site-perso-refonte", "2026-11-20", "Choisir un thème", true); // sans doublon
    let e = (await E.readEditable("project", "site-perso-refonte"))!;
    expect(e.notes[0]).toEqual({ date: "2026-11-20", text: "Maquette **validée**.", done: ["Choisir un thème"] });
    await E.recordDone("site-perso-refonte", "2026-11-20", "Choisir un thème", false);
    e = (await E.readEditable("project", "site-perso-refonte"))!;
    expect(e.notes[0].done).toEqual([]);
    expect(await E.entryKindOf("sante")).toBe("area");
    expect(await E.entryKindOf("inconnu")).toBeNull();
  });

  it("champs : statut, priorité, deadline validés ; DASHBOARD.md suit", async () => {
    const slug = "site-perso-refonte";
    let e = (await E.readEditable("project", slug))!;
    await E.editEntry("project", slug, e.version, { op: "fields", fields: { status: "active", priority: "P1", deadline: "2026-12-01" } });
    e = (await E.readEditable("project", slug))!;
    expect(e.fields).toMatchObject({ status: "active", priority: "P1", deadline: "2026-12-01", updated: today });
    expect(readme("DASHBOARD.md")).toContain("| [Site perso : refonte](projects/site-perso-refonte/README.md) | P1 | active |");
    await expect(E.editEntry("project", slug, e.version, { op: "fields", fields: { status: "fini" } })).rejects.toThrow(/Statut/);
    await expect(E.editEntry("project", slug, e.version, { op: "fields", fields: { next_action: "x" } })).rejects.toThrow(/non modifiable/);
    await expect(E.editEntry("project", slug, e.version, { op: "fields", fields: { deadline: "01/12/2026" } })).rejects.toThrow(/Date/);
  });

  it("done/dropped : confirmation obligatoire puis déplacement dans archive/", async () => {
    const slug = "site-perso-refonte-2";
    let e = (await E.readEditable("project", slug))!;
    await expect(E.editEntry("project", slug, e.version, { op: "fields", fields: { status: "done" } })).rejects.toThrow(/Confirmation/);
    e = (await E.readEditable("project", slug))!;
    const res = await E.editEntry("project", slug, e.version, { op: "fields", fields: { status: "done" } }, true);
    expect(res.archivedTo).toBe(slug);
    expect(fs.existsSync(path.join(dir, "projects", slug))).toBe(false);
    expect(readme(`archive/${slug}/README.md`)).toMatch(/status: done/);
    expect(readme("DASHBOARD.md")).not.toContain(slug);
  });

  it("refuse les secrets et les titres de section dans une note", async () => {
    const e = (await E.readEditable("project", "site-perso-refonte"))!;
    await expect(E.editEntry("project", "site-perso-refonte", e.version, { op: "note", date: today, text: "mdp: hunter2" })).rejects.toThrow(/mot de passe/);
    await expect(E.editEntry("project", "site-perso-refonte", e.version, { op: "note", date: today, text: "## Pirate" })).rejects.toThrow(/titres/);
  });

  it("guillemets YAML quand il le faut", () => {
    expect(D.yamlValue("TODO: fill in")).toBe('"TODO: fill in"');
    expect(D.yamlValue("Simple")).toBe("Simple");
    expect(D.yamlValue("2026-12-01")).toBe("2026-12-01");
    expect(D.yamlValue("yes")).toBe('"yes"');
  });
});

describe("suppression d'un projet", () => {
  it("refuse sans la bonne version, puis efface tout le dossier et met DASHBOARD.md à jour", async () => {
    const slug = await E.createEntry("project", "À effacer");
    fs.mkdirSync(path.join(dir, "projects", slug, "docs"), { recursive: true });
    fs.writeFileSync(path.join(dir, "projects", slug, "docs", "brief.md"), "---\ntitle: Brief\n---\n");
    expect(await E.projectContents(slug)).toMatchObject({ docs: 1, images: 0 });
    await expect(E.deleteProject(slug, "mauvaise-version")).rejects.toThrow(/modifié ailleurs/);
    expect(fs.existsSync(path.join(dir, "projects", slug))).toBe(true);
    const e = (await E.readEditable("project", slug))!;
    expect(await E.deleteProject(slug, e.version)).toEqual({ title: "À effacer" });
    expect(fs.existsSync(path.join(dir, "projects", slug))).toBe(false);
    expect(fs.existsSync(path.join(dir, "projects", "_template"))).toBe(true);
    expect(readme("DASHBOARD.md")).not.toContain(slug);
  });

  it("refuse les noms invalides, le modèle et un projet absent", async () => {
    await expect(E.deleteProject("../areas", "x")).rejects.toThrow();
    await expect(E.deleteProject("_template", "x")).rejects.toThrow();
    await expect(E.deleteProject("inexistant", "x")).rejects.toThrow(/n'existe plus/);
  });
});
