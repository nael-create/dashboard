import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hl-test-"));
vi.stubEnv("CONTENT_DIR", dir);
vi.stubEnv("DASHBOARD_DATA_DIR", path.join(dir, "data"));

const { addHighlight, deleteHighlight, parseHighlights, readHighlights, readHighlightStatus, recordHighlightStatus, sameNewsletter, updateHighlight } = await import("@/lib/highlights");
const file = path.join(dir, "SURLIGNAGES.md");

const base = {
  prefix: "débattent encore :", suffix: "? Ce qui", color: "yellow" as const,
  subject: "🌐 Au revoir Jensen…", from: "Aktionnaire <team@aktionnaire.com>",
  received: "2026-11-13T12:35:00Z", link: "https://outlook.live.com/owa/?ItemID=AQMkADAwATM0MDAAMS1iNTcwLWFlOAAtMDACLTAwCgBGAAAD&exvsurl=1",
};

describe("SURLIGNAGES.md", () => {
  beforeEach(() => fs.rmSync(file, { force: true }));

  it("crée le fichier, ajoute en haut et relit tous les champs", async () => {
    await addHighlight({ ...base, text: "doit-on le considérer\ncomme un jour de malchance" }, "2026-11-16");
    const { version } = await readHighlights();
    await addHighlight({ ...base, text: "Second passage", color: "pink", note: "À relire\nplus tard" }, "2026-11-16", version);
    const { highlights } = await readHighlights();
    expect(highlights.map((h) => `${h.id} ${h.color}`)).toEqual(["hl-20261116-2 pink", "hl-20261116-1 yellow"]);
    const h = highlights[1];
    expect(h.text).toBe("doit-on le considérer comme un jour de malchance");
    expect(h).toMatchObject({ subject: base.subject, from: base.from, received: base.received, link: base.link, prefix: base.prefix, suffix: base.suffix, note: "" });
    expect(highlights[0].note).toBe("À relire\nplus tard");
    const raw = fs.readFileSync(file, "utf8");
    expect(raw).toContain("# Surlignages");
    expect(raw).toContain("## 2026-11-16 — 🌐 Au revoir Jensen…\nid: hl-20261116-1\ncolor: yellow\n");
    expect(raw).toContain("\n> doit-on le considérer comme un jour de malchance\n");
  });

  it("refuse un passage de plus de 1 000 caractères", async () => {
    await expect(addHighlight({ ...base, text: "a".repeat(1001) }, "2026-11-16")).rejects.toThrow(/1 000 caractères/);
    expect(fs.existsSync(file)).toBe(false);
  });

  it("refuse un passage ou une note contenant un code ou un mot de passe", async () => {
    await expect(addHighlight({ ...base, text: "Ton code d'accès : 4482B" }, "2026-11-16")).rejects.toThrow(/Non enregistré.*mot de passe ou un code/);
    await expect(addHighlight({ ...base, text: "ok", note: "mot de passe: hunter22" }, "2026-11-16")).rejects.toThrow(/Non enregistré/);
    await expect(addHighlight({ ...base, text: "Carte 4111 1111 1111 1111" }, "2026-11-16")).rejects.toThrow(/carte bancaire/);
    await expect(addHighlight({ ...base, text: "refresh_token=abc" }, "2026-11-16")).rejects.toThrow(/Non enregistré/);
    expect(fs.existsSync(file)).toBe(false);
  });

  it("le lien Outlook (long) n'est pas pris pour un secret, ni à l'écriture ni par « Sauvegarder »", async () => {
    await expect(addHighlight({ ...base, text: "Un passage", note: "Ma note" }, "2026-11-16")).resolves.toBeTruthy();
    const { findSecrets } = await import("@/lib/git");
    const diff = "+++ b/SURLIGNAGES.md\n" + fs.readFileSync(file, "utf8").split("\n").map((l) => `+${l}`).join("\n");
    expect(findSecrets(diff)).toEqual([]);
  });

  it("modifie couleur et note, supprime, et respecte « fichier inchangé depuis la lecture »", async () => {
    await addHighlight({ ...base, text: "Passage" }, "2026-11-16");
    let { version } = await readHighlights();
    ({ version } = await updateHighlight(version, "hl-20261116-1", { color: "blue", note: "Ma note" }));
    expect((await readHighlights()).highlights[0]).toMatchObject({ color: "blue", note: "Ma note", text: "Passage" });
    await expect(updateHighlight("ancienne", "hl-20261116-1", { color: "green" })).rejects.toThrow(/modifié ailleurs/);
    await deleteHighlight(version, "hl-20261116-1");
    expect((await readHighlights()).highlights).toHaveLength(0);
  });

  it("ignore les blocs illisibles sans erreur et garde les titres à la main", () => {
    const hs = parseHighlights("# Surlignages\n\n## Notes à la main\nbla\n\n## 2026-11-16 — Sans id\ncolor: blue\n\n> x\n");
    expect(hs).toHaveLength(0);
  });

  it("reconnaît la newsletter d'un surlignage", () => {
    expect(sameNewsletter(base, { webLink: base.link, subject: "autre", received: "x" })).toBe(true);
    expect(sameNewsletter({ ...base, link: "" }, { webLink: "", subject: base.subject, received: base.received })).toBe(true);
    expect(sameNewsletter(base, { webLink: "https://outlook.live.com/autre", subject: base.subject, received: base.received })).toBe(false);
  });

  it("état « introuvable » : local, fichier illisible sans erreur", async () => {
    expect(await readHighlightStatus()).toEqual({});
    await recordHighlightStatus(["hl-20261116-1"], ["hl-20261116-2"]);
    expect(await readHighlightStatus()).toEqual({ "hl-20261116-1": "found", "hl-20261116-2": "missing" });
    fs.writeFileSync(path.join(dir, "data", "highlights-status.local.json"), "{pas du json");
    expect(await readHighlightStatus()).toEqual({});
  });
});
