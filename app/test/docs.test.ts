import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "docs-test-"));
vi.stubEnv("CONTENT_DIR", dir);
vi.stubEnv("DASHBOARD_DATA_DIR", path.join(dir, "data"));

const D = await import("@/lib/docs");
const { linkify, headings, resolveWikiLink, wikiSuggestions, BROKEN_HREF } = await import("@/lib/wiki-links");
const T = "2026-11-24";
const P = path.join(dir, "projects", "alpha");
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

beforeEach(() => {
  fs.rmSync(path.join(dir, "projects"), { recursive: true, force: true });
  fs.mkdirSync(P, { recursive: true });
  fs.writeFileSync(path.join(P, "README.md"), "---\ntitle: Alpha\n---\n");
  const tpl = path.join(dir, "projects", "_template", "docs-templates");
  fs.mkdirSync(tpl, { recursive: true });
  fs.writeFileSync(path.join(tpl, "3-journal-de-decisions.md"), "---\ntitle: Journal de décisions\ndescription: \"Décisions datées\"\n---\n\nIntro.\n\n## Décisions\n\n<!-- aide -->\n");
});

describe("pages de docs", () => {
  it("crée (vide ou depuis un modèle), liste dans l'ordre, relit", async () => {
    const a = await D.createDoc("alpha", "Brief du projet", null, T);
    const b = await D.createDoc("alpha", "Décisions", "3-journal-de-decisions", T);
    const c = await D.createDoc("alpha", "Brief du projet", null, T);
    expect([a, b, c]).toEqual(["brief-du-projet", "decisions", "brief-du-projet-2"]);
    expect((await D.listDocs("alpha")).map((d) => [d.slug, d.order])).toEqual([["brief-du-projet", 1], ["decisions", 2], ["brief-du-projet-2", 3]]);
    const page = (await D.readDocPage("alpha", "decisions"))!;
    expect(page).toMatchObject({ title: "Décisions", created: T, updated: T });
    expect(page.body).toContain("## Décisions");
    expect(fs.readFileSync(path.join(P, "docs", "decisions.md"), "utf8").startsWith("---\ntitle: Décisions\ncreated: 2026-11-24\nupdated: 2026-11-24\norder: 2\n---\n")).toBe(true);
    expect((await D.listTemplates()).map((t) => [t.id, t.title, t.description])).toEqual([["3-journal-de-decisions", "Journal de décisions", "Décisions datées"]]);
  });

  it("renommer garde le fichier (les liens restent valides) ; modifier le texte ; 409 si changé ailleurs", async () => {
    await D.createDoc("alpha", "Specs", null, T);
    let p = (await D.readDocPage("alpha", "specs"))!;
    await D.updateDoc("alpha", "specs", p.version, { title: "Spécifications v2" }, "2026-11-25");
    p = (await D.readDocPage("alpha", "specs"))!;
    expect(p).toMatchObject({ slug: "specs", title: "Spécifications v2", updated: "2026-11-25" });
    await D.updateDoc("alpha", "specs", p.version, { body: "## Contexte\n\nTexte." }, T);
    expect((await D.readDocPage("alpha", "specs"))!.body.trim()).toBe("## Contexte\n\nTexte.");
    await expect(D.updateDoc("alpha", "specs", p.version, { body: "x" }, T)).rejects.toThrow(/modifié ailleurs/);
  });

  it("réordonner", async () => {
    for (const t of ["A", "B", "C"]) await D.createDoc("alpha", t, null, T);
    await D.reorderDocs("alpha", ["c", "a", "b"]);
    expect((await D.listDocs("alpha")).map((d) => d.slug)).toEqual(["c", "a", "b"]);
    await expect(D.reorderDocs("alpha", ["c", "a"])).rejects.toThrow(/changé/);
  });

  it("supprimer = ranger dans docs/_archive/ (jamais effacé), nom libre ensuite", async () => {
    await D.createDoc("alpha", "Notes", null, T);
    const v = (await D.readDocPage("alpha", "notes"))!.version;
    const to = await D.archiveDoc("alpha", "notes", v, T);
    expect(to).toBe("projects/alpha/docs/_archive/notes.md");
    expect(fs.existsSync(path.join(P, "docs", "_archive", "notes.md"))).toBe(true);
    expect(await D.listDocs("alpha")).toEqual([]);
    expect(await D.createDoc("alpha", "Notes", null, T)).toBe("notes-2");
  });

  it("nouvelle décision : bloc daté en tête de « ## Décisions »", async () => {
    await D.createDoc("alpha", "Décisions", "3-journal-de-decisions", T);
    let v = (await D.readDocPage("alpha", "decisions"))!.version;
    await D.addDecision("alpha", "decisions", v, "Choisir Resend", T);
    v = (await D.readDocPage("alpha", "decisions"))!.version;
    await D.addDecision("alpha", "decisions", v, "Garder Next.js", "2026-11-25");
    const body = (await D.readDocPage("alpha", "decisions"))!.body;
    expect(body.indexOf("### 2026-11-25 — Garder Next.js")).toBeLessThan(body.indexOf("### 2026-11-24 — Choisir Resend"));
    expect(body.indexOf("<!-- aide -->")).toBeLessThan(body.indexOf("### 2026-11-25"));
  });

  it("refuse un secret et un projet inconnu", async () => {
    await expect(D.createDoc("alpha", "mot de passe : hunter22", null, T)).rejects.toThrow(/Non enregistré/);
    await expect(D.createDoc("inconnu", "X", null, T)).rejects.toThrow(/introuvable/);
    await expect(D.readDocPage("alpha", "../README")).rejects.toThrow();
  });

  it("images : signature vérifiée, 5 Mo max, rangées dans assets/", async () => {
    const name = await D.saveAsset("alpha", "Capture d'écran.png", PNG, new Date("2026-11-24T10:11:12Z"));
    expect(name).toBe("20261124-101112-capture-d-ecran.png");
    expect(fs.existsSync(path.join(P, "assets", name))).toBe(true);
    expect((await D.readAsset("alpha", name))?.type).toBe("image/png");
    await expect(D.saveAsset("alpha", "x.png", new TextEncoder().encode("<svg onload=alert(1)>"), new Date())).rejects.toThrow(/Format refusé/);
    await expect(D.saveAsset("alpha", "x.png", new Uint8Array(5 * 1024 * 1024 + 1).fill(0x89), new Date())).rejects.toThrow(/5 Mo/);
    expect(await D.readAsset("alpha", "../README.md")).toBeNull();
  });
});

