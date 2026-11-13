import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "review-test-"));
const repoRoot = path.resolve(__dirname, "../..");
for (const p of ["projects/_template", "areas/_template", "reviews/_template.md", "INBOX.md"]) fs.cpSync(path.join(repoRoot, p), path.join(dir, p), { recursive: true });
vi.stubEnv("CONTENT_DIR", dir);
vi.stubEnv("DASHBOARD_DATA_DIR", path.join(dir, "data"));
const R = await import("@/lib/review");
const I = await import("@/lib/inbox");
const E = await import("@/lib/entries-edit");
const read = (rel: string) => fs.readFileSync(path.join(dir, rel), "utf8");

describe("semaine ISO", () => {
  it.each([
    ["2026-11-13", "2026-W46", "2026-11-09", "2026-11-15"],
    ["2021-01-03", "2020-W53", "2020-12-28", "2021-01-03"],
    ["2024-12-30", "2025-W01", "2024-12-30", "2025-01-05"],
    ["2026-01-01", "2026-W01", "2025-12-29", "2026-01-04"],
    ["2027-01-01", "2026-W53", "2026-12-28", "2027-01-03"],
  ])("%s → %s", (date, label, mon, sun) => {
    expect(R.isoWeek(date)).toMatchObject({ label, monday: mon, sunday: sun });
  });
});

describe("inbox", () => {
  it("ajoute, coche, supprime ; l'exemple n'est jamais compté", async () => {
    await I.addInboxItem("Appeler le garage", "2026-11-13");
    await I.addInboxItem("Lire l'article sur les taux", "2026-11-13");
    await I.addInboxItem("Idée : glossaire", "2026-11-13");
    let { items } = await I.readInbox();
    expect(items.map((i) => i.text)).toEqual(["Appeler le garage", "Lire l'article sur les taux", "Idée : glossaire"]);
    await I.markInboxDone(0, items[0].raw);
    ({ items } = await I.readInbox());
    await I.removeInboxItem(2, items[2].raw);
    const t = read("INBOX.md");
    expect(t).toContain("- [x] 2026-11-13 — Appeler le garage\n- [ ] 2026-11-13 — Lire l'article sur les taux\n");
    expect(t).not.toContain("glossaire");
    expect(t).toContain("> - [ ] 2026-11-13 — EXEMPLE"); // exemple intact
    expect(read("DASHBOARD.md")).toContain("1 élément(s) non traité(s)");
    await expect(I.markInboxDone(1, "- [ ] autre texte")).rejects.toThrow(/changé/);
  });
});

describe("revue", () => {
  it("pré-remplit « Fait » depuis le journal de la semaine, propose le focus, crée puis modifie la revue", async () => {
    const slug = await E.createEntry("project", "Site");
    let e = (await E.readEditable("project", slug))!;
    await E.editEntry("project", slug, e.version, { op: "fields", fields: { status: "active" } });
    e = (await E.readEditable("project", slug))!;
    await E.editEntry("project", slug, e.version, { op: "action-add", text: "Écrire la page d'accueil" });
    e = (await E.readEditable("project", slug))!;
    await E.editEntry("project", slug, e.version, { op: "journal-add", text: "Fait : Choisir un thème", date: "2026-11-10" });
    e = (await E.readEditable("project", slug))!;
    await E.editEntry("project", slug, e.version, { op: "journal-add", text: "Hors semaine", date: "2026-11-02" });

    const week = R.isoWeek("2026-11-13");
    expect(await R.prefillDone(week)).toEqual(["Site : Choisir un thème"]);
    expect((await R.focusOptions()).map((f) => f.text)).toContain("Écrire la page d'accueil");

    await R.saveReview(week.label, { done: ["Site : Choisir un thème"], blocked: "", inbox: ["Appeler le garage → fait"], focus: ["Écrire la page d'accueil", "Sport", "Lire", "Quatrième ignoré"] }, "create");
    const t = read("reviews/2026-W46.md");
    expect(t).toContain("# Revue hebdomadaire — 2026-W46");
    expect(t).toContain("## Fait cette semaine\n\n- Site : Choisir un thème\n");
    expect(t).toContain("## Bloqué\n\n- TODO: fill in\n");
    expect(t).toContain("1. Écrire la page d'accueil\n2. Sport\n3. Lire\n");
    expect(t).not.toContain("Quatrième");
    expect(read("DASHBOARD.md")).toContain("## Focus de la semaine\n\n1. Écrire la page d'accueil\n2. Sport\n3. Lire\n");

    // Revue déjà faite : création refusée, modification possible.
    await expect(R.saveReview(week.label, { done: [], blocked: "", inbox: [], focus: [] }, "create")).rejects.toThrow(/existe déjà/);
    const existing = (await R.readReview(week.label))!;
    expect(existing).toMatchObject({ done: ["Site : Choisir un thème"], blocked: "", focus: ["Écrire la page d'accueil", "Sport", "Lire"] });
    await R.saveReview(week.label, { ...existing, blocked: "Attente du devis" }, "update", existing.version);
    expect(read("reviews/2026-W46.md")).toContain("## Bloqué\n\n- Attente du devis\n");
  });
});
