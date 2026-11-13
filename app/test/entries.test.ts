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
  it("crée un projet depuis le template (titre seul, idea/P3, le reste TODO)", async () => {
    const slug = await E.createEntry("project", "Site perso : refonte");
    expect(slug).toBe("site-perso-refonte");
    const t = readme("projects/site-perso-refonte/README.md");
    expect(t).toContain('title: "Site perso : refonte"');
    expect(t).toMatch(/status: idea\s+# idea \| active/); // commentaire du template conservé
    expect(t).toMatch(/priority: P3\s+#/);
    expect(t).toContain(`created: ${today}`);
    expect(t).toContain('next_action: "TODO: fill in"');
    expect(t).toContain("# Site perso : refonte");
    expect(t).toContain(`- ${today} — Création du projet.`);
    expect(await E.createEntry("project", "Site perso : refonte")).toBe("site-perso-refonte-2");
    const area = await E.createEntry("area", "Santé");
    expect(readme(`areas/${area}/README.md`)).toMatch(/status: active/);
    // DASHBOARD.md régénéré
    expect(readme("DASHBOARD.md")).toContain("- [Site perso : refonte](projects/site-perso-refonte/README.md) — idée");
    expect(readme("DASHBOARD.md")).toContain("- [Santé](areas/sante/README.md)");
  });

  it("actions : ajout (remplace TODO), modification, ordre, cocher → journal daté", async () => {
    const slug = "site-perso-refonte";
    let e = (await E.readEditable("project", slug))!;
    expect(e.actions).toEqual([{ text: "TODO: fill in", done: false }]);
    await E.editEntry("project", slug, e.version, { op: "action-add", text: "Choisir un thème" });
    e = (await E.readEditable("project", slug))!;
    await E.editEntry("project", slug, e.version, { op: "action-add", text: "Écrire la page À propos" });
    e = (await E.readEditable("project", slug))!;
    expect(e.actions.map((a) => a.text)).toEqual(["Choisir un thème", "Écrire la page À propos"]);
    await E.editEntry("project", slug, e.version, { op: "action-move", index: 1, text: "Écrire la page À propos", dir: -1 });
    e = (await E.readEditable("project", slug))!;
    await E.editEntry("project", slug, e.version, { op: "action-edit", index: 0, text: "Écrire la page À propos", newText: "Écrire la page « À propos »" });
    e = (await E.readEditable("project", slug))!;
    await E.editEntry("project", slug, e.version, { op: "action-check", index: 1, text: "Choisir un thème" });
    e = (await E.readEditable("project", slug))!;
    expect(e.actions.map((a) => a.text)).toEqual(["Écrire la page « À propos »"]);
    expect(e.journal[0]).toEqual({ date: today, text: "Fait : Choisir un thème" });
    expect(e.journal[1].text).toBe("Création du projet.");
    // Version périmée → refus
    await expect(E.editEntry("project", slug, "ancienne", { op: "journal-add", text: "x" })).rejects.toThrow(/modifié ailleurs/);
  });

  it("champs, sections, journal ; updated mis à jour ; DASHBOARD.md suit", async () => {
    const slug = "site-perso-refonte";
    let e = (await E.readEditable("project", slug))!;
    await E.editEntry("project", slug, e.version, { op: "fields", fields: { status: "active", priority: "P1", next_action: "Écrire la page « À propos »", deadline: "2026-12-01" } });
    e = (await E.readEditable("project", slug))!;
    await E.editEntry("project", slug, e.version, { op: "section", name: "Objectif", text: "Un site **simple**.\n\n- léger\n- rapide" });
    e = (await E.readEditable("project", slug))!;
    await E.editEntry("project", slug, e.version, { op: "journal-add", text: "Maquette validée", date: "2026-11-12" });
    e = (await E.readEditable("project", slug))!;
    expect(e.fields).toMatchObject({ status: "active", priority: "P1", deadline: "2026-12-01", updated: today });
    expect(e.sections.Objectif).toBe("Un site **simple**.\n\n- léger\n- rapide");
    expect(e.journal[0].text).toBe("Maquette validée");
    const t = readme(`projects/${slug}/README.md`);
    expect(t).toContain("## Objectif\n\nUn site **simple**.\n\n- léger\n- rapide\n\n## Prochaines actions");
    expect(readme("DASHBOARD.md")).toContain("| [Site perso : refonte](projects/site-perso-refonte/README.md) | P1 | active | Écrire la page « À propos » | 2026-12-01 |");
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

  it("refuse les secrets et les titres de section dans le texte", async () => {
    const e = (await E.readEditable("project", "site-perso-refonte"))!;
    await expect(E.editEntry("project", "site-perso-refonte", e.version, { op: "section", name: "Notes", text: "mdp: hunter2" })).rejects.toThrow(/mot de passe/);
    await expect(E.editEntry("project", "site-perso-refonte", e.version, { op: "section", name: "Notes", text: "## Pirate" })).rejects.toThrow(/titres/);
  });

  it("guillemets YAML quand il le faut", () => {
    expect(D.yamlValue("TODO: fill in")).toBe('"TODO: fill in"');
    expect(D.yamlValue("Simple")).toBe("Simple");
    expect(D.yamlValue("2026-12-01")).toBe("2026-12-01");
    expect(D.yamlValue("yes")).toBe('"yes"');
  });
});