describe("liens [[…]] et sommaire", () => {
  const ctx = {
    project: "alpha",
    projects: [{ slug: "alpha", title: "Alpha" }, { slug: "medtech", title: "Medtech" }],
    docs: [{ project: "alpha", slug: "brief", title: "Brief" }, { project: "medtech", slug: "specs", title: "Spécifications" }],
  };

  it("résout page du projet, page d'un autre projet, projet ; garde visible un lien cassé", () => {
    expect(resolveWikiLink("brief", ctx)?.href).toBe("/projets/alpha/docs/brief");
    expect(resolveWikiLink("Brief", ctx)?.href).toBe("/projets/alpha/docs/brief");
    expect(resolveWikiLink("medtech/specs", ctx)?.href).toBe("/projets/medtech/docs/specs");
    expect(resolveWikiLink("Medtech", ctx)?.href).toBe("/projets/medtech");
    expect(resolveWikiLink("specs", ctx)).toBeNull();
    const md = linkify("Voir [[brief]], [[medtech/specs|les specs]] et [[inconnu]]. `[[code]]`\n```\n[[bloc]]\n```", ctx);
    expect(md).toContain("[Brief](/projets/alpha/docs/brief)");
    expect(md).toContain("[les specs](/projets/medtech/docs/specs)");
    expect(md).toContain(`[inconnu](${BROKEN_HREF})`);
    expect(md).toContain("`[[code]]`");
    expect(md).toContain("[[bloc]]");
  });

  it("autocomplétion : pages du projet d'abord, puis autres pages et projets", () => {
    expect(wikiSuggestions("", ctx).map((s) => s.insert)).toEqual(["brief", "medtech/specs", "alpha", "medtech"]);
    expect(wikiSuggestions("spec", ctx).map((s) => s.insert)).toEqual(["medtech/specs"]);
  });

  it("sommaire : ## et ###, hors code, identifiants uniques", () => {
    const h = headings("# Titre\n\n## Contexte\n### Détail\n```\n## pas un titre\n```\n## Contexte\n");
    expect(h).toEqual([
      { level: 2, text: "Contexte", id: "contexte", line: 3 },
      { level: 3, text: "Détail", id: "detail", line: 4 },
      { level: 2, text: "Contexte", id: "contexte-2", line: 8 },
    ]);
  });
});
