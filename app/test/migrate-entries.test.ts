import { describe, expect, it } from "vitest";
import { isTrivial, migrateReadme } from "@/lib/migrate-entries";

const OLD = `---
title: "Site perso"
status: active          # idea | active | paused | done | dropped
priority: P1
stage: realisation      # idee | …
created: 2026-10-20
updated: 2026-11-24
started:
next_action: Écrire la page À propos
deadline: 2026-12-20
tags:
---

# Site perso

## Objectif

Un site **simple**.

## Pourquoi

TODO: fill in

## Prochaines actions

- [ ] Choisir les photos
- [ ] TODO: fill in

## Notes

Idées en vrac.

## Liens

- TODO: fill in

## Section perso

À garder.

## Jalons

<!-- aide -->
- [x] 2026-11-10 — Maquettes validées
- [ ] 2026-12-05 — Bêta en ligne

## Journal

<!-- Entrées datées -->

- 2026-11-12 — Fait : Choisir un thème
- 2026-11-10 — Jalon atteint : Maquettes validées
- 2026-10-20 — Création du projet.
`;

describe("migration des projets", () => {
  it("rien n'est perdu : actions, next_action, jalons → tâches ; journal et contenus → notes datées", () => {
    const r = migrateReadme(OLD, "project", "site", new Set(), "2026-11-25");
    expect(r.tasks).toEqual([
      { status: "todo", date: null, title: "Écrire la page À propos", project: "site", closedOn: null },
      { status: "todo", date: null, title: "Choisir les photos", project: "site", closedOn: null },
      { status: "done", date: "2026-11-10", title: "Maquettes validées", project: "site", closedOn: "2026-11-10" },
      { status: "todo", date: "2026-12-05", title: "Bêta en ligne", project: "site", closedOn: null },
    ]);
    const t = r.text;
    for (const gone of ["stage:", "next_action:", "started:", "tags:", "## Objectif", "## Pourquoi", "## Prochaines actions", "## Jalons", "## Journal", "## Liens"]) expect(t).not.toContain(gone);
    expect(t).toContain("deadline: 2026-12-20");
    expect(t).toContain("## Section perso\n\nÀ garder.");
    expect(t).toContain("### 2026-11-24\n\n**Ancien contenu : Notes**\n\nIdées en vrac.\n\n**Ancien contenu : Objectif**\n\nUn site **simple**.\n");
    expect(t).toContain("### 2026-11-12\n\n✓ Choisir un thème");
    expect(t).toContain("### 2026-11-10\n\n✓ Maquettes validées");
    expect(t).toContain("### 2026-10-20\n\nCréation du projet.");
    expect(t.indexOf("### 2026-11-24")).toBeLessThan(t.indexOf("### 2026-11-12"));
  });

  it("idempotente : relancée sur le résultat, ne change rien et ne crée pas de doublon", () => {
    const r = migrateReadme(OLD, "project", "site", new Set(), "2026-11-25");
    const again = migrateReadme(r.text, "project", "site", new Set(r.tasks.map((x) => x.title)), "2026-11-25");
    expect(again.changed).toBe(false);
    expect(again.tasks).toEqual([]);
  });

  it("ne recrée pas une tâche qui existe déjà dans TACHES.md", () => {
    const r = migrateReadme(OLD, "project", "site", new Set(["Choisir les photos"]), "2026-11-25");
    expect(r.tasks.map((x) => x.title)).not.toContain("Choisir les photos");
  });

  it("domaines : Rôle et Standards vides supprimés", () => {
    const area = "---\ntitle: Santé\nstatus: active\npriority: P3\ncreated: 2026-11-01\nupdated: 2026-11-01\n---\n\n# Santé\n\n## Rôle\n\nTODO: fill in\n\n## Standards à maintenir\n\n- TODO: fill in\n\n## Notes\n\nTODO: fill in\n";
    const r = migrateReadme(area, "area", "sante", new Set(), "2026-11-25");
    expect(r.text).toBe("---\ntitle: Santé\nstatus: active\npriority: P3\ncreated: 2026-11-01\nupdated: 2026-11-01\n---\n\n# Santé\n\n## Notes\n");
    expect(r.tasks).toEqual([]);
  });

  it("contenu « vide »", () => {
    expect(isTrivial("TODO: fill in")).toBe(true);
    expect(isTrivial("- TODO: fill in\n<!-- aide -->")).toBe(true);
    expect(isTrivial("- [ ] TODO: fill in")).toBe(true);
    expect(isTrivial("Un vrai texte")).toBe(false);
  });
});

describe("frontmatter : champ vide suivi d'un commentaire", async () => {
  const { fmValue, fmField } = await import("@/lib/markdown-doc");
  it("« deadline:   # optionnel » est vide ; guillemets et commentaires gérés", () => {
    expect(fmValue("              # optionnel, YYYY-MM-DD")).toBe("");
    expect(fmValue(' "TODO: fill in"  # x')).toBe("TODO: fill in");
    expect(fmValue(" 2026-12-01 # c")).toBe("2026-12-01");
    expect(fmValue(" C# app")).toBe("C# app");
    expect(fmField("---\ntitle: A\ndeadline:   # optionnel\n---\n", "deadline")).toBe("");
    expect(fmField("---\ntitle: A\n---\n", "deadline")).toBeNull();
  });
});
