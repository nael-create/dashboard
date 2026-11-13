import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "memo-test-"));
vi.stubEnv("CONTENT_DIR", dir);

const { addMemo, deleteMemo, parseMemo, readMemo, updateMemo } = await import("@/lib/memo");
const { detectSensitive } = await import("@/lib/secrets");
const file = path.join(dir, "MEMO.md");

describe("MEMO.md", () => {
  beforeEach(() => fs.rmSync(file, { force: true }));

  it("crée le fichier, ajoute en haut, gère plusieurs entrées le même jour", async () => {
    let { version } = await readMemo();
    ({ version } = await addMemo(version, { date: "2026-11-13", title: "Premier", text: "A", tags: ["x"], pinned: false }));
    ({ version } = await addMemo(version, { date: "2026-11-13", title: "Second", text: "B\nsuite", tags: [], pinned: true }));
    const { entries } = await readMemo();
    expect(entries.map((e) => `${e.id} ${e.title} ${e.pinned}`)).toEqual(["20261113-2 Second true", "20261113-1 Premier false"]);
    expect(entries[0].text).toBe("B\nsuite");
    expect(fs.readFileSync(file, "utf8")).toContain("## 2026-11-13 — Second\nid: 20261113-2\npinned: yes\ntags: \n\nB\nsuite\n");
  });

  it("refuse une écriture si le fichier a changé depuis la lecture", async () => {
    const { version } = await readMemo();
    await addMemo(version, { date: "2026-11-13", title: "A", text: "", tags: [], pinned: false });
    await expect(addMemo(version, { date: "2026-11-13", title: "B", text: "", tags: [], pinned: false })).rejects.toThrow(/modifié ailleurs/);
  });

  it("modifie et supprime uniquement le bloc visé, en préservant le reste", async () => {
    const hand = "# Mémo\n\nUne note libre écrite à la main.\n\n## 2026-11-10 — Sans id\ntags: a\n\nTexte\n\n## 2026-11-09 — Autre\nid: 20261109-1\npinned: no\ntags:\n\nGarde-moi\n";
    fs.writeFileSync(file, hand);
    let { entries, version } = await readMemo();
    const noId = entries[0];
    expect(noId.id).toBeNull();
    ({ version } = await updateMemo(version, noId.key, { pinned: true }));
    ({ entries } = await readMemo());
    expect(entries[0].id).toBe("20261110-1");
    expect(entries[0].pinned).toBe(true);
    await deleteMemo(version, "20261110-1");
    const after = fs.readFileSync(file, "utf8");
    expect(after).toBe("# Mémo\n\nUne note libre écrite à la main.\n\n## 2026-11-09 — Autre\nid: 20261109-1\npinned: no\ntags:\n\nGarde-moi\n");
  });

  it("refuse les secrets", async () => {
    const { version } = await readMemo();
    await expect(addMemo(version, { date: "2026-11-13", title: "Wifi", text: "mot de passe : hunter2", tags: [], pinned: false })).rejects.toThrow(/mot de passe/);
    expect(fs.existsSync(file)).toBe(false);
  });

  it("ignore les titres ## qui ne sont pas des entrées", () => {
    expect(parseMemo("# Mémo\n\n## Divers\ntexte\n")).toEqual([]);
  });
});

describe("détection de secrets", () => {
  it.each([
    ["mot de passe : abc", true],
    ["Changer le mot de passe de la box", false],
    ["digicode: 4521B", true],
    ["Carte 4970 1012 3456 7890 0", false],
    ["Carte 4111 1111 1111 1111", true],
    ["FR76 3000 6000 0112 3456 7890 189", true],
    ["Rendez-vous le 2026-11-13 à 10:00", false],
  ])("%s → %s", (text, flagged) => {
    expect(detectSensitive(text) !== null).toBe(flagged);
  });
});
