import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "notions-test-"));
vi.stubEnv("CONTENT_DIR", dir);
vi.stubEnv("DASHBOARD_DATA_DIR", path.join(dir, "data"));
const N = await import("@/lib/notions");
const file = path.join(dir, "NOTIONS.md");
const progress = path.join(dir, "data", "notions-progress.local.json");

describe("NOTIONS.md", () => {
  it("lit le format (tags, added, définition multiligne, exemple)", () => {
    const [n] = N.parseNotions("# Notions\n\n## Taux directeur\ntags: eco, finance\nadded: 2026-11-13\n\nTaux fixé par\nla banque centrale.\n\n> La BCE a relevé son taux.\n");
    expect(n).toMatchObject({ id: "taux-directeur", term: "Taux directeur", tags: ["eco", "finance"], added: "2026-11-13", definition: "Taux fixé par\nla banque centrale.", example: "La BCE a relevé son taux." });
  });

  it("deux termes identiques n'ont jamais le même identifiant", () => {
    expect(N.parseNotions("## Spread\nA\n## Spread\nB\n").map((n) => n.id)).toEqual(["spread", "spread-2"]);
  });

  it("ajoute (sans définition = à compléter), refuse les doublons, importe en masse", async () => {
    await N.addNotion({ term: "Duration", definition: "Sensibilité d'une obligation aux taux." }, "2026-11-13");
    await N.addNotion({ term: "Convexité" }, "2026-11-13");
    await expect(N.addNotion({ term: "duration" }, "2026-11-13")).rejects.toThrow(/existe déjà/);
    const { notions, version } = await N.readNotions();
    expect(notions.map((n) => n.term)).toEqual(["Duration", "Convexité"]);
    const preview = N.parseBulk("Spread : écart de taux\n\nDuration : doublon\nCarry : portage\nSpread : encore", notions.map((n) => n.term));
    expect(preview.map((p) => `${p.term}:${p.status}`)).toEqual(["Spread:ok", "Duration:duplicate", "Carry:ok", "Spread:duplicate"]);
    const res = await N.importNotions(preview.filter((p) => p.status === "ok"), "2026-11-13", version);
    expect(res.result).toBe(2);
    expect(fs.readFileSync(file, "utf8")).toContain("## Spread\nadded: 2026-11-13\n\nécart de taux\n\n## Carry\nadded: 2026-11-13\n\nportage\n");
  });

  it("révision Leitner : due le lendemain, 1-2-5-14-30-90 jours, « À revoir » → boîte 1", async () => {
    let due = await N.dueNotions("2026-11-13", 3);
    expect(due.items).toHaveLength(0); // ajoutées aujourd'hui : dues demain
    due = await N.dueNotions("2026-11-14", 10);
    expect(due.items.map((n) => n.term).sort()).toEqual(["Carry", "Duration", "Spread"]); // pas Convexité (sans définition)
    await N.recordReview("duration", true, "2026-11-14");
    let p = JSON.parse(fs.readFileSync(progress, "utf8"));
    expect(p.duration).toMatchObject({ box: 2, due: "2026-11-16" });
    await N.recordReview("duration", true, "2026-11-16");
    expect(JSON.parse(fs.readFileSync(progress, "utf8")).duration).toMatchObject({ box: 3, due: "2026-11-21" });
    await N.recordReview("duration", false, "2026-11-21");
    p = JSON.parse(fs.readFileSync(progress, "utf8"));
    expect(p.duration).toMatchObject({ box: 1, due: "2026-11-22" });
    // La progression n'est jamais écrite dans NOTIONS.md.
    expect(fs.readFileSync(file, "utf8")).not.toMatch(/box|due:|history/);
  });

  it("boîte maximale 6 (90 jours) et compte des notions apprises (boîte ≥ 4)", () => {
    let pr = undefined as ReturnType<typeof N.nextProgress> | undefined;
    for (let i = 0; i < 8; i++) pr = N.nextProgress(pr, true, "2026-01-01");
    expect(pr).toMatchObject({ box: 6, due: "2026-04-01" });
  });

  it("progression perdue ou fichier corrompu : rien ne casse", async () => {
    fs.writeFileSync(progress, "{ pas du json");
    const due = await N.dueNotions("2026-11-14", 10);
    expect(due.items.length).toBe(3);
  });

  it("renommer depuis l'app garde la progression ; supprimer efface la progression", async () => {
    await N.recordReview("carry", true, "2026-11-14");
    let { version } = await N.readNotions();
    await N.updateNotion(version, "carry", { term: "Carry trade", example: "Emprunter en yen pour placer en dollar." });
    const p = JSON.parse(fs.readFileSync(progress, "utf8"));
    expect(p["carry-trade"]?.box).toBe(2);
    expect(p.carry).toBeUndefined();
    expect(fs.readFileSync(file, "utf8")).toContain("## Carry trade\nadded: 2026-11-13\n\nportage\n\n> Emprunter en yen pour placer en dollar.\n");
    ({ version } = await N.readNotions());
    await N.deleteNotion(version, "carry-trade");
    expect(JSON.parse(fs.readFileSync(progress, "utf8"))["carry-trade"]).toBeUndefined();
  });
});
