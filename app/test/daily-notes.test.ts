import { describe, expect, it } from "vitest";
import { addDone, appendDayText, dayNotes, removeDone, setDayText } from "@/lib/daily-notes";
import { parseDoc, serializeDoc } from "@/lib/markdown-doc";

const README = "---\ntitle: X\n---\n\n# X\n\n## Notes\n";

describe("notes du jour (## Notes / ### YYYY-MM-DD)", () => {
  it("écrit, ordonne (plus récent en haut) et relit le texte et les ✓", () => {
    const d = parseDoc(README);
    setDayText(d, "2026-11-24", "Appel avec Paul.\n\n- devis à relancer");
    setDayText(d, "2026-11-25", "Maquette envoyée.");
    addDone(d, "2026-11-25", "Relire le devis");
    addDone(d, "2026-11-25", "Relire le devis"); // pas de doublon
    addDone(d, "2026-11-20", "Choisir un thème");
    const out = serializeDoc(d);
    expect(out).toContain("## Notes\n\n### 2026-11-25\n\nMaquette envoyée.\n\n✓ Relire le devis\n\n### 2026-11-24\n\nAppel avec Paul.\n\n- devis à relancer\n\n### 2026-11-20\n\n✓ Choisir un thème\n");
    expect(dayNotes(d).map((n) => [n.date, n.text, n.done])).toEqual([
      ["2026-11-25", "Maquette envoyée.", ["Relire le devis"]],
      ["2026-11-24", "Appel avec Paul.\n\n- devis à relancer", []],
      ["2026-11-20", "", ["Choisir un thème"]],
    ]);
  });

  it("modifier le texte garde les ✓ ; un jour vidé disparaît", () => {
    const d = parseDoc(README);
    addDone(d, "2026-11-25", "A");
    setDayText(d, "2026-11-25", "Nouveau texte");
    expect(dayNotes(d)[0]).toMatchObject({ text: "Nouveau texte", done: ["A"] });
    setDayText(d, "2026-11-25", "");
    removeDone(d, "2026-11-25", "A");
    expect(dayNotes(d)).toEqual([]);
    expect(serializeDoc(d)).not.toContain("###");
  });

  it("crée « ## Notes » si besoin, garde un texte d'introduction et les autres sections", () => {
    const d = parseDoc("# X\n\n## Liens\n\n- https://exemple.org\n");
    appendDayText(d, "2026-11-25", "Note");
    const out = serializeDoc(d);
    expect(out).toContain("## Liens\n\n- https://exemple.org\n\n## Notes\n\n### 2026-11-25\n\nNote\n");
    const d2 = parseDoc("## Notes\n\nIntro écrite à la main.\n\n### 2026-11-20\n\nAncienne\n");
    setDayText(d2, "2026-11-25", "Récente");
    expect(serializeDoc(d2)).toContain("Intro écrite à la main.\n\n### 2026-11-25\n\nRécente\n\n### 2026-11-20");
  });

  it("refuse les titres # / ## / ### dans une note", () => {
    expect(() => setDayText(parseDoc(README), "2026-11-25", "## Titre")).toThrow(/titres/);
  });
});
